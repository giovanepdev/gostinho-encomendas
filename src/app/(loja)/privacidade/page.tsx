import type { Metadata } from "next";
import { CIDADE_LOJA, CNPJ_LOJA, NOME_LOJA } from "@/lib/config";
import { linkWhatsApp } from "@/lib/formato";

// Aviso de privacidade (LGPD — Lei nº 13.709/2018), em linguagem simples.
// Se mudar alguma coisa aqui, atualize a data no fim da página.

export const metadata: Metadata = {
  title: "Privacidade",
  description: `Como a ${NOME_LOJA} usa os dados informados nas encomendas.`,
};

const ATUALIZADO_EM = "28 de setembro de 2026";
const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_LOJA;

export default function Privacidade() {
  const contato = whatsapp ? (
    <a className="font-semibold text-marca underline" href={linkWhatsApp(whatsapp)} target="_blank" rel="noopener">
      WhatsApp da loja
    </a>
  ) : (
    "WhatsApp da loja"
  );

  return (
    <article className="mx-auto max-w-2xl space-y-8 leading-relaxed">
      <header>
        <h1 className="font-titulo text-3xl text-marca-escura">Privacidade</h1>
        <p className="mt-2 text-suave">
          Como usamos os dados que você informa quando faz uma encomenda. Sem juridiquês.
        </p>
      </header>

      <Secao titulo="Quem cuida dos seus dados">
        <p>
          A <strong>{NOME_LOJA}</strong> (CNPJ {CNPJ_LOJA}), de {CIDADE_LOJA}, é a responsável pelos dados informados neste
          site. Para qualquer assunto sobre seus dados, fale com a gente pelo {contato}.
        </p>
      </Secao>

      <Secao titulo="O que coletamos">
        <p>Quando você faz uma encomenda, guardamos:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>seu nome e seu WhatsApp;</li>
          <li>a data e a forma de entrega;</li>
          <li>o endereço, só se você escolher entrega por Uber ou 99;</li>
          <li>as observações que você escrever;</li>
          <li>os produtos, as quantidades e os valores do pedido.</li>
        </ul>
        <p>
          <strong>Não pedimos</strong> CPF, e-mail nem dados de cartão. O sinal é pago por Pix no app do seu banco: o
          site não recebe nem guarda dados da sua conta.
        </p>
        <p>
          Os produtos que você coloca no carrinho ficam guardados no seu próprio navegador, não no nosso sistema, até
          você fazer o pedido.
        </p>
        <p>
          Se você escrever nas observações alguma informação de saúde, como uma alergia, ela é usada só para preparar o
          seu pedido com segurança.
        </p>
      </Secao>

      <Secao titulo="Para que usamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>preparar e entregar a sua encomenda;</li>
          <li>conferir o pagamento do sinal;</li>
          <li>falar com você sobre o pedido, pelo WhatsApp.</li>
        </ul>
        <p>
          É para isso que você nos passa os dados: sem eles não dá para fazer a encomenda (LGPD, art. 7º, V).{" "}
          <strong>Não usamos seus dados para propaganda e não vendemos nem repassamos para ninguém.</strong>
        </p>
      </Secao>

      <Secao titulo="Onde os dados ficam">
        <p>
          O site funciona com serviços de tecnologia contratados: o <strong>Supabase</strong> guarda o banco de dados e a{" "}
          <strong>Netlify</strong> hospeda o site. Alguns desses serviços ficam fora do Brasil.
        </p>
        <p>
          Para barrar robôs, o formulário de encomenda usa a verificação da <strong>Cloudflare</strong> (Turnstile), que
          analisa dados técnicos do acesso, como o endereço IP e o navegador, só para saber se quem está pedindo é uma
          pessoa.
        </p>
        <p>
          Se a entrega for por Uber ou 99, o endereço é informado no aplicativo da corrida para a entrega acontecer.
        </p>
      </Secao>

      <Secao titulo="Por quanto tempo guardamos">
        <p>
          Enquanto o pedido estiver em andamento e por até <strong>5 anos</strong> depois da entrega, prazo usado para
          eventuais reclamações sobre o pedido. Se você pedir, apagamos antes, a não ser que alguma lei nos obrigue a
          manter.
        </p>
      </Secao>

      <Secao titulo="Seus direitos">
        <p>Você pode, a qualquer momento:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>saber se temos dados seus e quais são;</li>
          <li>corrigir dados errados;</li>
          <li>pedir que a gente apague seus dados;</li>
          <li>tirar dúvidas sobre como usamos.</li>
        </ul>
        <p>
          É só mandar mensagem no {contato}. Respondemos em até 15 dias. Se achar que não resolvemos, você pode
          reclamar na Autoridade Nacional de Proteção de Dados (ANPD), em{" "}
          <a className="text-marca underline" href="https://www.gov.br/anpd" target="_blank" rel="noopener">
            gov.br/anpd
          </a>
          .
        </p>
      </Secao>

      <Secao titulo="Cookies">
        <p>
          Este site não usa cookies de propaganda nem de rastreamento. Só o painel interno da confeitaria usa um cookie
          de login, e só para quem trabalha na loja.
        </p>
      </Secao>

      <p className="border-t border-borda pt-4 text-sm text-suave">Última atualização: {ATUALIZADO_EM}.</p>
    </article>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-titulo text-xl text-marca-escura">{titulo}</h2>
      {children}
    </section>
  );
}
