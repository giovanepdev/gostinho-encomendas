-- =====================================================================
-- Gostinho da Promessa — site de encomendas
-- Rode este arquivo inteiro no Supabase: Dashboard > SQL Editor > New query.
-- Pode rodar de novo sem quebrar (é idempotente).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Admins: quem pode entrar no painel.
--    O login é do Supabase Auth; esta tabela diz QUEM dos usuários é admin.
--    Assim, mesmo se alguém conseguir criar uma conta, não vê nada.
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 2. Produtos (cadastrados pela sua irmã no painel)
-- ---------------------------------------------------------------------
create table if not exists public.produtos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (char_length(nome) between 2 and 80),
  descricao   text check (char_length(descricao) <= 500),
  categoria   text not null default 'doce' check (categoria in ('doce', 'salgado', 'outro')),
  unidade     text not null default 'unidade' check (char_length(unidade) between 1 and 20),
  preco       numeric(10, 2) not null check (preco > 0),
  foto_path   text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Pedidos e itens
--    Preço e nome do produto são COPIADOS para o item no momento do pedido:
--    se ela mudar o preço amanhã, os pedidos antigos não mudam.
-- ---------------------------------------------------------------------
create table if not exists public.pedidos (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity unique,
  cliente_nome     text not null check (char_length(cliente_nome) between 2 and 100),
  cliente_telefone text not null check (cliente_telefone ~ '^[0-9]{10,11}$'),
  cliente_email    text check (cliente_email is null or char_length(cliente_email) <= 120),
  data_entrega     date not null,
  tipo_entrega     text not null check (tipo_entrega in ('retirada', 'uber', '99')),
  endereco         text check (char_length(endereco) <= 300),
  observacoes      text check (char_length(observacoes) <= 500),
  total            numeric(10, 2) not null check (total > 0),
  valor_sinal      numeric(10, 2) not null check (valor_sinal > 0),
  status           text not null default 'aguardando_sinal'
                   check (status in ('aguardando_sinal', 'confirmado', 'em_producao', 'pronto', 'entregue', 'cancelado')),
  saldo_pago       boolean not null default false,
  mp_preference_id text,
  mp_payment_id    text unique,
  metodo_sinal     text,
  sinal_pago_em    timestamptz,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  constraint endereco_obrigatorio_para_entrega
    check (tipo_entrega = 'retirada' or (endereco is not null and char_length(endereco) >= 5))
);

create index if not exists pedidos_status_idx on public.pedidos (status, data_entrega);
create index if not exists pedidos_criado_idx on public.pedidos (criado_em desc);

create table if not exists public.itens_pedido (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references public.pedidos (id) on delete cascade,
  produto_id     uuid references public.produtos (id) on delete set null,
  nome_produto   text not null,
  unidade        text not null,
  preco_unitario numeric(10, 2) not null check (preco_unitario > 0),
  quantidade     integer not null check (quantidade between 1 and 100),
  subtotal       numeric(10, 2) generated always as (preco_unitario * quantidade) stored
);

create index if not exists itens_pedido_pedido_idx on public.itens_pedido (pedido_id);

