// Lógica pura do Jogo da Memória — sem UI, fácil de testar.
// O baralho tem 2 cartas por item: uma com o TERMO e outra com a DEFINIÇÃO.
// O jogador vira duas cartas por vez; casam quando pertencem ao mesmo item
// e são de lados opostos (termo ↔ definição).

import type { Item } from "../data/schema";
import { embaralhar, type Rng } from "../lib/gerarQuiz";

/** Quantos pares (itens) entram numa rodada. 6 pares = 12 cartas. */
export const PARES_POR_RODADA = 6;

/** Pontos por par encontrado. */
export const PONTOS_POR_PAR = 10;

/** Bônus por completar a rodada sem nenhum erro (partida "perfeita"). */
export const BONUS_SEM_ERRO = 20;

export type LadoCarta = "termo" | "definicao";

export type Carta = {
  /** id único da carta (para React keys e controle de virada). */
  id: string;
  /** id do Item de origem — duas cartas casam quando compartilham este id. */
  itemId: string;
  lado: LadoCarta;
  texto: string;
};

/**
 * Monta e embaralha o baralho: para cada item sorteado, cria a carta do termo
 * e a carta da definição. `pares` é limitado ao nº de itens disponíveis.
 */
export function montarBaralho(
  itens: readonly Item[],
  pares: number = PARES_POR_RODADA,
  rng: Rng = Math.random
): Carta[] {
  const qtd = Math.max(1, Math.min(pares, itens.length));
  const escolhidos = embaralhar(itens, rng).slice(0, qtd);
  const cartas: Carta[] = [];
  for (const it of escolhidos) {
    cartas.push({ id: `${it.id}-t`, itemId: it.id, lado: "termo", texto: it.termo });
    cartas.push({ id: `${it.id}-d`, itemId: it.id, lado: "definicao", texto: it.definicao });
  }
  return embaralhar(cartas, rng);
}

/** Duas cartas casam se são cartas diferentes, do mesmo item e de lados opostos. */
export function casaPar(a: Carta, b: Carta): boolean {
  return a.id !== b.id && a.itemId === b.itemId && a.lado !== b.lado;
}

/**
 * Pontuação final da rodada:
 *   base = paresEncontrados × PONTOS_POR_PAR
 *   + BONUS_SEM_ERRO se a partida foi perfeita (zero erros).
 */
export function calcularPontosMemoria(paresEncontrados: number, erros: number): number {
  const base = Math.max(0, paresEncontrados) * PONTOS_POR_PAR;
  return base + (erros === 0 ? BONUS_SEM_ERRO : 0);
}
