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
  categoria   text not null default 'doce' check (categoria in ('doce', 'salgado', 'bolo', 'outro')),
  unidade     text not null default 'unidade' check (char_length(unidade) between 1 and 20),
  preco       numeric(10, 2) not null check (preco > 0),
  -- Pedido mínimo deste produto, na unidade de venda dele (ex.: 25 brigadeiros; bolo = 1)
  quantidade_minima integer not null default 1 check (quantidade_minima between 1 and 1000),
  foto_path   text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- (set/2026) Categoria "Bolos" (cada tamanho de bolo é um produto).
alter table public.produtos drop constraint if exists produtos_categoria_check;
alter table public.produtos add constraint produtos_categoria_check
  check (categoria in ('doce', 'salgado', 'bolo', 'outro'));

-- (set/2026) Pedido mínimo por produto. Regra da confeitaria: doces e salgados
-- de festa a partir de 25 unidades POR SABOR (não vale somar sabores); bolo sem mínimo.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'produtos'
                    and column_name = 'quantidade_minima') then
    alter table public.produtos add column quantidade_minima integer not null default 1
      check (quantidade_minima between 1 and 1000);
    -- Roda UMA vez só (quando a coluna nasce), para não desfazer o que ela
    -- ajustar depois no painel. Só mexe em doce/salgado vendido por UNIDADE:
    -- produto vendido por cento ou kg continua com mínimo 1 (25 centos seria absurdo).
    update public.produtos set quantidade_minima = 25
     where categoria in ('doce', 'salgado') and unidade ~* '^\s*unid';
  end if;
end;
$$;

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
  data_entrega     date not null,
  tipo_entrega     text not null check (tipo_entrega in ('retirada', 'uber', '99')),
  endereco         text check (char_length(endereco) <= 300),
  observacoes      text check (char_length(observacoes) <= 500),
  total            numeric(10, 2) not null check (total > 0),
  valor_sinal      numeric(10, 2) not null check (valor_sinal > 0),
  status           text not null default 'aguardando_sinal'
                   check (status in ('aguardando_sinal', 'confirmado', 'em_producao', 'pronto', 'entregue', 'cancelado')),
  saldo_pago       boolean not null default false,
  sinal_pago_em    timestamptz, -- preenchido quando a confeitaria confirma o Pix no painel
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  constraint endereco_obrigatorio_para_entrega
    check (tipo_entrega = 'retirada' or (endereco is not null and char_length(endereco) >= 5))
);

-- (set/2026) O sinal passou a ser por Pix direto, sem Mercado Pago: remove as colunas antigas.
alter table public.pedidos drop column if exists mp_preference_id;
alter table public.pedidos drop column if exists mp_payment_id;
alter table public.pedidos drop column if exists metodo_sinal;
-- (set/2026) E-mail do cliente era coletado e nunca usado (LGPD: não guardar o que não usa).
alter table public.pedidos drop column if exists cliente_email;

create index if not exists pedidos_status_idx on public.pedidos (status, data_entrega);
create index if not exists pedidos_criado_idx on public.pedidos (criado_em desc);
-- Usados pelos limites do criar_pedido (pedidos por telefone e por dia de entrega)
create index if not exists pedidos_telefone_idx on public.pedidos (cliente_telefone, status);
create index if not exists pedidos_entrega_idx on public.pedidos (data_entrega);

create table if not exists public.itens_pedido (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references public.pedidos (id) on delete cascade,
  produto_id     uuid references public.produtos (id) on delete set null,
  nome_produto   text not null,
  unidade        text not null,
  preco_unitario numeric(10, 2) not null check (preco_unitario > 0),
  quantidade     integer not null check (quantidade between 1 and 10000),
  subtotal       numeric(10, 2) generated always as (preco_unitario * quantidade) stored
);

create index if not exists itens_pedido_pedido_idx on public.itens_pedido (pedido_id);

-- (set/2026) O teto antigo de 100 por item travava pedido de festa (ex.: 300 brigadeiros).
-- O limite de verdade vem do site (MAX_QUANTIDADE_POR_ITEM); este é só uma trava de segurança.
alter table public.itens_pedido drop constraint if exists itens_pedido_quantidade_check;
alter table public.itens_pedido add constraint itens_pedido_quantidade_check
  check (quantidade between 1 and 10000);

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
-- 3b. Regra única de "este pedido ocupa uma vaga no dia de entrega?".
--     Usada pelo criar_pedido (para recusar data cheia) e pelo datas_lotadas
--     (para o site mostrar as datas cheias ANTES do cliente preencher tudo).
--     Um lugar só: se a regra mudar, as duas coisas mudam juntas.
--     Ocupa vaga: pedido não cancelado que já tem sinal (ou está em andamento),
--     ou que ainda espera o sinal mas foi feito há pouco (p_reserva_horas).
-- ---------------------------------------------------------------------
create or replace function public.ocupa_vaga(p_status text, p_criado_em timestamptz, p_reserva_horas integer)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status <> 'cancelado'
     and (p_status <> 'aguardando_sinal'
          or p_criado_em > now() - make_interval(hours => coalesce(p_reserva_horas, 24)));
