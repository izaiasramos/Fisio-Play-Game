// Lógica pura do Quiz — sem UI, fácil de testar.

/** Número de perguntas por rodada. */
export const QUIZ_TAMANHO = 8;

/** Tempo (segundos) para responder cada pergunta. */
export const SEGUNDOS_POR_PERGUNTA = 60;

/** Pontos base por acerto (antes do bônus de velocidade). */
export const PONTOS_ACERTO = 10;

/** Teto do bônus de velocidade (1 ponto por segundo restante, até este limite). */
export const BONUS_VELOCIDADE_MAX = 10;

/**
 * Pontos de uma pergunta:
 *   - erro/timeout → 0
 *   - acerto → PONTOS_ACERTO + 1 ponto por segundo restante, limitado a
 *     BONUS_VELOCIDADE_MAX (evita inflar demais com timers longos)
 */
export function calcularPontos(acertou: boolean, segundosRestantes: number): number {
  if (!acertou) return 0;
  const bonus = Math.min(BONUS_VELOCIDADE_MAX, Math.max(0, Math.floor(segundosRestantes)));
  return PONTOS_ACERTO + bonus;
}
