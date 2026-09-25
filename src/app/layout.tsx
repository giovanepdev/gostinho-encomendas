import type { Metadata, Viewport } from "next";
import { NOME_LOJA } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${NOME_LOJA} — Encomendas`, template: `%s · ${NOME_LOJA}` },
  description: "Doces e salgados sob encomenda. Escolha, agende a data e pague o sinal online.",
};

export const viewport: Viewport = {
  themeColor: "#5a020b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
