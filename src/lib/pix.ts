// Gera o "Pix copia e cola" (BR Code) no padrão do Banco Central — o mesmo texto
// que vira QR Code. É montado aqui mesmo, sem API de banco e sem custo:
// o site só escreve um texto num formato combinado (EMV/TLV) com a chave,
// o valor e um identificador do pedido. Quem move o dinheiro é o banco do cliente.
//
// Formato: cada campo é  ID (2 dígitos) + TAMANHO (2 dígitos) + VALOR.
// Referência: "Manual de Padrões para Iniciação do Pix" (Banco Central).

function campo(id: string, valor: string): string {
  const tamanho = valor.length;
  if (tamanho > 99) throw new Error(`Campo Pix ${id} passou de 99 caracteres`);
  return `${id}${String(tamanho).padStart(2, "0")}${valor}`;
}

/** Nome e cidade só aceitam letras simples: tira acento e caracteres especiais. */
function limpar(texto: string, max: number): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF): o "dígito verificador" do código. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type DadosPix = {
  chave: string; // chave aleatória (recomendado: não expõe CPF nem telefone)
  nomeRecebedor: string; // até 25 caracteres
  cidade: string; // até 15 caracteres
  valor: number; // em reais
  identificador: string; // aparece no extrato de quem recebe, quando o banco mostra (até 25, só letras e números)
  descricao?: string; // mensagem que alguns apps mostram ao pagador
};

/**
 * Chave de CNPJ ou CPF vai no código SÓ com números ("12345678000190").
 * Se alguém configurar com pontuação ("12.345.678/0001-90"), o banco não acharia a chave.
 * Não mexe em chave aleatória (tem letras), e-mail (@) nem telefone (+55...).
 */
export function normalizarChave(chave: string): string {
  const limpa = chave.trim();
  if (/^[\d.\-/\s]+$/.test(limpa)) {
    const digitos = limpa.replace(/\D/g, "");
    if (digitos.length === 11 || digitos.length === 14) return digitos;
  }
  return limpa;
}

export function gerarPixCopiaECola(d: DadosPix): string {
  d = { ...d, chave: normalizarChave(d.chave) };
  if (!d.chave) throw new Error("Chave Pix não configurada");
  if (!(d.valor > 0)) throw new Error("Valor do Pix inválido");

  const txid = d.identificador.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  let contaRecebedor = campo("00", "br.gov.bcb.pix") + campo("01", d.chave.trim());
  if (d.descricao) {
    const comDescricao = contaRecebedor + campo("02", limpar(d.descricao, 40));
    if (comDescricao.length <= 99) contaRecebedor = comDescricao; // descrição é opcional: só entra se couber
  }

  const semCrc =
    campo("00", "01") + // versão do formato
    campo("26", contaRecebedor) +
    campo("52", "0000") + // categoria do comerciante (0000 = não informado)
    campo("53", "986") + // moeda: real
    campo("54", d.valor.toFixed(2)) +
    campo("58", "BR") +
    campo("59", limpar(d.nomeRecebedor, 25)) +
    campo("60", limpar(d.cidade, 15)) +
    campo("62", campo("05", txid)) +
    "6304"; // ID + tamanho do CRC, que entra no próprio cálculo

  return semCrc + crc16(semCrc);
}
