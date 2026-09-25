"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { criarEncomenda, type EstadoEncomenda } from "./actions";
import { Quantidade, useCarrinho } from "@/components/Carrinho";
import { FotoProduto } from "@/components/FotoProduto";
import { ORDEM_ENTREGA, PERCENTUAL_SINAL, TIPOS_ENTREGA, type TipoEntrega } from "@/lib/config";
import { formatarReais } from "@/lib/formato";
import type { ProdutoVitrine } from "@/lib/tipos";

type Props = { produtos: ProdutoVitrine[]; dataMin: string; dataMax: string };

export function FormEncomenda({ produtos, dataMin, dataMax }: Props) {
  const { itens, carregado, limpar } = useCarrinho();
  const [estado, enviar, enviando] = useActionState<EstadoEncomenda, FormData>(criarEncomenda, {});
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>("retirada");

  const erroCampo = estado.campos ?? {};

  useEffect(() => {
    if (!estado.redirecionar) return;
    limpar();
    window.location.assign(estado.redirecionar);
  }, [estado.redirecionar, limpar]);

  const linhas = produtos
    .filter((p) => itens[p.id])
    .map((p) => ({ produto: p, quantidade: itens[p.id], subtotal: p.preco * itens[p.id] }));
  const total = linhas.reduce((soma, l) => soma + l.subtotal, 0);
  // Em centavos, como o banco faz (evita diferença de 1 centavo por arredondamento)
  const sinal = Math.round((Math.round(total * 100) * PERCENTUAL_SINAL) / 100) / 100;
  const itensJson = JSON.stringify(linhas.map((l) => ({ produto_id: l.produto.id, quantidade: l.quantidade })));

  // onSubmit (em vez de action=): o React 19 "reseta" o formulário depois de uma
  // action; com erro de validação o cliente perderia o que digitou e o rádio de
  // entrega voltaria para "retirada" sem a tela perceber. Assim nada é resetado.
  function aoEnviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => enviar(dados));
  }

  if (!carregado) return <p className="text-suave">Carregando…</p>;

  if (linhas.length === 0 && !estado.redirecionar) {
    return (
      <div className="cartao p-8 text-center">
        <p className="text-suave">Seu carrinho está vazio.</p>
        <Link href="/" className="btn-primario mt-4">
          Ver cardápio
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <form onSubmit={aoEnviar} className="order-2 space-y-5 lg:order-1" noValidate>
        <input type="hidden" name="itens" value={itensJson} />
        <input type="text" name="site" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

        <fieldset className="cartao space-y-4 p-5">
          <legend className="px-1 font-titulo text-xl">Seus dados</legend>
          <Campo nome="cliente_nome" rotulo="Nome completo" erro={erroCampo.cliente_nome}>
            <input id="cliente_nome" name="cliente_nome" className="campo" autoComplete="name" required maxLength={100} />
          </Campo>
          <Campo nome="cliente_telefone" rotulo="WhatsApp (com DDD)" erro={erroCampo.cliente_telefone}>
            <input id="cliente_telefone" name="cliente_telefone" className="campo" type="tel" inputMode="tel" autoComplete="tel" placeholder="(71) 99999-8888" required />
          </Campo>
          <Campo nome="cliente_email" rotulo="E-mail (opcional, para o comprovante)" erro={erroCampo.cliente_email}>
            <input id="cliente_email" name="cliente_email" className="campo" type="email" autoComplete="email" />
          </Campo>
        </fieldset>

        <fieldset className="cartao space-y-4 p-5">
          <legend className="px-1 font-titulo text-xl">Entrega</legend>
          <Campo nome="data_entrega" rotulo="Data" erro={erroCampo.data_entrega}>
            <input id="data_entrega" name="data_entrega" className="campo" type="date" min={dataMin} max={dataMax} required />
          </Campo>

          <div>
            <span className="rotulo">Como vai receber?</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {ORDEM_ENTREGA.map((valor) => [valor, TIPOS_ENTREGA[valor]] as const).map(([valor, rotulo]) => (
                <label key={valor} className="flex cursor-pointer items-center gap-2 rounded-xl border border-borda px-3 py-2.5 text-sm has-[:checked]:border-marca has-[:checked]:bg-marca-clara">
                  <input type="radio" name="tipo_entrega" value={valor} checked={tipoEntrega === valor} onChange={() => setTipoEntrega(valor)} className="accent-marca" />
                  {rotulo}
                </label>
              ))}
            </div>
            {erroCampo.tipo_entrega && <p className="mt-1 text-sm text-erro">{erroCampo.tipo_entrega}</p>}
          </div>

          {tipoEntrega !== "retirada" && (
            <Campo nome="endereco" rotulo="Endereço de entrega" erro={erroCampo.endereco}>
              <textarea id="endereco" name="endereco" className="campo" rows={2} maxLength={300} placeholder="Rua, número, bairro, ponto de referência" />
              <p className="mt-1 text-xs text-suave">A corrida do {TIPOS_ENTREGA[tipoEntrega].replace("Entrega por ", "")} é combinada à parte pelo WhatsApp.</p>
            </Campo>
          )}

          <Campo nome="observacoes" rotulo="Observações (opcional)" erro={erroCampo.observacoes}>
            <textarea id="observacoes" name="observacoes" className="campo" rows={3} maxLength={500} placeholder="Sabor, tema, horário preferido…" />
          </Campo>
        </fieldset>

        {estado.erro && (
          <p role="alert" className="rounded-xl bg-erro/10 px-4 py-3 text-sm text-erro">
            {estado.erro}
          </p>
        )}

        <button type="submit" className="btn-primario w-full py-3.5 text-base" disabled={enviando || !!estado.redirecionar}>
          {enviando || estado.redirecionar ? "Enviando pedido…" : "Fazer pedido"}
        </button>
        <p className="text-center text-xs text-suave">
          Na próxima tela aparece o Pix do sinal ({PERCENTUAL_SINAL}% = {formatarReais(sinal)}). O pedido é confirmado assim que o pagamento for conferido.
        </p>
      </form>

      <aside className="order-1 lg:order-2">
        <div className="cartao sticky top-4 p-5">
          <h2 className="mb-4 font-titulo text-xl">Resumo</h2>
          <ul className="divide-y divide-borda">
            {linhas.map(({ produto, subtotal }) => (
              <li key={produto.id} className="flex gap-3 py-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                  <FotoProduto src={produto.foto} nome={produto.nome} sizes="56px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{produto.nome}</p>
                  <p className="text-xs text-suave">
                    {formatarReais(produto.preco)} / {produto.unidade}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <Quantidade produtoId={produto.id} rotulo={produto.nome} compacto />
                    <span className="text-sm font-semibold tabular-nums">{formatarReais(subtotal)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-borda pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Total</dt>
              <dd className="font-semibold tabular-nums">{formatarReais(total)}</dd>
            </div>
            <div className="flex justify-between text-marca-escura">
              <dt>Sinal por Pix ({PERCENTUAL_SINAL}%)</dt>
              <dd className="font-semibold tabular-nums">{formatarReais(sinal)}</dd>
            </div>
            <div className="flex justify-between text-suave">
              <dt>Restante na entrega</dt>
              <dd className="tabular-nums">{formatarReais(total - sinal)}</dd>
            </div>
          </dl>
          <Link href="/" className="mt-4 block text-center text-sm font-medium text-marca underline">
            + Adicionar mais itens
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Campo({ nome, rotulo, erro, children }: { nome: string; rotulo: string; erro?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={nome} className="rotulo">
        {rotulo}
      </label>
      {children}
      {erro && <p className="mt-1 text-sm text-erro">{erro}</p>}
    </div>
  );
}
