# Gostinho da Promessa — Site de encomendas

O cliente monta o pedido (vários produtos), escolhe a data e paga **30% de sinal por Pix**, direto na conta da confeitaria.
O código Pix (QR e "copia e cola") é gerado pelo site para cada pedido, já com o valor exato.
A confeitaria confere o Pix no extrato e confirma o pedido num **painel com login**. No painel ela também muda o status,
marca o restante como pago e cadastra os produtos com foto. Não tem **nenhuma** ligação com o sistema de estoque.

**Identidade visual:** as mesmas cores e a mesma logo do sistema de estoque (v1).

**Páginas:**

| Endereço | O que é |
|---|---|
| `/` | Página inicial — é **este** o link da bio do Instagram. Separa encomenda (site) de pronta-entrega (iFood) |
| `/cardapio` | Cardápio e carrinho |
| `/encomenda` | Dados do cliente e data de entrega (mostra os dias sem vaga) |
| `/pedido/…` | Página do pedido com o Pix do sinal |
| `/privacidade` | Aviso de privacidade (LGPD) |
| `/painel` | Painel da confeitaria (exige login de admin) |

**Links da página inicial:** iFood, Instagram e os versículos ficam em `src/lib/config.ts` (`LINKS` e `VERSICULOS`).
Enquanto estiverem vazios (`""`), o botão ou o versículo simplesmente não aparece.

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind 4) · Supabase (Postgres, Auth e Storage) · Pix (BR Code gerado no próprio site) · Netlify.

---

## ⚠️ Leia antes de colocar no ar

1. **Netlify grátis = 300 créditos/mês com limite rígido.** Se estourar, o site para até o mês virar.
   **Cada publicação (deploy) custa 15 créditos.** Teste tudo no seu PC e só publique quando estiver pronto.
2. **O Supabase grátis pausa o projeto depois de ~1 semana sem uso do banco.** A tarefa agendada
   `netlify/functions/manter-ativo.mts` faz uma consulta mínima por dia para evitar isso (só roda no site publicado;
   para testar, use "Run now" na Netlify).
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
   ⚠️ **Com o site já no ar**, se o `schema.sql` novo mudou a função `criar_pedido`, o site publicado
   para de aceitar pedidos até o deploy do código novo terminar. Rode o schema e publique em seguida.
