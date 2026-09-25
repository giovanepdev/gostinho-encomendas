import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pagarSinal } from "./actions";
import { LinhaDoTempo } from "@/components/StatusPedido";
import { TIPOS_ENTREGA } from "@/lib/config";
import { formatarDataComDia, formatarReais, linkWhatsApp, numeroPedido } from "@/lib/formato";
import { ehUuid, registrarPagamentoDoSinal } from "@/lib/pagamentos";
import { supabaseServico } from "@/lib/supabase/server";
import type { Pedido } from "@/lib/tipos";

export const metadata: Metadata = { title: "Seu pedido", robots: { index: false, follow: false } };

const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_LOJA;

export default async function PaginaPedido({ params, searchParams }: PageProps<"/pedido/[id]">) {
  const { id } = await params;
  const busca = await searchParams;
  if (!ehUuid(id)) notFound();

  // Voltando do Mercado Pago: confirma o pagamento na hora, sem esperar o webhook.
  const paymentId = typeof busca.payment_id === "string" ? busca.payment_id : null;
  if (paymentId && paymentId !== "null") {
    await registrarPagamentoDoSinal(paymentId).catch((e) => console.error("[pedido] confirmação no retorno", e));
  }

  // A URL do pedido tem um id impossível de adivinhar (UUID): quem tem o link, vê o pedido.
  // Por isso mostramos só o necessário (sem endereço e sem telefone completo).
  const { data } = await supabaseServico()
    .from("pedidos")
    .select(
      "id, numero, cliente_nome, data_entrega, tipo_entrega, total, valor_sinal, status, saldo_pago, sinal_pago_em, itens_pedido(id, nome_produto, unidade, preco_unitario, quantidade, subtotal)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const pedido = data as unknown as Pedido;
  const itens = pedido.itens_pedido ?? [];
  const primeiroNome = pedido.cliente_nome.split(" ")[0];
  const saldo = Number(pedido.total) - Number(pedido.valor_sinal);
  const statusMP = typeof busca.status === "string" ? busca.status : null;
  const erroPagamento = busca.erro === "pagamento";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-suave">Pedido {numeroPedido(pedido.numero)}</p>
        <h1 className="font-titulo text-3xl">
          {pedido.status === "aguardando_sinal" ? `Quase lá, ${primeiroNome}!` : `Obrigada, ${primeiroNome}!`}
        </h1>
      </div>

      {pedido.status === "aguardando_sinal" && (
        <div className="cartao space-y-3 border-alerta/40 bg-alerta/5 p-5">
          {statusMP === "pending" || statusMP === "in_process" ? (
            <p className="text-sm">
              Seu pagamento está <strong>em processamento</strong>. Assim que o Mercado Pago aprovar, o pedido é confirmado
              automaticamente — pode atualizar esta página daqui a pouco.
            </p>
          ) : (
            <p className="text-sm">
              {erroPagamento
                ? "Não conseguimos abrir o pagamento agora. Seu pedido está salvo — tente de novo:"
                : `Seu pedido está reservado. Para confirmar, pague o sinal de ${formatarReais(pedido.valor_sinal)}.`}
            </p>
          )}
          <form action={pagarSinal.bind(null, pedido.id)}>
            <button className="btn-primario w-full">Pagar sinal de {formatarReais(pedido.valor_sinal)}</button>
          </form>
        </div>
      )}

      {pedido.status === "confirmado" && (
        <p className="cartao border-sucesso/30 bg-sucesso/5 p-5 text-sm">
          ✓ Sinal recebido! Seu pedido está <strong>confirmado</strong>. Guarde o link desta página para acompanhar.
        </p>
      )}

      <section className="cartao space-y-4 p-5">
        <LinhaDoTempo status={pedido.status} />
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-suave">Entrega</dt>
            <dd className="font-medium">{formatarDataComDia(pedido.data_entrega)}</dd>
          </div>
          <div>
            <dt className="text-suave">Como</dt>
            <dd className="font-medium">{TIPOS_ENTREGA[pedido.tipo_entrega]}</dd>
          </div>
        </dl>
      </section>

      <section className="cartao p-5">
        <h2 className="mb-3 font-titulo text-xl">Itens</h2>
        <ul className="divide-y divide-borda text-sm">
          {itens.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-2">
              <span>
                {item.quantidade}× {item.nome_produto}{" "}
                <span className="text-suave">
                  ({formatarReais(item.preco_unitario)} / {item.unidade})
                </span>
              </span>
              <span className="tabular-nums">{formatarReais(item.subtotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-borda pt-3 text-sm">
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatarReais(pedido.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Sinal (50%)</dt>
            <dd className="tabular-nums">
              {formatarReais(pedido.valor_sinal)} {pedido.sinal_pago_em ? "✓ pago" : "· pendente"}
            </dd>
          </div>
          <div className="flex justify-between text-suave">
            <dt>Restante na entrega</dt>
            <dd className="tabular-nums">
              {formatarReais(saldo)} {pedido.saldo_pago ? "✓ pago" : ""}
            </dd>
          </div>
        </dl>
      </section>

      {whatsapp && (
        <a
          className="btn-secundario w-full"
          href={linkWhatsApp(whatsapp, `Olá! Sobre o pedido ${numeroPedido(pedido.numero)}...`)}
          target="_blank"
          rel="noopener"
        >
          Falar sobre este pedido no WhatsApp
        </a>
      )}
    </div>
  );
}