$$;

revoke execute on function public.ocupa_vaga(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.ocupa_vaga(text, timestamptz, integer) to service_role;

-- Datas de entrega que já bateram o limite do dia (entre p_de e p_ate).
-- Devolve SÓ as datas: nada de nome, telefone ou quantidade de pedidos.
create or replace function public.datas_lotadas(
  p_de date,
  p_ate date,
  p_max_pedidos_dia integer, -- null = sem limite: nenhuma data fica cheia
  p_reserva_horas integer
)
returns table (data date)
language sql
stable
security definer
set search_path = ''
as $$
  select p.data_entrega
    from public.pedidos p
   where p_max_pedidos_dia is not null
     and p.data_entrega between p_de and p_ate
     and public.ocupa_vaga(p.status, p.criado_em, p_reserva_horas)
   group by p.data_entrega
  having count(*) >= p_max_pedidos_dia
   order by 1;
$$;

-- Só o servidor do site chama (com a chave de serviço). Os parâmetros vêm do
-- config.ts; se fosse público, qualquer um passaria "limite 1" e descobriria
-- em quais dias existe pedido.
revoke execute on function public.datas_lotadas(date, date, integer, integer) from public, anon, authenticated;
grant execute on function public.datas_lotadas(date, date, integer, integer) to service_role;

-- ---------------------------------------------------------------------
-- 4. criar_pedido: cria pedido + itens numa única transação.
--    As regras do negócio vêm do site (src/lib/config.ts): percentual do sinal,
--    capacidade por dia e quanto tempo a data fica reservada sem sinal.
--    O PREÇO VEM DO BANCO, nunca do navegador do cliente.
--    Só o servidor (service_role) pode chamar.
--
--    Limites contra abuso (ficam AQUI porque ninguém consegue pular o banco):
--      * no máximo 3 pedidos recentes aguardando sinal por telefone;
--      * no máximo 20 pedidos criados na última hora, no site inteiro (disjuntor).
--    Quantidade: cada produto tem seu pedido mínimo (ex.: 25 por sabor) e
--    nenhum passa do teto do site (p_max_quantidade).
-- ---------------------------------------------------------------------
-- Versões antigas: remove para não sobrar duas funções com o mesmo nome.
drop function if exists public.criar_pedido(jsonb, jsonb, integer);
drop function if exists public.criar_pedido(jsonb, jsonb, integer, numeric);
drop function if exists public.criar_pedido(jsonb, jsonb, integer, numeric, integer, integer);

create or replace function public.criar_pedido(
  p_cliente jsonb,
  p_itens jsonb,
  p_antecedencia_dias integer,
  p_percentual_sinal numeric,
  p_max_pedidos_dia integer, -- null = sem limite por dia
  p_reserva_horas integer,   -- pedido sem sinal há mais tempo que isso não ocupa vaga no dia
  p_max_quantidade integer   -- teto de quantidade de um produto num pedido
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
  v_telefone    text := p_cliente ->> 'cliente_telefone';
  v_ocupados    integer;
  v_reserva     integer := coalesce(p_reserva_horas, 24);
  v_max_qtd     integer := coalesce(p_max_quantidade, 1000);
  v_abaixo      record;
begin
  if p_percentual_sinal is null or p_percentual_sinal <= 0 or p_percentual_sinal > 100 then
    raise exception 'PERCENTUAL_SINAL_INVALIDO' using errcode = 'P0001';
  end if;
  if v_entrega < v_hoje + p_antecedencia_dias then
    raise exception 'DATA_ENTREGA_CEDO' using errcode = 'P0001';
  end if;
  if v_entrega > v_hoje + 90 then
    raise exception 'DATA_ENTREGA_LONGE' using errcode = 'P0001';
  end if;

  -- Um pedido de cada vez: sem isso, dois pedidos simultâneos contariam a mesma
  -- vaga como livre e os dois passariam. A trava some sozinha no fim da transação.
  perform pg_advisory_xact_lock(hashtext('criar_pedido'));

  -- Disjuntor: se alguém disparar pedidos em massa, o site para de aceitar por
  -- uma hora em vez de encher o banco e o painel. O WhatsApp continua funcionando.
  if (select count(*) from public.pedidos where criado_em > now() - interval '1 hour') >= 20 then
    raise exception 'MUITOS_PEDIDOS_AGORA' using errcode = 'P0001';
  end if;

  -- Mesmo WhatsApp com 3 pedidos recentes sem sinal: paga um antes de fazer outro.
  if (select count(*) from public.pedidos
       where cliente_telefone = v_telefone and status = 'aguardando_sinal'
         and criado_em > now() - make_interval(hours => v_reserva)) >= 3 then
    raise exception 'LIMITE_POR_TELEFONE' using errcode = 'P0001';
  end if;

  -- Capacidade do dia: conta pedidos com sinal pago (ou já em andamento) e os
  -- recentes ainda sem sinal. Pedido esquecido sem pagar não segura a vaga para sempre.
  if p_max_pedidos_dia is not null then
    select count(*) into v_ocupados
      from public.pedidos
     where data_entrega = v_entrega
       and public.ocupa_vaga(status, criado_em, v_reserva);
    if v_ocupados >= p_max_pedidos_dia then
      raise exception 'DATA_LOTADA' using errcode = 'P0001';
    end if;
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

  -- Todos os produtos precisam existir e estar ativos
  select count(*), sum(p.preco * t.quantidade)
    into v_qtd_validos, v_total
    from jsonb_to_recordset(v_itens) as t(produto_id uuid, quantidade integer)
    join public.produtos p on p.id = t.produto_id and p.ativo;

  if v_qtd_validos <> v_qtd_itens then
    raise exception 'PRODUTO_INVALIDO' using errcode = 'P0001';
  end if;

  -- Quantidade dentro do teto do site (erro de digitação ou abuso)
  if exists (select 1 from jsonb_to_recordset(v_itens) as t(produto_id uuid, quantidade integer)
              where t.quantidade is null or t.quantidade < 1 or t.quantidade > v_max_qtd) then
    raise exception 'QUANTIDADE_INVALIDA' using errcode = 'P0001';
  end if;

  -- Pedido mínimo POR PRODUTO (sabor). Itens repetidos já foram somados acima,
  -- então 10 + 15 do mesmo brigadeiro contam 25; já 10 brigadeiros + 15 beijinhos não.
  -- O detalhe diz qual produto, para o site explicar ao cliente.
  select p.nome, p.quantidade_minima, p.unidade
    into v_abaixo
    from jsonb_to_recordset(v_itens) as t(produto_id uuid, quantidade integer)
    join public.produtos p on p.id = t.produto_id
   where t.quantidade < p.quantidade_minima
   order by p.nome
   limit 1;
  if found then
    raise exception 'QUANTIDADE_MINIMA' using errcode = 'P0001',
      detail = json_build_object('produto', v_abaixo.nome,
                                 'minimo', v_abaixo.quantidade_minima,
                                 'unidade', v_abaixo.unidade)::text;
  end if;

  v_sinal := greatest(round(v_total * p_percentual_sinal / 100, 2), 0.01);

  insert into public.pedidos (
    cliente_nome, cliente_telefone, data_entrega,
    tipo_entrega, endereco, observacoes, total, valor_sinal
  ) values (
    p_cliente ->> 'cliente_nome',
    v_telefone,
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
revoke execute on function public.criar_pedido(jsonb, jsonb, integer, numeric, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.criar_pedido(jsonb, jsonb, integer, numeric, integer, integer, integer) to service_role;

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

-- ---------------------------------------------------------------------
-- 7. Avisa a API do Supabase (PostgREST) que o banco mudou: sem isso, logo
--    depois de rodar este arquivo a API pode ainda não enxergar colunas novas
--    ou a nova versão do criar_pedido, e o site dá erro até ela recarregar.
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';

-- =====================================================================
-- DEPOIS de rodar este arquivo:
--   1. Authentication > Users > Add user: crie o usuário da sua irmã
--      (e-mail + senha, marque "Auto Confirm User").
--   2. Rode, trocando o e-mail:
--        insert into public.admins (user_id)
--        select id from auth.users where email = 'email-da-sua-irma@exemplo.com';
--   3. Authentication > Sign In / Providers: DESLIGUE "Allow new users to sign up".
-- =====================================================================
