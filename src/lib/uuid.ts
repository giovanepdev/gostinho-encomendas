const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Confere o formato antes de mandar para o banco (evita erro 500 com URL digitada errada). */
export function ehUuid(valor: string): boolean {
  return UUID.test(valor);
}