3. **Authentication → Users → Add user**: crie os usuários do painel (marque *Auto Confirm User*) e rode:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email in ('email1@exemplo.com', 'email2@exemplo.com')
   on conflict (user_id) do nothing;
   ```
4. **Authentication → Sign In / Providers**: **desligue** "Allow new users to sign up".
5. **Project Settings → API Keys**: copie a URL, a *publishable key* e a *secret key*.

### 2. Pix
Use uma chave Pix da conta que vai receber, o nome do titular e a cidade no `.env.local`.
A chave aparece para o cliente dentro do código Pix. Por isso: **CNPJ** (dado público) ou **chave aleatória**
são boas escolhas; CPF, e-mail pessoal e telefone não. CNPJ pode ser digitado com ou sem pontuação.

### 3. Cloudflare Turnstile (anti-robô do formulário)
1. Crie uma conta grátis em cloudflare.com → menu **Turnstile** → **Add widget**.
2. Nome: `gostinho-encomendas`. Hostnames: o endereço do site na Netlify (ex.: `gostinho-encomendas.netlify.app`)
   e, quando existir, o domínio próprio. Modo: **Managed**.
3. Copie a **Site Key** (pública) e a **Secret Key** (secreta, só na Netlify).
4. No seu PC, use as **chaves de teste** da Cloudflare (já estão no `.env.example`): funcionam em `localhost`
   e sempre passam. As chaves de verdade não aceitam `localhost`.

### 4. No seu PC
```bash
npm install
copy .env.example .env.local   # Linux/Mac: cp .env.example .env.local
# preencha o .env.local
npm run dev                    # http://localhost:3000  e  http://localhost:3000/painel
```

### 5. Publicar na Netlify
1. **Add new project → Import an existing project → GitHub** → escolha `gostinho-encomendas`.
2. Antes de clicar em Deploy, em **Environment variables**, cadastre as mesmas variáveis do `.env.local`
   (as 3 do Supabase, as 3 do Pix, o WhatsApp e as 2 do Turnstile, **com as chaves de verdade**).
   Marque como *secret* só `SUPABASE_SECRET_KEY` e `TURNSTILE_SECRET_KEY`. A Netlify detecta o Next.js sozinha.
   **Mudou variável na Netlify? Só vale depois de um novo deploy.**
3. Deploy. Cada publicação gasta 15 créditos: só dê `git push` na `main` quando estiver testado no PC.

---

## Como funciona (e por quê)

| Decisão | Motivo |
|---|---|
| **O preço e o sinal são calculados no banco** (função `criar_pedido`), nunca no navegador | Qualquer um pode editar o HTML e mandar "brigadeiro a R$ 0,01". O navegador envia só *id do produto + quantidade*. |
| **Preço e nome são copiados para o item do pedido** | Se o preço mudar amanhã, os pedidos antigos continuam com o valor da época. |
| **Sinal por Pix direto, sem intermediário** | Sem taxa, dinheiro na hora na conta dela, menos peças para quebrar, e sem risco de contestação de cartão (chargeback). |
| **Código Pix gerado pelo site (BR Code/EMV) com valor exato e número do pedido** | O cliente não digita valor (não erra), e o Pix chega identificado (`PED0001`). Não precisa de API de banco. |
| **Chave Pix de CNPJ (ou aleatória)** | O código Pix é público; chave de CPF ou telefone exporia dados pessoais. |
| **Turnstile (Cloudflare) no formulário, conferido no servidor** | O pedido é criado com a chave de serviço; sem isso, um script criaria milhares de pedidos e afogaria o painel. É grátis e quase sempre invisível para o cliente. |
| **Limites dentro do `criar_pedido`** (por WhatsApp, por hora e por dia) | Só o servidor chama essa função, então ninguém pula a regra. Uma trava no banco impede que dois pedidos simultâneos peguem a mesma última vaga. |
| **Sem limite por IP** | Operadora de celular no Brasil põe centenas de clientes atrás do mesmo IP (CGNAT): bloquearia cliente de verdade. E IP é mais um dado pessoal para guardar. |
| **Sem e-mail do cliente** | Era coletado e nunca usado. LGPD: não guardar o que não usa. |
| **Pedido mínimo é um campo de cada produto**, e não "toda categoria doce = 25" | Bolo não tem mínimo, e amanhã pode existir um salgado com regra diferente. Com o campo, ela resolve no painel, sem deploy. |
| **Quantidade digitável no carrinho** | Pedido de festa tem 100, 300 unidades: ninguém clica 300 vezes no +. |
| **Página inicial em `/` e cardápio em `/cardapio`** | O link da bio é o endereço principal do site. Quando entrar domínio próprio, ele já aponta para a porta de entrada certa, sem mudar nada. |
| **Uma frase sob cada botão da página inicial** | São dois caminhos de compra (encomenda e iFood). Se o cliente não entender em 2 segundos qual é o dele, entra no errado e desiste. |
| **Dias sem vaga avisados antes de enviar** | O calendário do celular não deixa "apagar" dias. Então o site lista os dias cheios e avisa na hora em que o cliente escolhe um deles. |
| **A regra "este pedido ocupa vaga?" é uma função só no banco** (`ocupa_vaga`) | O aviso da tela e a recusa na hora de gravar usam a mesma regra. Se ela mudar, as duas mudam juntas. |
| **Link do pedido dentro da mensagem de WhatsApp** | O cliente só volta à página do pedido pelo link (é de propósito: ninguém adivinha o pedido dos outros). Indo na mensagem, o link fica guardado na conversa. |
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
- No máximo **5 pedidos por dia de entrega** (`MAX_PEDIDOS_POR_DIA`). Conta pedidos, não tamanho: pedido grande
  que não cabe ela cancela no painel e devolve o sinal. Pedido cancelado libera a vaga.
- Pedido sem sinal segura a vaga do dia (e conta no limite do WhatsApp) por **24 horas** (`RESERVA_SEM_SINAL_HORAS`).
  Depois disso para de contar, mas continua no painel para ela cancelar.
- No máximo **3 pedidos esperando sinal por WhatsApp**, e **20 pedidos por hora no site inteiro** (disjuntor contra
  ataque: o site pausa novos pedidos por até uma hora, o WhatsApp continua funcionando). Esses dois ficam no `schema.sql`.
- **Pedido mínimo por produto** (campo "Pedido mínimo" no cadastro do painel), contado **por sabor** e na unidade
  de venda do produto: 25 brigadeiros + 25 beijinhos pode; 10 brigadeiros + 15 beijinhos não (a regra da confeitaria
  para doces e salgados de festa é 25 por sabor). Bolo: mínimo 1. Ao cadastrar, o painel sugere 25 para doce/salgado
  e 1 para bolo/outro (`PEDIDO_MINIMO_PADRAO`), mas o que vale é o número salvo em cada produto — ela muda sem deploy.
  O banco confere (não só a tela). Depois do mínimo, vale qualquer número.
- **Bolos**: categoria própria; cada tamanho é um produto (ex.: "Bolo de chocolate — M, 20 fatias").
- No máximo **1000 de um mesmo produto** por pedido (`MAX_QUANTIDADE_POR_ITEM`). É trava técnica contra erro de
  digitação, não a capacidade dela (o máximo real por sabor ainda não foi definido).
- Mudar qualquer número daqui = um deploy (15 créditos na Netlify).
- O restante é pago na entrega, fora do site. Ela marca como pago no painel.
- Status: Aguardando sinal → Confirmado → Em produção → Pronto → Entregue (ou Cancelado).
  Voltar para "Aguardando sinal" desfaz a confirmação; avançar o status marca o sinal como recebido.

### Mapa do código
```
supabase/schema.sql                 tabelas, criar_pedido, ocupa_vaga/datas_lotadas, RLS, permissões, fotos
src/proxy.ts                        renova a sessão e barra /painel sem login (1ª barreira)
src/lib/auth.ts                     exigirAdmin() — a barreira de verdade no servidor
src/lib/pix.ts                      monta o "Pix copia e cola" (BR Code) com CRC16
src/lib/validacao.ts                validação do formulário do cliente (zod)
src/lib/config.ts                   regras de negócio (sinal, antecedência, limites, pedido mínimo, status)
src/app/page.tsx                    página inicial (link da bio) · opengraph-image.png: prévia no WhatsApp
src/app/(loja)/                     cardápio, encomenda, página do pedido com o Pix, privacidade
src/lib/agenda.ts                   datas sem vaga (mesma regra do criar_pedido)
src/app/painel/                     login, pedidos (confirmar sinal), produtos — tudo exige admin
netlify/functions/manter-ativo.mts   consulta diária para o Supabase não pausar (Netlify)
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
- o `schema.sql` novo aplicado por cima de um banco antigo (migração) funciona;
- limites: 4º pedido do mesmo WhatsApp recusado, 6º pedido do mesmo dia recusado (com aviso no campo da data),
  cancelado libera vaga, pedido sem sinal há mais de 24 h para de contar, 21º pedido na mesma hora recusado;
  12 pedidos **simultâneos** para um dia com 5 vagas → exatamente 5 criados;
