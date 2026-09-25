import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { assinaturaWebhookValida } from "@/lib/mercadopago";
import { registrarPagamentoDoSinal } from "@/lib/pagamentos";

/**
 * O Mercado Pago chama esta URL quando um pagamento muda de status.
 * Formato: POST /api/webhooks/mercadopago?data.id=123&type=payment
 */
export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  let tipo = url.searchParams.get("type") ?? url.searchParams.get("topic");
  let dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");

  if (!tipo || !dataId) {
    const corpo = (await request.json().catch(() => null)) as
      | { type?: string; data?: { id?: string | number } }
      | null;
    tipo ??= corpo?.type ?? null;
    dataId ??= corpo?.data?.id != null ? String(corpo.data.id) : null;
  }

  const assinaturaOk = assinaturaWebhookValida({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
    segredo: env.mpWebhookSecret(),
  });
  if (!assinaturaOk) {
    return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  }

  // Só nos interessam notificações de pagamento. O resto recebe 200 para o MP não reenviar.
  if (tipo !== "payment" || !dataId) {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  try {
    const resultado = await registrarPagamentoDoSinal(dataId);
    return NextResponse.json({ ok: true, resultado });
  } catch (erro) {
    console.error("[webhook] falha ao registrar pagamento", dataId, erro);
    // 500 faz o Mercado Pago tentar de novo mais tarde.
    return NextResponse.json({ erro: "falha temporária" }, { status: 500 });
  }
}
