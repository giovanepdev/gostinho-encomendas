"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// O carrinho guarda SÓ id do produto e quantidade.
// Preço e nome vêm sempre do banco (o servidor recalcula tudo ao criar o pedido).
type Itens = Record<string, number>;

type Carrinho = {
  itens: Itens;
  carregado: boolean;
  definir: (produtoId: string, quantidade: number) => void;
  limpar: () => void;
};

const CHAVE = "gdp-carrinho-v1";
const MAX_QTD = 100;
const Contexto = createContext<Carrinho | null>(null);

function lerDoNavegador(): Itens {
  try {
    const bruto = localStorage.getItem(CHAVE);
    const dados = bruto ? JSON.parse(bruto) : {};
    const limpo: Itens = {};
    for (const [id, qtd] of Object.entries(dados)) {
      const n = Math.floor(Number(qtd));
      if (typeof id === "string" && n > 0) limpo[id] = Math.min(n, MAX_QTD);
    }
    return limpo;
  } catch {
    return {};
  }
}

export function CarrinhoProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<Itens>({});
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage só existe no navegador; ler aqui evita erro de hidratação
    setItens(lerDoNavegador());
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(itens));
    } catch {
      // modo privado / armazenamento cheio: o carrinho funciona só nesta aba
    }
  }, [itens, carregado]);

  const definir = useCallback((produtoId: string, quantidade: number) => {
    setItens((atual) => {
      const n = Math.max(0, Math.min(MAX_QTD, Math.floor(quantidade)));
      const novo = { ...atual };
      if (n === 0) delete novo[produtoId];
      else novo[produtoId] = n;
      return novo;
    });
  }, []);

  const limpar = useCallback(() => setItens({}), []);

  const valor = useMemo(() => ({ itens, carregado, definir, limpar }), [itens, carregado, definir, limpar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCarrinho(): Carrinho {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useCarrinho precisa estar dentro de <CarrinhoProvider>");
  return ctx;
}

export function Quantidade({
  produtoId,
  rotulo,
  compacto = false,
}: {
  produtoId: string;
  rotulo: string;
  compacto?: boolean;
}) {
  const { itens, definir, carregado } = useCarrinho();
  const qtd = itens[produtoId] ?? 0;

  if (qtd === 0) {
    return (
      <button
        type="button"
        className={compacto ? "btn-secundario px-4 py-1.5" : "btn-primario w-full"}
        disabled={!carregado}
        onClick={() => definir(produtoId, 1)}
      >
        Adicionar
      </button>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-2 ${compacto ? "" : "w-full"}`}>
      <button
        type="button"
        className="btn-secundario h-10 w-10 p-0 text-lg"
        aria-label={`Diminuir ${rotulo}`}
        onClick={() => definir(produtoId, qtd - 1)}
      >
        −
      </button>
      <span className="min-w-8 text-center font-semibold tabular-nums" aria-live="polite">
        {qtd}
      </span>
      <button
        type="button"
        className="btn-secundario h-10 w-10 p-0 text-lg"
        aria-label={`Aumentar ${rotulo}`}
        disabled={qtd >= MAX_QTD}
        onClick={() => definir(produtoId, qtd + 1)}
      >
        +
      </button>
    </div>
  );
}