- Turnstile: botão só libera depois da verificação; sem token o servidor recusa e nada é gravado;
  token aceito, recusado, Cloudflare fora do ar (deixa passar, os limites do banco continuam valendo);
- pedido mínimo: 24 recusado e 25 aceito; o mesmo sabor em duas linhas soma; produto por cento com mínimo 1;
  "Adicionar" já coloca 25; digitar 10 sobe para 25 e 5000 desce para 1000; carrinho antigo abaixo do mínimo
  bloqueia o envio; burlando a tela, o servidor recusa e diz qual produto; migração marca 25 só uma vez
  (rodar o schema de novo não desfaz o que ela mudou no painel);
- painel: mínimo sugerido pela categoria, não muda sozinho em produto já cadastrado, 0 recusado;
  categoria Bolos e ordem das seções no cardápio; link do pedido na mensagem de WhatsApp;
- datas lotadas: o formulário lista os dias sem vaga e avisa na hora se o cliente escolher um deles; a regra é a
  mesma do banco (confirmado ocupa, sem sinal há mais de 24 h não ocupa, cancelado não ocupa); se a data lotar
  enquanto o cliente preenche, o banco recusa na hora de gravar; só o servidor consegue consultar a agenda;
- página inicial (botões escondidos quando o link está vazio, prévia para WhatsApp com o endereço do site),
  privacidade e rodapé, tudo sem rolagem para o lado no celular.

## Fica para depois (não está feito)
- Avisar a confeitaria quando entra pedido novo (hoje ela precisa abrir o painel).
- Produtos personalizados com preço "sob consulta" (bolo temático, por exemplo).
