import Link from "next/link";
import { notFound } from "next/navigation";
import { alterarStatus, alternarSaldoPago, confirmarSinal } from "../../../actions";
import { SeloStatus } from "@/components/StatusPedido";
import { exigirAdmin } from "@/lib/auth";
import { PERCENTUAL_SINAL, STATUS, TIPOS_ENTREGA } from "@/lib/config";
import {
  formatarDataComDia,
  formatarDataHora,
  formatarReais,
  formatarTelefone,
  linkWhatsApp,
  numeroPedido,
} from "@/lib/formato";
import { ehUuid } from "@/lib/uuid";
import type { Pedido } from "@/lib/tipos";


export default async function DetalhePedido({ params }: PageProps<"/painel/pedidos/[id]">) {
  const supabase = await exigirAdmin();
  const { id } = await params;
  if (!ehUuid(id)) notFound();

  const { data } = await supabase
    .from("pedidos")
    .select("*, itens_pedido(id, nome_produto, unidade, preco_unitario, quantidade, subtotal)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const p = data as Pedido;
  const saldo = Number(p.total) - Number(p.valor_sinal);
  const primeiroNome = p.cliente_nome.split(" ")[0];

  return (
    <div className="space-y-5">
      <Link href="/painel" className="text-sm text-suave hover:text-marca">
        ← Pedidos
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-titulo text-2xl">Pedido {numeroPedido(p.numero)}</h1>
        <SeloStatus status={p.status} />
      </div>

      {p.status === "cancelado" && p.sinal_pago_em && (
        <p className="rounded-xl bg-erro/10 px-4 py-3 text-sm text-erro">
          Pedido cancelado com sinal pago ({formatarReais(p.valor_sinal)}). Lembre de devolver ao cliente.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="cartao space-y-3 p-5 text-sm">
          <h2 className="font-titulo text-lg">Cliente</h2>
          <p className="text-base font-medium">{p.cliente_nome}</p>
          <p>
            <a
              className="font-semibold text-marca underline"
              href={linkWhatsApp(p.cliente_telefone, `Olá, ${primeiroNome}! Aqui é da Gostinho da Promessa, sobre o pedido ${numeroPedido(p.numero)}.`)}
              target="_blank"
              rel="noopener"
            >
              {formatarTelefone(p.cliente_telefone)} (WhatsApp)
            </a>
          </p>
          {p.cliente_email && <p>{p.cliente_email}</p>}
          <hr className="border-borda" />
          <p>
            <strong>{formatarDataComDia(p.data_entrega)}</strong> · {TIPOS_ENTREGA[p.tipo_entrega]}
          </p>
          {p.endereco && <p className="whitespace-pre-line">{p.endereco}</p>}
          {p.observacoes && (
            <p className="whitespace-pre-line rounded-xl bg-marca-clara p-3">
              <strong>Obs.:</strong> {p.observacoes}
            </p>
          )}
          <p className="text-xs text-suave">Feito em {formatarDataHora(p.criado_em)}</p>
        </section>

        <section className="cartao space-y-4 p-5 text-sm">
          <h2 className="font-titulo text-lg">Andamento</h2>

          {p.status === "aguardando_sinal" && (
            <div className="space-y-2 rounded-xl border border-alerta/40 bg-alerta/5 p-3">
              <p>
                Aguardando o Pix de <strong>{formatarReais(p.valor_sinal)}</strong>. Confira no <strong>extrato do banco</strong>{" "}
                — não confie só no print do comprovante (pode ser falso ou um Pix agendado que nunca cai).
              </p>
              <form action={confirmarSinal.bind(null, p.id)}>
                <button className="btn-primario w-full">Confirmar sinal recebido</button>
              </form>
            </div>
          )}

          {/* key={p.status}: recria o select quando o status muda no servidor
              (um select "não controlado" não atualiza sozinho com o novo defaultValue) */}
          <form key={p.status} action={alterarStatus.bind(null, p.id)} className="flex gap-2">
            <select name="status" defaultValue={p.status} className="campo flex-1" aria-label="Status do pedido">
              {Object.entries(STATUS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
            <button className="btn-primario">Salvar</button>
          </form>

          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt>Total</dt>
              <dd className="font-semibold tabular-nums">{formatarReais(p.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Sinal ({PERCENTUAL_SINAL}%)</dt>
              <dd className="tabular-nums">
                {formatarReais(p.valor_sinal)}{" "}
                {p.sinal_pago_em ? (
                  <span className="text-sucesso">✓ Pix recebido</span>
                ) : (
                  <span className="text-alerta">pendente</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Restante</dt>
              <dd className="tabular-nums">
                {formatarReais(saldo)}{" "}
                {p.saldo_pago ? <span className="text-sucesso">✓ pago</span> : <span className="text-alerta">a receber</span>}
              </dd>
            </div>
          </dl>
          {p.sinal_pago_em && (
            <p className="text-xs text-suave">
              Sinal confirmado em {formatarDataHora(p.sinal_pago_em)}
            </p>
          )}

          <form action={alternarSaldoPago.bind(null, p.id, !p.saldo_pago)}>
            <button className="btn-secundario w-full">
              {p.saldo_pago ? "Desmarcar restante como pago" : `Marcar restante (${formatarReais(saldo)}) como pago`}
            </button>
          </form>
        </section>
      </div>

      <section className="cartao p-5 text-sm">
        <h2 className="mb-3 font-titulo text-lg">Itens</h2>
        <ul className="divide-y divide-borda">
          {(p.itens_pedido ?? []).map((i) => (
            <li key={i.id} className="flex justify-between gap-4 py-2">
              <span>
                <strong className="tabular-nums">{i.quantidade}×</strong> {i.nome_produto}{" "}
                <span className="text-suave">({i.unidade})</span>
              </span>
              <span className="tabular-nums">{formatarReais(i.subtotal)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
