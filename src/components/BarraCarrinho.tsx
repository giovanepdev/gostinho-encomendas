"use client";

import Link from "next/link";
import { useCarrinho } from "@/components/Carrinho";
import { formatarReais } from "@/lib/formato";

/** Barra fixa no rodapé com o resumo do carrinho. */
export function BarraCarrinho({ precos }: { precos: Record<string, number> }) {
  const { itens } = useCarrinho();

  let quantidade = 0;
  let total = 0;
  for (const [id, qtd] of Object.entries(itens)) {
    if (precos[id] === undefined) continue; // produto que saiu do cardápio
    quantidade += qtd;
    total += precos[id] * qtd;
  }

  if (quantidade === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-borda bg-cartao/95 px-4 py-3 shadow-[0_-4px_20px_rgba(47,29,20,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="whitespace-nowrap text-sm">
          <span className="font-semibold">{quantidade} {quantidade === 1 ? "item" : "itens"}</span>
          <span className="text-suave"> · {formatarReais(total)}</span>
        </div>
        <Link href="/encomenda" className="btn-primario whitespace-nowrap">
          Continuar →
        </Link>
      </div>
    </div>
  );
}
