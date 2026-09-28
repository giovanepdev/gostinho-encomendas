import { z } from "zod";
import {
  ANTECEDENCIA_MAX_DIAS,
  ANTECEDENCIA_MIN_DIAS,
  MAX_QUANTIDADE_POR_ITEM,
  ORDEM_ENTREGA,
  type TipoEntrega,
} from "./config";
import { formatarData, hojeMais } from "./formato";

const tiposEntrega = ORDEM_ENTREGA as [TipoEntrega, ...TipoEntrega[]];

/** Aceita "(71) 99999-8888", "+55 71 99999-8888" etc. Devolve só dígitos com DDD. */
function normalizarTelefone(valor: string): string {
  let d = valor.replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  return d;
}

const textoOpcional = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .max(max, msg)
    .transform((v) => (v === "" ? null : v));

export const esquemaEncomenda = z
  .object({
    cliente_nome: z.string().trim().min(2, "Informe seu nome").max(100, "Nome muito longo"),
    cliente_telefone: z
      .string()
      .transform(normalizarTelefone)
      .refine((d) => /^[1-9]{2}9?\d{8}$/.test(d), "Telefone inválido. Use DDD + número, ex.: (71) 99999-8888"),
    data_entrega: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data de entrega")
      .refine((d) => d >= hojeMais(ANTECEDENCIA_MIN_DIAS), {
        message: `A data precisa ser a partir de ${formatarData(hojeMais(ANTECEDENCIA_MIN_DIAS))}`,
      })
      .refine((d) => d <= hojeMais(ANTECEDENCIA_MAX_DIAS), "Data muito distante"),
    tipo_entrega: z.enum(tiposEntrega, "Escolha como vai receber"),
    endereco: textoOpcional(300, "Endereço muito longo"),
    observacoes: textoOpcional(500, "Observação muito longa (máx. 500 caracteres)"),
    itens: z
      .array(
        z.object({
          produto_id: z.uuid(),
          // O mínimo de cada produto (ex.: 25 por sabor) é conferido no banco, que sabe o número atual.
          quantidade: z
            .number()
            .int("Quantidade inválida")
            .min(1, "Quantidade inválida")
            .max(MAX_QUANTIDADE_POR_ITEM, `Máximo de ${MAX_QUANTIDADE_POR_ITEM} por produto pelo site. Para mais, chame no WhatsApp.`),
        }),
      )
      .min(1, "Seu carrinho está vazio")
      .max(30, "Itens demais num pedido só"),
  })
  .superRefine((dados, ctx) => {
    if (dados.tipo_entrega !== "retirada" && (!dados.endereco || dados.endereco.length < 5)) {
      ctx.addIssue({ code: "custom", path: ["endereco"], message: "Informe o endereço de entrega" });
    }
  });

export type DadosEncomenda = z.output<typeof esquemaEncomenda>;
