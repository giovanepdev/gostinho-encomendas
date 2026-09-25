import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { MAX_PARCELAS_SINAL, NOME_LOJA, VALIDADE_LINK_PAGAMENTO_HORAS } from "@/lib/config";
import { numeroPedido } from "@/lib/formato";

// Chamadas diretas à API REST do Mercado Pago (sem SDK: menos dependências,
// e a versão atual do SDK oficial puxa um pacote com vulnerabilidade conhecida).
// MP_API_URL só existe para testes automatizados (servidor falso); em produção fica vazio.
const API = process.env.MP_API_URL || "https://api.mercadopago.com";

type PedidoParaCobranca = {
  id: string;
  numero: number;
  valor_sinal: number | string;
  cliente_nome: string;
  cliente_email: string | null;
};

/**
 * Cria o link de pagamento (Checkout Pro) do SINAL.
 * O cliente paga no site do Mercado Pago (Pix ou cartão) — o nosso servidor
 * nunca vê número de cartão.
 */
export async function criarCobrancaSinal(pedido: PedidoParaCobranca) {
  const site = env.siteUrl();
  const expira = new Date(Date.now() + VALIDADE_LINK_PAGAMENTO_HORAS * 3600_000);
  const [primeiroNome, ...resto] = pedido.cliente_nome.trim().split(/\s+/);

  const corpo = {
    items: [
      {
        id: pedido.id,
        title: `Sinal 50% - Pedido ${numeroPedido(pedido.numero)} - ${NOME_LOJA}`,
        quantity: 1,
        unit_price: Number(pedido.valor_sinal),
        currency_id: "BRL",
      },
    ],
    payer: {
      name: primeiroNome,
      surname: resto.join(" ") || undefined,
      email: pedido.cliente_email ?? undefined,
    },
    external_reference: pedido.id,
    notification_url: `${site}/api/webhooks/mercadopago`,
    back_urls: {
      success: `${site}/pedido/${pedido.id}`,
      pending: `${site}/pedido/${pedido.id}`,
      failure: `${site}/pedido/${pedido.id}`,
    },
    auto_return: "approved",
    payment_methods: { installments: MAX_PARCELAS_SINAL },
    statement_descriptor: "GOSTINHOPROMESSA",
    expires: true,
    expiration_date_to: expira.toISOString(),
  };

  const resposta = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.mpAccessToken()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(corpo),
    cache: "no-store",
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    console.error("[mercadopago] erro ao criar preferência", resposta.status, detalhe);
    throw new Error("Falha ao gerar o pagamento no Mercado Pago");
  }

  const dados = (await resposta.json()) as { id: string; init_point: string };
  return { preferenceId: dados.id, urlPagamento: dados.init_point };
}

export type PagamentoMP = {
  id: number;
  status: string; // approved, pending, rejected, refunded, cancelled...
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
  payment_method_id: string; // pix, visa, master...
  payment_type_id: string; // bank_transfer, credit_card, debit_card...
  date_approved: string | null;
};

/** Busca o pagamento NA API do Mercado Pago (fonte da verdade; nunca confie no que chega na URL). */
export async function buscarPagamento(paymentId: string): Promise<PagamentoMP | null> {
  if (!/^\d{1,20}$/.test(paymentId)) return null;

  const resposta = await fetch(`${API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${env.mpAccessToken()}` },
    cache: "no-store",
  });

  if (resposta.status === 404) return null;
  if (!resposta.ok) {
    console.error("[mercadopago] erro ao buscar pagamento", paymentId, resposta.status);
    throw new Error("Falha ao consultar pagamento no Mercado Pago");
  }
  return (await resposta.json()) as PagamentoMP;
}

/**
 * Confere a assinatura do webhook (header x-signature), conforme a doc do Mercado Pago:
 *   manifest = "id:{data.id};request-id:{x-request-id};ts:{ts};"
 *   v1 = HMAC-SHA256(manifest, chave secreta do webhook) em hexadecimal
 * Partes ausentes são omitidas do manifest; data.id vem da query string, em minúsculas.
 */
export function assinaturaWebhookValida(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  segredo: string;
}): boolean {
  const { xSignature, xRequestId, dataId, segredo } = params;
  if (!xSignature) return false;

  const partes = Object.fromEntries(
    xSignature.split(",").map((parte) => {
      const [chave, ...valor] = parte.split("=");
      return [chave.trim(), valor.join("=").trim()];
    }),
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  let manifest = "";
  if (dataId) manifest += `id:${dataId.toLowerCase()};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;

  const esperado = createHmac("sha256", segredo).update(manifest).digest("hex");
  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
