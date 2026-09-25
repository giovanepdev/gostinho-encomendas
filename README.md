# Gostinho da Promessa — Site de encomendas

O cliente monta o pedido (vários produtos), escolhe a data e paga **30% de sinal por Pix**, direto na conta da confeitaria.
O código Pix (QR e "copia e cola") é gerado pelo site para cada pedido, já com o valor exato.
A confeitaria confere o Pix no extrato e confirma o pedido num **painel com login**. No painel ela também muda o status,
marca o restante como pago e cadastra os produtos com foto. Não tem **nenhuma** ligação com o sistema de estoque.

**Identidade visual:** as mesmas cores e a mesma logo do sistema de estoque (v1).

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind 4) · Supabase (Postgres, Auth e Storage) · Pix (BR Code gerado no próprio site) · Netlify.

---

## ⚠️ Leia antes de colocar no ar

1. **Netlify grátis = 300 créditos/mês com limite rígido.** Se estourar, o site para até o mês virar.
   **Cada publicação (deploy) custa 15 créditos.** Teste tudo no seu PC e só publique quando estiver pronto.
2. **O Supabase grátis pausa o projeto depois de ~1 semana sem uso do banco.** A rota `/api/cron/manter-ativo`
   faz uma consulta mínima; ela precisa ser chamada uma vez por dia (na Netlify, com uma *Scheduled Function*)
   enviando o header `Authorization: Bearer <CRON_SECRET>`.
3. **Pix direto não tem confirmação automática.** A confeitaria confere no **extrato do banco**, nunca só pelo print
   do comprovante (golpe comum: print editado ou Pix agendado que nunca cai).
4. **Tarifa:** banco pode cobrar de pessoa física que recebe mais de 30 Pix/mês com finalidade comercial,
   e de MEI/PJ para receber. Confira as regras do banco da conta que recebe.

---

## Como rodar

### 1. Supabase
1. Crie um projeto em supabase.com (região **South America (São Paulo)**). Na criação, **desmarque**
   "Automatically expose new tables" e **marque** "Enable automatic RLS".
2. **SQL Editor → New query**: cole todo o `supabase/schema.sql` e clique em **Run**.
   Pode rodar de novo sempre que o arquivo mudar: ele não apaga dados.
