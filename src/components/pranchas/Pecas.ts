// Registro das peças do jogo "Montar o corpo".
//
// Cada módulo `montar-*.ts` é gerado por scripts/gerar_montar.py e exporta um
// Record<idDaPeca, svg>. O `modulo` de cada tabuleiro (em anatomia-montar.json)
// aponta para uma chave daqui.

import { SVG_MONTAR_PERNA_DIR } from "./svg/montar-perna-dir";
import { SVG_MONTAR_PERNA_ESQ } from "./svg/montar-perna-esq";

export const PECAS_POR_MODULO: Record<string, Record<string, string>> = {
  "montar-perna-esq": SVG_MONTAR_PERNA_ESQ,
  "montar-perna-dir": SVG_MONTAR_PERNA_DIR,
};

/** SVG de uma peça, ou null se o módulo/peça não existir. */
export function svgDaPeca(modulo: string, pecaId: string): string | null {
  return PECAS_POR_MODULO[modulo]?.[pecaId] ?? null;
}
