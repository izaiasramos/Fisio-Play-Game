// Lógica pura do jogo "Arrastar na anatomia" — sem UI, fácil de testar.
// O jogador arrasta chips de rótulo sobre uma imagem; cada chip deve cair no
// alvo (hotspot) correspondente. Detecção de acerto por proximidade em px.

import type { AlvoAnatomia, PranchaAnatomia } from "../data/schema";
import { embaralhar, type Rng } from "../lib/gerarQuiz";
import { RAIO_ALVO_PADRAO } from "../lib/loadPranchas";

/** Pontos por alvo posicionado corretamente. */
export const PONTOS_POR_ALVO = 12;

/** Bônus por completar a prancha sem nenhum erro. */
export const BONUS_SEM_ERRO = 20;

/** Chip arrastável (o id casa com o id do alvo correto). */
export type ChipArrastar = { id: string; rotulo: string };

/** Embaralha os chips (um por alvo) para o banco. */
export function montarChips(prancha: PranchaAnatomia, rng: Rng = Math.random): ChipArrastar[] {
  return embaralhar(
    prancha.alvos.map((a) => ({ id: a.id, rotulo: a.rotulo })),
    rng
  );
}

/**
 * Id do alvo mais próximo do ponto (px, relativo à imagem exibida) dentro da
 * tolerância; `null` se nenhum alvo estiver ao alcance. Ignora `resolvidos`.
 */
export function alvoNoPonto(
  alvos: readonly AlvoAnatomia[],
  px: number,
  py: number,
  imgW: number,
  imgH: number,
  resolvidos: ReadonlySet<string> = new Set()
): string | null {
  let melhor: { id: string; d: number } | null = null;
  for (const a of alvos) {
    if (resolvidos.has(a.id)) continue;
    const ax = a.x * imgW;
    const ay = a.y * imgH;
    const d = Math.hypot(px - ax, py - ay);
    const raioPx = (a.raio ?? RAIO_ALVO_PADRAO) * imgW;
    if (d <= raioPx && (!melhor || d < melhor.d)) melhor = { id: a.id, d };
  }
  return melhor ? melhor.id : null;
}

/**
 * Pontuação final:
 *   base = acertos × PONTOS_POR_ALVO
 *   + BONUS_SEM_ERRO se completou todos os alvos sem erros.
 */
export function calcularPontosArrastar(
  acertos: number,
  totalAlvos: number,
  erros: number
): number {
  const base = Math.max(0, acertos) * PONTOS_POR_ALVO;
  const bonus = erros === 0 && acertos === totalAlvos ? BONUS_SEM_ERRO : 0;
  return base + bonus;
}
