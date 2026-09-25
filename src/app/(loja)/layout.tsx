import Image from "next/image";
import Link from "next/link";
import logo from "@/assets/logo.png";
import { CarrinhoProvider } from "@/components/Carrinho";
import { NOME_LOJA } from "@/lib/config";
import { linkWhatsApp } from "@/lib/formato";

const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_LOJA;

export default function LojaLayout({ children }: LayoutProps<"/">) {
  return (
    <CarrinhoProvider>
      <header className="border-b border-borda bg-cartao">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2">
          <Link href="/" aria-label={`${NOME_LOJA} — início`}>
            <Image src={logo} alt={`${NOME_LOJA} — Confeitaria Afetiva`} priority className="h-16 w-auto sm:h-20" />
          </Link>
          <Link href="/encomenda" className="btn-secundario whitespace-nowrap">
            Carrinho
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6">{children}</main>

      <footer className="border-t border-borda py-8 text-center text-sm text-suave">
        <p>{NOME_LOJA} · Salvador, BA</p>
        {whatsapp && (
          <p className="mt-1">
            Dúvidas?{" "}
            <a className="font-semibold text-marca underline" href={linkWhatsApp(whatsapp)} target="_blank" rel="noopener">
              Fale no WhatsApp
            </a>
          </p>
        )}
      </footer>
    </CarrinhoProvider>
  );
}
