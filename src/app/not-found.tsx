import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-titulo text-5xl text-marca">404</p>
      <p className="text-suave">Página não encontrada. Confira o link que você recebeu.</p>
      <Link href="/" className="btn-primario">
        Ver cardápio
      </Link>
    </main>
  );
}
