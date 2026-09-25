import Link from "next/link";
import { FotoProduto } from "@/components/FotoProduto";
import { exigirAdmin } from "@/lib/auth";
import { CATEGORIAS } from "@/lib/config";
import { formatarReais } from "@/lib/formato";
import { urlFoto } from "@/lib/supabase/server";
import type { Produto } from "@/lib/tipos";

export default async function PainelProdutos() {
  const supabase = await exigirAdmin();
  const { data, error } = await supabase
    .from("produtos")
    .select("id, nome, descricao, categoria, unidade, preco, foto_path, ativo")
    .order("ativo", { ascending: false })
    .order("categoria")
    .order("nome");
  if (error) throw new Error("Falha ao carregar produtos");
  const produtos = (data ?? []) as Produto[];

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="font-titulo text-2xl">Produtos</h1>
        <Link href="/painel/produtos/novo" className="btn-primario">
          + Novo produto
        </Link>
      </div>

      {produtos.length === 0 ? (
        <p className="cartao p-6 text-center text-suave">Nenhum produto ainda. Cadastre o primeiro!</p>
      ) : (
        <ul className="space-y-2">
          {produtos.map((p) => (
            <li key={p.id}>
              <Link
                href={`/painel/produtos/${p.id}`}
                className={`cartao flex items-center gap-4 p-3 hover:border-marca ${p.ativo ? "" : "opacity-60"}`}
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                  <FotoProduto src={urlFoto(p.foto_path)} nome={p.nome} sizes="56px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.nome}</p>
                  <p className="text-xs text-suave">
                    {CATEGORIAS[p.categoria]} · {formatarReais(p.preco)} / {p.unidade}
                  </p>
                </div>
                {!p.ativo && <span className="text-xs font-semibold text-suave">Fora do cardápio</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
