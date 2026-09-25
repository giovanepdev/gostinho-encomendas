import { BarraCarrinho } from "@/components/BarraCarrinho";
import { Quantidade } from "@/components/Carrinho";
import { FotoProduto } from "@/components/FotoProduto";
import { ANTECEDENCIA_MIN_DIAS, CATEGORIAS, PERCENTUAL_SINAL, type Categoria } from "@/lib/config";
import { listarVitrine } from "@/lib/catalogo";
import { formatarReais } from "@/lib/formato";
import type { ProdutoVitrine } from "@/lib/tipos";

// Página estática, regenerada no máximo 1x por hora — e na hora quando
// sua irmã altera um produto no painel (revalidatePath("/")).
// Resultado: a vitrine abre rápido e quase não consome o banco.
export const revalidate = 3600;

export default async function Cardapio() {
  const produtos = await listarVitrine();

  const porCategoria = new Map<Categoria, ProdutoVitrine[]>();
  for (const p of produtos) {
    porCategoria.set(p.categoria, [...(porCategoria.get(p.categoria) ?? []), p]);
  }
  const precos = Object.fromEntries(produtos.map((p) => [p.id, p.preco]));

  return (
    <>
      <section className="mb-8 rounded-3xl bg-marca-clara px-5 py-6">
        <h1 className="font-titulo text-3xl text-marca-escura">Faça sua encomenda</h1>
        <ol className="mt-3 space-y-1 text-sm text-texto">
          <li>1. Escolha os doces e salgados.</li>
          <li>2. Informe a data (com pelo menos {ANTECEDENCIA_MIN_DIAS} dias de antecedência).</li>
          <li>3. Pague {PERCENTUAL_SINAL}% de sinal por Pix. O restante, na entrega.</li>
        </ol>
      </section>

      {produtos.length === 0 && (
        <p className="cartao p-6 text-center text-suave">O cardápio está sendo atualizado. Volte em breve!</p>
      )}

      {[...porCategoria.entries()].map(([categoria, lista]) => (
        <section key={categoria} className="mb-10">
          <h2 className="mb-4 font-titulo text-2xl">{CATEGORIAS[categoria]}</h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((p) => (
              <li key={p.id} className="cartao flex flex-col overflow-hidden">
                <div className="relative aspect-[4/3]">
                  <FotoProduto
                    src={p.foto}
                    nome={p.nome}
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex-1">
                    <h3 className="font-semibold">{p.nome}</h3>
                    {p.descricao && <p className="mt-1 line-clamp-3 text-sm text-suave">{p.descricao}</p>}
                  </div>
                  <p className="text-lg font-semibold text-marca-escura">
                    {formatarReais(p.preco)}
                    <span className="text-sm font-normal text-suave"> / {p.unidade}</span>
                  </p>
                  <Quantidade produtoId={p.id} rotulo={p.nome} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <BarraCarrinho precos={precos} />
    </>
  );
}
