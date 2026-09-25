# Gostinho da Promessa — Site de encomendas

O cliente monta o pedido (vários produtos), escolhe a data e paga **50% de sinal** pelo Mercado Pago (Pix ou cartão).
Sua irmã acompanha tudo num **painel com login**: muda o status, marca o restante como pago e cadastra os produtos com foto.
Não tem **nenhuma** ligação com o sistema de estoque.

**Identidade visual:** as mesmas cores e a mesma logo do sistema de estoque (v1).

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind 4) · Supabase (Postgres, Auth e Storage) · Mercado Pago (Checkout Pro) · Vercel.

---

## ⚠️ Leia antes de colocar no ar

1. **O plano grátis da Vercel (Hobby) é só para uso pessoal e não comercial.** Isto aqui é uma loja, então é uso comercial.
   Você tem três caminhos: (a) pagar o Vercel Pro (US$ 20/mês); (b) hospedar o mesmo código na Netlify, cujo suporte já disse
   no fórum que o plano grátis aceita projeto comercial (a resposta é antiga, então confira os termos atuais); (c) ir para a Cloudflare.
   O código não depende de nada exclusivo da Vercel. A única exceção é o agendamento em `vercel.json` (veja o item 2).
2. **O Supabase grátis pausa o projeto depois de ~1 semana sem uso do banco.** Numa semana parada, o site sai do ar.
   A rota `/api/cron/manter-ativo` faz uma consulta por dia (agendada no `vercel.json`) para evitar isso.
   Se sair da Vercel, agende essa mesma URL em outro lugar (GitHub Actions, cron-job.org) enviando o header
   `Authorization: Bearer <CRON_SECRET>`.
3. **Teste tudo com as credenciais de TESTE do Mercado Pago antes de trocar para produção.**

---

## Como colocar no ar (passo a passo)

### 1. Supabase
1. Crie um projeto em supabase.com. Escolha a região **South America (São Paulo)**, porque a Vercel também vai rodar em São Paulo (`gru1`).
2. Vá em **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Vá em **Authentication → Users → Add user**, crie o usuário da sua irmã (e-mail e senha) e marque *Auto Confirm User*.
4. No SQL Editor, rode o comando abaixo trocando o e-mail:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'email-da-sua-irma@exemplo.com';
   ```
5. Vá em **Authentication → Sign In / Providers** e **desligue** "Allow new users to sign up".
6. Em **Project Settings → API Keys**, copie a URL, a *publishable key* e a *secret key*.

### 2. Mercado Pago
1. Entre em mercadopago.com.br/developers → **Suas integrações → Criar aplicação** (escolha Checkout Pro).
2. Em **Credenciais de teste**, copie o *Access Token*.
3. Em **Webhooks**, cadastre `https://SEU-SITE/api/webhooks/mercadopago`, marque o evento **Pagamentos** e copie a *assinatura secreta*.

### 3. Rodar no seu PC
```bash
npm install
cp .env.example .env.local   # no Windows: copy .env.example .env.local
# preencha o .env.local
npm run dev                  # http://localhost:3000  e  http://localhost:3000/painel
```
Rodando local, o webhook não chega (o Mercado Pago não alcança o seu localhost). Não tem problema: quando o cliente volta
do pagamento, a página do pedido consulta o Mercado Pago e confirma o sinal do mesmo jeito.

### 4. Vercel
1. Suba o projeto para o GitHub e faça **Import Project** na Vercel.
2. Em **Settings → Environment Variables**, cadastre todas as variáveis do `.env.example`, com `NEXT_PUBLIC_SITE_URL` = URL da Vercel.
3. Faça o deploy e depois atualize a URL do webhook no Mercado Pago.

---

## Como funciona (e por quê)

