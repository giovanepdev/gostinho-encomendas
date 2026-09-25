import Link from "next/link";
import { SeloStatus } from "@/components/StatusPedido";
import { exigirAdmin } from "@/lib/auth";
import { TIPOS_ENTREGA, type Status } from "@/lib/config";
import { formatarDataComDia, formatarReais, hojeMais, numeroPedido } from "@/lib/formato";
import type { Pedido } from "@/lib/tipos";

const FILTROS: Record<string, { rotulo: string; status: Status[] | null }> = {
  ativos: { rotulo: "A fazer", status: ["confirmado", "em_producao", "pronto"] },
  aguardando_sinal: { rotulo: "Aguardando sinal", status: ["aguardando_sinal"] },
  entregue: { rotulo: "Entregues", status: ["entregue"] },
  cancelado: { rotulo: "Cancelados", status: ["cancelado"] },
  todos: { rotulo: "Todos", status: null },
};

export default async function PainelPedidos({ searchParams }: PageProps<"/painel">) {
  const supabase = await exigirAdmin();
  const { filtro: filtroBruto } = await searchParams;
  const filtro = typeof filtroBruto === "string" && filtroBruto in FILTROS ? filtroBruto : "ativos";
  const { status } = FILTROS[filtro];

  let consulta = supabase
    .from("pedidos")
    .select("id, numero, cliente_nome, data_entrega, tipo_entrega, total, status, saldo_pago, sinal_pago_em")
    .limit(200);
  if (status) consulta = consulta.in("status", status);
  consulta =
    filtro === "ativos"
      ? consulta.order("data_entrega", { ascending: true })
      : consulta.order("criado_em", { ascending: false });

  const { data, error } = await consulta;
  if (error) throw new Error("Falha ao carregar pedidos");
  const pedidos = (data ?? []) as Pedido[];

  const hoje = hojeMais(0);
  const amanha = hojeMais(1);

  return (
    <>
      <h1 className="mb-4 font-titulo text-2xl">Pedidos</h1>

      <div className="mb-5 flex flex-wrap gap-2">
        {Object.entries(FILTROS).map(([chave, { rotulo }]) => (
          <Link
            key={chave}
            href={chave === "ativos" ? "/painel" : `/painel?filtro=${chave}`}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              chave === filtro ? "border-marca bg-marca text-white" : "border-borda bg-cartao hover:bg-marca-clara"
            }`}
          >
            {rotulo}
          </Link>
        ))}
      </div>

      {pedidos.length === 0 ? (
        <p className="cartao p-6 text-center text-suave">Nenhum pedido aqui.</p>
      ) : (
        <ul className="space-y-2">
          {pedidos.map((p) => {
            const devolverSinal = p.status === "cancelado" && p.sinal_pago_em;
            const destaque = p.data_entrega === hoje ? "Hoje" : p.data_entrega === amanha ? "Amanhã" : null;
            return (
              <li key={p.id}>
                <Link href={`/painel/pedidos/${p.id}`} className="cartao flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:border-marca">
                  <span className="font-mono text-sm text-suave">{numeroPedido(p.numero)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.cliente_nome}</span>
                  <span className="text-sm">
                    {destaque && <strong className="mr-1 text-marca">{destaque} ·</strong>}
                    {formatarDataComDia(p.data_entrega)} · {TIPOS_ENTREGA[p.tipo_entrega]}
                  </span>
                  <span className="text-sm tabular-nums">{formatarReais(p.total)}</span>
                  <SeloStatus status={p.status} />
                  {devolverSinal && <span className="text-xs font-semibold text-erro">Devolver sinal!</span>}
                  {p.status !== "cancelado" && p.sinal_pago_em && !p.saldo_pago && (
                    <span className="text-xs text-alerta">saldo pendente</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
