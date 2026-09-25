import type { Metadata } from "next";
import Image from "next/image";
import logo from "@/assets/logo.png";
import { FormLogin } from "./FormLogin";
import { NOME_LOJA } from "@/lib/config";

export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false, follow: false } };

export default async function PaginaLogin({ searchParams }: PageProps<"/painel/login">) {
  const { erro } = await searchParams;
  const aviso = erro === "sem-permissao" ? "Este usuário não tem acesso ao painel." : undefined;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
      <Image src={logo} alt={`${NOME_LOJA} — Confeitaria Afetiva`} priority className="h-28 w-auto" />
      <div className="cartao w-full max-w-sm p-6 shadow-[0_10px_25px_rgba(0,0,0,0.12)]">
        <h1 className="mb-6 text-center font-titulo text-2xl text-marca-escura">Painel de pedidos</h1>
        <FormLogin avisoInicial={aviso} />
      </div>
    </main>
  );
}
