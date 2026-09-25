import type { Categoria, Status, TipoEntrega } from "./config";

export type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: Categoria;
  unidade: string;
  preco: number;
  foto_path: string | null;
  ativo: boolean;
};

/** Produto já pronto para mostrar na tela (com URL da foto). */
export type ProdutoVitrine = Omit<Produto, "ativo" | "foto_path"> & { foto: string | null };

export type ItemPedido = {
  id: string;
  nome_produto: string;
  unidade: string;
  preco_unitario: number;
  quantidade: number;
  subtotal: number;
};

export type Pedido = {
  id: string;
  numero: number;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string | null;
  data_entrega: string;
  tipo_entrega: TipoEntrega;
  endereco: string | null;
  observacoes: string | null;
  total: number;
  valor_sinal: number;
  status: Status;
  saldo_pago: boolean;
  sinal_pago_em: string | null;
  criado_em: string;
  itens_pedido?: ItemPedido[];
};