-- atualizado_em automático
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists produtos_atualizado_em on public.produtos;
create trigger produtos_atualizado_em before update on public.produtos
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists pedidos_atualizado_em on public.pedidos;
create trigger pedidos_atualizado_em before update on public.pedidos
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------
-- 4. criar_pedido: cria pedido + itens numa única transação.
--    O PREÇO VEM DO BANCO, nunca do navegador do cliente.
--    Só o servidor (service_role) pode chamar.
-- ---------------------------------------------------------------------
create or replace function public.criar_pedido(
  p_cliente jsonb,
  p_itens jsonb,
  p_antecedencia_dias integer default 2
)
returns table (pedido_id uuid, numero_pedido bigint, valor_total numeric, sinal numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje        date := (now() at time zone 'America/Bahia')::date;
  v_entrega     date := (p_cliente ->> 'data_entrega')::date;
  v_itens       jsonb;
  v_qtd_itens   integer;
  v_qtd_validos integer;
  v_total       numeric(10, 2);
  v_sinal       numeric(10, 2);
  v_id          uuid;
  v_numero      bigint;
begin
  if v_entrega < v_hoje + p_antecedencia_dias then
    raise exception 'DATA_ENTREGA_CEDO' using errcode = 'P0001';
  end if;
  if v_entrega > v_hoje + 90 then
    raise exception 'DATA_ENTREGA_LONGE' using errcode = 'P0001';
  end if;

  -- Junta itens repetidos (mesmo produto duas vezes vira uma linha só)
  select coalesce(jsonb_agg(jsonb_build_object('produto_id', s.produto_id, 'quantidade', s.quantidade)), '[]'::jsonb)
    into v_itens
    from (
      select (i ->> 'produto_id')::uuid as produto_id,
             sum((i ->> 'quantidade')::integer)::integer as quantidade
        from jsonb_array_elements(p_itens) i
       group by 1
    ) s;

  v_qtd_itens := jsonb_array_length(v_itens);
  if v_qtd_itens = 0 then
    raise exception 'PEDIDO_VAZIO' using errcode = 'P0001';
  end if;

  -- Todos os produtos precisam existir, estar ativos e ter quantidade válida
  select count(*), sum(p.preco * t.quantidade)
    into v_qtd_validos, v_total
    from jsonb_to_recordset(v_itens) as t(produto_id uuid, quantidade integer)
    join public.produtos p on p.id = t.produto_id and p.ativo
   where t.quantidade between 1 and 100;

  if v_qtd_validos <> v_qtd_itens then
    raise exception 'PRODUTO_INVALIDO' using errcode = 'P0001';
  end if;

  v_sinal := round(v_total * 0.5, 2);

  insert into public.pedidos (
    cliente_nome, cliente_telefone, cliente_email, data_entrega,
    tipo_entrega, endereco, observacoes, total, valor_sinal
  ) values (
    p_cliente ->> 'cliente_nome',
    p_cliente ->> 'cliente_telefone',
    nullif(p_cliente ->> 'cliente_email', ''),
    v_entrega,
    p_cliente ->> 'tipo_entrega',
    nullif(p_cliente ->> 'endereco', ''),
    nullif(p_cliente ->> 'observacoes', ''),
    v_total,
    v_sinal
  )
  returning id, numero into v_id, v_numero;

  insert into public.itens_pedido (pedido_id, produto_id, nome_produto, unidade, preco_unitario, quantidade)
  select v_id, p.id, p.nome, p.unidade, p.preco, t.quantidade
    from jsonb_to_recordset(v_itens) as t(produto_id uuid, quantidade integer)
    join public.produtos p on p.id = t.produto_id;

  return query select v_id, v_numero, v_total, v_sinal;
end;
$$;

-- No Supabase, funções em "public" viram endpoint público por padrão. Fecha:
revoke execute on function public.criar_pedido(jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.criar_pedido(jsonb, jsonb, integer) to service_role;

-- ---------------------------------------------------------------------
-- 5. RLS (Row Level Security) — a proteção de verdade.
--    A chave "anon" fica exposta no navegador; sem RLS qualquer um
--    leria todos os pedidos (nome e telefone de clientes).
-- ---------------------------------------------------------------------
alter table public.admins       enable row level security;
alter table public.produtos     enable row level security;
alter table public.pedidos      enable row level security;
alter table public.itens_pedido enable row level security;

-- Permissões explícitas (GRANT): cada papel recebe só o que o site usa.
-- Funciona tanto com "Automatically expose new tables" ligado quanto desligado.
-- O GRANT diz QUAIS operações o papel pode tentar; o RLS abaixo diz em QUAIS linhas.
revoke all on public.admins, public.produtos, public.pedidos, public.itens_pedido from anon, authenticated;
grant select on public.produtos to anon, authenticated;              -- vitrine
grant insert, update, delete on public.produtos to authenticated;    -- painel (RLS: só admin)
grant select, update on public.pedidos to authenticated;             -- painel (RLS: só admin)
grant select on public.itens_pedido to authenticated;                -- painel (RLS: só admin)
grant select, insert, update, delete on public.admins, public.produtos, public.pedidos, public.itens_pedido to service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- admins: nenhuma policy = ninguém lê/escreve pela API (só via SQL Editor).

drop policy if exists "produtos: leitura pública dos ativos" on public.produtos;
create policy "produtos: leitura pública dos ativos" on public.produtos
  for select to anon, authenticated
  using (ativo or (select public.is_admin()));

drop policy if exists "produtos: admin insere" on public.produtos;
create policy "produtos: admin insere" on public.produtos
  for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "produtos: admin altera" on public.produtos;
create policy "produtos: admin altera" on public.produtos
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "produtos: admin exclui" on public.produtos;
create policy "produtos: admin exclui" on public.produtos
  for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "pedidos: admin lê" on public.pedidos;
create policy "pedidos: admin lê" on public.pedidos
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "pedidos: admin altera" on public.pedidos;
create policy "pedidos: admin altera" on public.pedidos
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "itens: admin lê" on public.itens_pedido;
create policy "itens: admin lê" on public.itens_pedido
  for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 6. Storage: fotos dos produtos (leitura pública, escrita só admin)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- (a leitura pública das fotos é pela URL pública do bucket; esta policy
--  é só para o upload do admin conseguir ler o que acabou de gravar)
drop policy if exists "fotos: admin lê" on storage.objects;
create policy "fotos: admin lê" on storage.objects
  for select to authenticated
  using (bucket_id = 'produtos' and (select public.is_admin()));

drop policy if exists "fotos: admin envia" on storage.objects;
create policy "fotos: admin envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produtos' and (select public.is_admin()));

drop policy if exists "fotos: admin altera" on storage.objects;
create policy "fotos: admin altera" on storage.objects
  for update to authenticated
  using (bucket_id = 'produtos' and (select public.is_admin()));

drop policy if exists "fotos: admin exclui" on storage.objects;
create policy "fotos: admin exclui" on storage.objects
  for delete to authenticated
  using (bucket_id = 'produtos' and (select public.is_admin()));

-- =====================================================================
-- DEPOIS de rodar este arquivo:
--   1. Authentication > Users > Add user: crie o usuário da sua irmã
--      (e-mail + senha, marque "Auto Confirm User").
--   2. Rode, trocando o e-mail:
--        insert into public.admins (user_id)
--        select id from auth.users where email = 'email-da-sua-irma@exemplo.com';
--   3. Authentication > Sign In / Providers: DESLIGUE "Allow new users to sign up".
-- =====================================================================
