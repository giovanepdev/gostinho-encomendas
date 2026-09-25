import { FUSO } from "./config";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarReais(valor: number | string): string {
  return brl.format(Number(valor));
}

/** "2026-10-03" -> "03/10/2026" (sem passar por Date, para não errar o dia por fuso). */
export function formatarData(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** "2026-10-03" -> "sábado, 03/10" */
export function formatarDataComDia(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-").map(Number);
  const semana = new Date(Date.UTC(ano, mes - 1, dia, 12)).toLocaleDateString("pt-BR", {
    weekday: "long",
    timeZone: "UTC",
  });
  const texto = `${semana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: FUSO,
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Data de hoje no fuso da loja, no formato YYYY-MM-DD, somando N dias. */
export function hojeMais(dias: number): string {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: FUSO }); // en-CA = YYYY-MM-DD
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return data.toISOString().slice(0, 10);
}

/** "71999998888" -> "(71) 99999-8888" */
export function formatarTelefone(digitos: string): string {
  const d = digitos.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

export function numeroPedido(numero: number): string {
  return `#${String(numero).padStart(4, "0")}`;
}

export function linkWhatsApp(digitos: string, mensagem?: string): string {
  const d = digitos.replace(/\D/g, "");
  const comPais = d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : "";
  return `https://wa.me/${comPais}${texto}`;
}