| Decisão | Motivo |
|---|---|
| **O preço é calculado no banco** (função `criar_pedido`), nunca no navegador | Qualquer um pode editar o HTML e mandar "brigadeiro a R$ 0,01". O navegador envia só *id do produto + quantidade*. |
| **Preço e nome são copiados para o item do pedido** | Se ela reajustar o preço amanhã, os pedidos antigos continuam com o valor da época. |
| **RLS em todas as tabelas** | A chave *publishable* fica exposta no navegador. Sem RLS, qualquer pessoa leria nome e telefone de todos os clientes. |
| **Tabela `admins` + `is_admin()`** | Ter login não basta: precisa estar na lista. Se o cadastro público for religado sem querer, a conta nova continua sem ver nada. |
| **`exigirAdmin()` em toda página e server action do painel** | Uma server action é um endpoint HTTP público. Esconder o botão não protege nada. |
| **O pagamento é confirmado consultando a API do Mercado Pago** | Não dá para confiar no que chega na URL ou no corpo do webhook. A assinatura do webhook é validada, e o valor pago é comparado com o sinal. |
| **Duas rotas de confirmação (webhook + retorno do cliente), ambas idempotentes** | Se o webhook atrasar, o cliente já vê o pedido confirmado. Rodar as duas não duplica nada. |
| **Pedido cancelado que foi pago continua cancelado**, com o alerta "Devolver sinal!" | O reembolso é manual (decisão sua). O painel avisa em vez de esconder. |
| **Cardápio em cache (ISR)**, atualizado na hora quando ela edita um produto | O site abre rápido e quase não gasta o banco. |
| **A foto é reduzida no navegador** (ex.: 5 MB → ~110 KB WebP) | O upload fica rápido no celular, os 1 GB grátis do Storage duram muito mais e a vitrine carrega leve. |
| **Sem o SDK do Mercado Pago** (chamadas `fetch` diretas) | A versão atual do SDK puxa uma dependência com vulnerabilidade conhecida, e o `fetch` resolve o que o site precisa. |

### Regras de negócio (todas em `src/lib/config.ts`)
- Antecedência mínima de **2 dias** e máxima de 90. **Se mudar, mude também o 90 em `schema.sql`.**
- Sinal fixo de **50%**, pago em **1x** (sem parcelamento, para não pagar a taxa de parcelas).
- O link de pagamento vale **24h**. Se expirar, a página do pedido tem o botão "Pagar sinal" para gerar outro.
- O restante é pago fora do site. Ela marca como pago no painel.
- Status: Aguardando sinal → Confirmado → Em produção → Pronto → Entregue (ou Cancelado).

### Mapa do código
```
supabase/schema.sql                 tabelas, função criar_pedido, RLS, bucket de fotos
src/proxy.ts                        renova a sessão e barra /painel sem login (1ª barreira)
src/lib/auth.ts                     exigirAdmin() — a barreira de verdade no servidor
src/lib/mercadopago.ts              cria o link do sinal, busca pagamento, valida assinatura do webhook
src/lib/pagamentos.ts               registra o sinal pago (usado pelo webhook e pelo retorno)
src/lib/validacao.ts                validação do formulário do cliente (zod)
src/app/(loja)/                     área pública: cardápio, carrinho/encomenda, página do pedido
src/app/painel/                     login, pedidos, produtos (tudo exige admin)
src/app/api/webhooks/mercadopago/   recebe as notificações do Mercado Pago
src/app/api/cron/manter-ativo/      ping diário para o Supabase não pausar
```

---

## O que foi testado

Tudo foi rodado de ponta a ponta com um Postgres de verdade, o PostgREST (o mesmo motor da API do Supabase) e um
Mercado Pago simulado. Foram 57 verificações automatizadas e 56 passaram. A única falha é do próprio ambiente de teste:
o otimizador de imagens do Next recusa fotos vindas de `localhost` (é uma proteção contra SSRF), e isso não acontece
com o Supabase de verdade. Entre as verificações:

- carrinho, cálculo do total e do sinal, e validações do formulário;
- produto inativo injetado no HTML é recusado e nenhum pedido é criado com dados adulterados;
- webhook com assinatura falsa é rejeitado; o válido confirma; o repetido não duplica;
- pagamento com valor errado ou ainda pendente não confirma;
- a página pública do pedido não mostra endereço nem telefone;
- anônimo e usuário logado que não é admin não leem pedidos nem cadastram produtos (RLS testado no banco);
- login, status, "restante pago", cadastro, edição e exclusão de produto com foto.

**Não foi testado contra o Supabase e o Mercado Pago reais** (precisa das suas contas). O login foi testado contra um
servidor de autenticação simulado. No primeiro deploy, faça um pedido de teste completo com as credenciais de teste.

## Fica para depois (não está feito)
- Avisar sua irmã quando entra pedido novo (hoje ela precisa abrir o painel). O próximo passo mais útil é um e-mail ou uma mensagem no WhatsApp.
- Limite de pedidos por dia (capacidade de produção).
- Produtos personalizados com preço "sob consulta" (bolo temático, por exemplo).
- Logo em alta resolução: a atual (`src/assets/logo.png`) foi recortada do PNG da v1 e tem só 277 px de largura, então fica levemente borrada em telas de celular. Exporte do Canva em PNG transparente, com ~1000 px de largura, e substitua o arquivo.
