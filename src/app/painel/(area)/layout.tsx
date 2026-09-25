import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import logo from "@/assets/logo.png";
import { sair } from "../actions";
import { exigirAdmin } from "@/lib/auth";
import { NOME_LOJA } from "@/lib/config";

export const metadata: Metadata = { title: "Painel", robots: { index: false, follow: false } };

export default async function PainelLayout({ children }: LayoutProps<"/painel">) {
  // Barra quem não é admin. (As páginas e actions checam de novo: o layout
  // não roda em toda navegação, então não pode ser a única proteção.)
  await exigirAdmin();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-borda bg-cartao">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
          <Link href="/painel" aria-label="Painel — pedidos">
            <Image src={logo} alt={NOME_LOJA} className="h-11 w-auto" />
          </Link>
          <Link href="/painel" className="font-medium hover:text-marca">
            Pedidos
          </Link>
          <Link href="/painel/produtos" className="font-medium hover:text-marca">
            Produtos
          </Link>
          <Link href="/" className="text-suave hover:text-marca" target="_blank">
            Ver site ↗
          </Link>
          <form action={sair} className="ml-auto">
            <button className="text-suave hover:text-erro">Sair</button>
          </form>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
