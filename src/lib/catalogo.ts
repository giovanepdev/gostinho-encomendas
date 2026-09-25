import "server-only";
import { supabasePublico, urlFoto } from "@/lib/supabase/server";
import type { Produto, ProdutoVitrine } from "@/lib/tipos";

/** Produtos ativos, prontos para a vitrine. Usa o cliente público (RLS: só ativos). */
export async function listarVitrine(): Promise<ProdutoVitrine[]> {
  const { data, error } = await supabasePublico()
    .from("produtos")
    .select("id, nome, descricao, categoria, unidade, preco, foto_path")
    .eq("ativo", true)
    .order("categoria")
    .order("nome");

  // Lança o erro de propósito: numa revalidação que falha, o Next mantém a
  // versão anterior da página em vez de publicar um cardápio vazio.
  if (error) throw new Error(`Falha ao carregar o cardápio: ${error.message}`);

  return (data as Omit<Produto, "ativo">[]).map(({ foto_path, ...p }) => ({
    ...p,
    preco: Number(p.preco),
    foto: urlFoto(foto_path),
  }));
}
