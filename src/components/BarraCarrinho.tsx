"use client";

import Link from "next/link";
import { useCarrinho } from "@/components/Carrinho";
import { formatarReais } from "@/lib/formato";

/** Barra fixa no rodapé com o resumo do carrinho. */
export function BarraCarrinho({ precos }: { precos: Record<string, number> }) {
  const { itens } = useCarrinho();

  // Conta PRODUTOS, não unidades: "25 brigadeiros + 1 cento de coxinha" não soma 26 de nada.
  let produtos = 0;
  let total = 0;
  for (const [id, qtd] of Object.entries(itens)) {
    if (precos[id] === undefined) continue; // produto que saiu do cardápio
    produtos += 1;
    total += precos[id] * qtd;
  }

  if (produtos === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-borda bg-cartao/95 px-4 py-3 shadow-[0_-4px_20px_rgba(47,29,20,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="whitespace-nowrap text-sm">
          <span className="font-semibold">{produtos} {produtos === 1 ? "produto" : "produtos"}</span>
          <span className="text-suave"> · {formatarReais(total)}</span>
        </div>
        <Link href="/encomenda" className="btn-primario whitespace-nowrap">
          Continuar →
        </Link>
      </div>
    </div>
  );
}
