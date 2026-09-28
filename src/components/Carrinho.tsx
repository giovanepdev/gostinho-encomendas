"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MAX_QUANTIDADE_POR_ITEM } from "@/lib/config";

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
const MAX_QTD = MAX_QUANTIDADE_POR_ITEM;
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

/**
 * Controle de quantidade de um produto: "Adicionar" já coloca o pedido mínimo dele
 * (ex.: 25 brigadeiros), o número pode ser digitado (ninguém clica 100 vezes no +)
 * e o − no mínimo tira o produto do carrinho.
 */
export function Quantidade({
  produtoId,
  rotulo,
  minimo = 1,
  compacto = false,
}: {
  produtoId: string;
  rotulo: string;
  minimo?: number;
  compacto?: boolean;
}) {
  const { itens, definir, carregado } = useCarrinho();
  const qtd = itens[produtoId] ?? 0;
  // Texto enquanto a pessoa digita; só vira quantidade ao sair do campo (ou Enter).
  const [digitando, setDigitando] = useState<string | null>(null);

  if (qtd === 0) {
    return (
      <button
        type="button"
        className={compacto ? "btn-secundario px-4 py-1.5" : "btn-primario w-full"}
        disabled={!carregado}
        onClick={() => definir(produtoId, minimo)}
      >
        Adicionar
      </button>
    );
  }

  function confirmarDigitado() {
    if (digitando === null) return;
    const n = Number.parseInt(digitando, 10);
    setDigitando(null);
    // Vazio ou zero: mantém o que estava (para tirar do carrinho existe o botão ×).
    if (!Number.isFinite(n) || n <= 0) return;
    // Abaixo do mínimo sobe para o mínimo; acima do teto desce para o teto.
    definir(produtoId, Math.min(MAX_QTD, Math.max(minimo, n)));
  }

  const noMinimo = qtd <= minimo;
  const abaixoDoMinimo = qtd < minimo; // carrinho antigo, de antes da regra do mínimo

  return (
    <div className={`flex items-center justify-between gap-2 ${compacto ? "" : "w-full"}`}>
      <button
        type="button"
        className="btn-secundario h-10 w-10 p-0 text-lg"
        aria-label={noMinimo ? `Remover ${rotulo}` : `Diminuir ${rotulo}`}
        title={noMinimo ? "Remover do carrinho" : undefined}
        onClick={() => definir(produtoId, noMinimo ? 0 : qtd - 1)}
      >
        {noMinimo ? "×" : "−"}
      </button>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`Quantidade de ${rotulo}`}
        aria-invalid={abaixoDoMinimo || undefined}
        className={`h-10 w-16 rounded-lg border bg-cartao text-center font-semibold tabular-nums outline-none focus:border-marca focus:ring-2 focus:ring-marca/20 ${
          abaixoDoMinimo ? "border-erro text-erro" : "border-borda"
        }`}
        value={digitando ?? String(qtd)}
        onFocus={(e) => {
          setDigitando(String(qtd));
          e.currentTarget.select();
        }}
        onChange={(e) => setDigitando(e.target.value.replace(/\D/g, "").slice(0, 5))}
        onBlur={confirmarDigitado}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault(); // não envia formulário nenhum
            e.currentTarget.blur();
          }
        }}
      />
      <button
        type="button"
        className="btn-secundario h-10 w-10 p-0 text-lg"
        aria-label={`Aumentar ${rotulo}`}
        disabled={qtd >= MAX_QTD}
        onClick={() => definir(produtoId, Math.max(qtd + 1, minimo))}
      >
        +
      </button>
    </div>
  );
}
