import Link from "next/link";
import { FormProduto } from "../FormProduto";
import { exigirAdmin } from "@/lib/auth";

export default async function NovoProduto() {
  await exigirAdmin();
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/painel/produtos" className="text-sm text-suave hover:text-marca">
        ← Produtos
      </Link>
      <h1 className="mb-5 mt-2 font-titulo text-2xl">Novo produto</h1>
      <FormProduto produto={null} fotoAtual={null} />
    </div>
  );
}
