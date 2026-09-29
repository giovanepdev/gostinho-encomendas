import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import logo from "@/assets/logo.png";
import { CIDADE_LOJA, LINKS, NOME_LOJA, PERCENTUAL_SINAL, VERSICULOS } from "@/lib/config";
import { linkWhatsApp } from "@/lib/formato";

// Página inicial: é ESTE o link que vai na bio do Instagram.
// Separa os caminhos de compra (encomenda x pronta-entrega) para o cliente
// não entrar no lugar errado e desistir.

export const metadata: Metadata = {
  title: { absolute: `${NOME_LOJA} — Confeitaria Afetiva` },
  description: `Doces, salgados e bolos sob encomenda em ${CIDADE_LOJA}. Escolha, marque a data e pague ${PERCENTUAL_SINAL}% de sinal por Pix.`,
};

const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_LOJA;

export default function Inicio() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-10">
      <header className="text-center">
        <h1>
          <Image
            src={logo}
            alt={`${NOME_LOJA} — Confeitaria Afetiva`}
            priority
            className="mx-auto h-auto w-64 sm:w-72"
          />
        </h1>
        <p className="mt-4 text-balance font-titulo text-lg text-marca-escura">
          Doces e salgados feitos com carinho para a sua festa.
        </p>
        <Versiculo {...VERSICULOS.topo} />
      </header>

      <nav aria-label="Como fazer seu pedido" className="mt-8 space-y-3">
        <Caminho
          href="/cardapio"
          destaque
          titulo="Encomendas para festas"
          descricao={`Escolha no cardápio, marque a data e pague ${PERCENTUAL_SINAL}% de sinal por Pix.`}
        />
        {LINKS.ifood && (
          <Caminho
            href={LINKS.ifood}
            externo
            titulo="Pronta-entrega no iFood"
            descricao="O que já está pronto, com entrega pelo app."
          />
        )}
        {LINKS.instagram && (
          <Caminho href={LINKS.instagram} externo titulo="Instagram" descricao="Fotos, novidades e bastidores." />
        )}
        {whatsapp && (
          <Caminho
            href={linkWhatsApp(whatsapp, "Olá! Vim pelo link da bio.")}
            externo
            titulo="Fale com a gente no WhatsApp"
            descricao="Dúvidas ou um pedido especial."
          />
        )}
      </nav>

      <footer className="mt-auto pt-12 text-center text-sm text-suave">
        <Versiculo {...VERSICULOS.rodape} />
        <p className="mt-6">
          {NOME_LOJA} · {CIDADE_LOJA}
        </p>
        <p className="mt-1">
          <Link href="/privacidade" className="underline hover:text-marca">
            Privacidade
          </Link>
        </p>
      </footer>
    </main>
  );
}

/** Um caminho de compra: título grande + uma linha dizendo PARA QUEM é. */
function Caminho({
  href,
  titulo,
  descricao,
  destaque = false,
  externo = false,
}: {
  href: string;
  titulo: string;
  descricao: string;
  destaque?: boolean;
  externo?: boolean;
}) {
  const estilo = destaque
    ? "border-acao bg-acao text-white hover:bg-acao-escura"
    : "border-borda bg-cartao text-texto hover:border-marca";
  const conteudo = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{titulo}</span>
        <span className={`mt-0.5 block text-sm ${destaque ? "text-white" : "text-suave"}`}>{descricao}</span>
      </span>
      <span aria-hidden="true" className="text-xl">
        →
      </span>
    </>
  );
  const classe = `flex items-center gap-4 rounded-2xl border px-5 py-4 transition-colors ${estilo}`;

  return externo ? (
    <a href={href} target="_blank" rel="noopener" className={classe}>
      {conteudo}
    </a>
  ) : (
    <Link href={href} className={classe}>
      {conteudo}
    </Link>
  );
}

function Versiculo({ texto, referencia }: { texto: string; referencia: string }) {
  if (!texto) return null;
  return (
    <figure className="mt-5">
      <blockquote className="font-titulo italic text-marca-escura">“{texto}”</blockquote>
      {referencia && <figcaption className="mt-1 text-xs text-suave">{referencia}</figcaption>}
    </figure>
  );
}
