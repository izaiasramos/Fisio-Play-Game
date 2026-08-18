// Gamificação — cálculo puro de nível a partir do XP.

/** XP necessário para subir cada nível. */
export const XP_POR_NIVEL = 100;

/** Nível atual (começa em 1). */
export function nivelDoXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_POR_NIVEL) + 1;
}

/** Progresso dentro do nível atual, de 0 a 1 (para barra de XP). */
export function progressoNoNivel(xp: number): number {
  return (Math.max(0, xp) % XP_POR_NIVEL) / XP_POR_NIVEL;
}

/** Quanto XP falta para o próximo nível. */
export function xpParaProximoNivel(xp: number): number {
  return XP_POR_NIVEL - (Math.max(0, xp) % XP_POR_NIVEL);
}
