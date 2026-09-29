import type { Metadata, Viewport } from "next";
import { NOME_LOJA } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  // Sem isto, a imagem de pré-visualização (quando o link é compartilhado no WhatsApp)
  // sairia apontando para "localhost" no site publicado.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: `${NOME_LOJA} — Confeitaria Afetiva`, template: `%s · ${NOME_LOJA}` },
  description: "Doces, salgados e bolos sob encomenda em Salvador. Escolha, marque a data e pague o sinal por Pix.",
  openGraph: {
    siteName: NOME_LOJA,
    locale: "pt_BR",
    type: "website",
  },
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