3. **Authentication → Users → Add user**: crie os usuários do painel (marque *Auto Confirm User*) e rode:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email in ('email1@exemplo.com', 'email2@exemplo.com')
   on conflict (user_id) do nothing;
   ```
4. **Authentication → Sign In / Providers**: **desligue** "Allow new users to sign up".
5. **Project Settings → API Keys**: copie a URL, a *publishable key* e a *secret key*.

### 2. Pix
No app do banco que vai receber: **Pix → Minhas chaves → Cadastrar chave aleatória**. Use essa chave
(ela não expõe CPF nem telefone), o nome do titular e a cidade no `.env.local`.

### 3. No seu PC
```bash
npm install
copy .env.example .env.local   # Linux/Mac: cp .env.example .env.local
# preencha o .env.local
npm run dev                    # http://localhost:3000  e  http://localhost:3000/painel
```

---

## Como funciona (e por quê)

| Decisão | Motivo |
|---|---|
| **O preço e o sinal são calculados no banco** (função `criar_pedido`), nunca no navegador | Qualquer um pode editar o HTML e mandar "brigadeiro a R$ 0,01". O navegador envia só *id do produto + quantidade*. |
| **Preço e nome são copiados para o item do pedido** | Se o preço mudar amanhã, os pedidos antigos continuam com o valor da época. |
| **Sinal por Pix direto, sem intermediário** | Sem taxa, dinheiro na hora na conta dela, menos peças para quebrar, e sem risco de contestação de cartão (chargeback). |
| **Código Pix gerado pelo site (BR Code/EMV) com valor exato e número do pedido** | O cliente não digita valor (não erra), e o Pix chega identificado (`PED0001`). Não precisa de API de banco. |
| **Chave aleatória** | O código Pix é público; chave de CPF ou telefone exporia dados pessoais. |
| **Confirmação manual no painel** ("Confirmar sinal recebido") | Pix direto não avisa o site. A confeitaria confere no extrato e confirma com um clique. |
| **RLS + permissões mínimas (GRANT) em todas as tabelas** | A chave *publishable* fica exposta no navegador. Sem isso, qualquer pessoa leria nome e telefone de todos os clientes. |
| **Tabela `admins` + `is_admin()`** | Ter login não basta: precisa estar na lista. Se o cadastro público for religado sem querer, a conta nova continua sem ver nada. |
| **`exigirAdmin()` em toda página e server action do painel** | Uma server action é um endpoint HTTP público. Esconder o botão não protege nada. |
| **Pedido cancelado com sinal pago mostra "Devolver sinal!"** | O reembolso é manual. O painel avisa em vez de esconder. |
| **Cardápio em cache (ISR)**, atualizado na hora quando um produto é editado | O site abre rápido e quase não gasta o banco. |
| **A foto é reduzida no navegador** (ex.: 5 MB → ~110 KB WebP) | Upload rápido no celular, Storage grátis dura mais, vitrine leve. |

### Regras de negócio (em `src/lib/config.ts`)
- Sinal de **30%** em qualquer valor (`PERCENTUAL_SINAL`). O banco recebe esse número do site; mudou lá, muda tudo.
- Antecedência mínima de **2 dias** e máxima de 90. **Se mudar o 90, mude também em `schema.sql`.**
- O restante é pago na entrega, fora do site. Ela marca como pago no painel.
- Status: Aguardando sinal → Confirmado → Em produção → Pronto → Entregue (ou Cancelado).
  Voltar para "Aguardando sinal" desfaz a confirmação; avançar o status marca o sinal como recebido.

### Mapa do código
```
supabase/schema.sql                 tabelas, função criar_pedido, RLS, permissões, bucket de fotos
src/proxy.ts                        renova a sessão e barra /painel sem login (1ª barreira)
src/lib/auth.ts                     exigirAdmin() — a barreira de verdade no servidor
src/lib/pix.ts                      monta o "Pix copia e cola" (BR Code) com CRC16
src/lib/validacao.ts                validação do formulário do cliente (zod)
src/lib/config.ts                   regras de negócio (sinal, antecedência, status)
src/app/(loja)/                     área pública: cardápio, carrinho/encomenda, página do pedido com o Pix
src/app/painel/                     login, pedidos (confirmar sinal), produtos — tudo exige admin
src/app/api/cron/manter-ativo/      ping diário para o Supabase não pausar
```

---

## O que foi testado

De ponta a ponta, com um Postgres de verdade, o PostgREST (o mesmo motor da API do Supabase) e navegador automatizado:

- carrinho, total, sinal de 30% (inclusive centavos), validações do formulário;
- produto inativo injetado no HTML é recusado, e nenhum pedido é criado com dados adulterados;
- o código Pix tem CRC válido (conferido com o exemplo oficial do Banco Central), o valor exato, a chave e o número do pedido, e o QR Code é lido corretamente;
- botão "copiar", WhatsApp do comprovante com número e valor;
- painel: contador de pedidos aguardando, "Confirmar sinal recebido", voltar/avançar status;
- a página pública do pedido não mostra endereço nem telefone;
- anônimo e usuário logado que não é admin não leem pedidos nem cadastram produtos (RLS e GRANTs testados no banco);
- o `schema.sql` novo aplicado por cima de um banco antigo (migração) funciona.

## Fica para depois (não está feito)
- Avisar a confeitaria quando entra pedido novo (hoje ela precisa abrir o painel).
- Limite de pedidos por dia (capacidade de produção).
- Produtos personalizados com preço "sob consulta" (bolo temático, por exemplo).
