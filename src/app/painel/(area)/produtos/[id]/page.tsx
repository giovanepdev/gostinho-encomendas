import Link from "next/link";
import { notFound } from "next/navigation";
import { FormProduto } from "../FormProduto";
import { excluirProduto } from "../../../actions";
import { BotaoConfirmar } from "@/components/BotaoConfirmar";
import { exigirAdmin } from "@/lib/auth";
import { ehUuid } from "@/lib/uuid";
import { urlFoto } from "@/lib/supabase/server";
import type { Produto } from "@/lib/tipos";

export default async function EditarProduto({ params }: PageProps<"/painel/produtos/[id]">) {
  const supabase = await exigirAdmin();
  const { id } = await params;
  if (!ehUuid(id)) notFound();

  const { data } = await supabase
    .from("produtos")
    .select("id, nome, descricao, categoria, unidade, preco, foto_path, ativo")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const produto = data as Produto;

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/painel/produtos" className="text-sm text-suave hover:text-marca">
        ← Produtos
      </Link>
      <h1 className="mb-5 mt-2 font-titulo text-2xl">Editar produto</h1>
      <FormProduto produto={produto} fotoAtual={urlFoto(produto.foto_path)} />

      <form action={excluirProduto.bind(null, produto.id)} className="mt-10 border-t border-borda pt-5">
        <p className="mb-2 text-sm text-suave">
          Prefira desmarcar “No cardápio” para esconder o produto. Excluir é definitivo (pedidos antigos continuam
          mostrando o nome e o preço da época).
        </p>
        <BotaoConfirmar mensagem={`Excluir "${produto.nome}" definitivamente?`} className="btn-secundario text-erro">
          Excluir produto
        </BotaoConfirmar>
      </form>
    </div>
  );
}
