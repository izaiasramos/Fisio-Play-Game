// Lógica pura do jogo Colunas A-B — sem UI, fácil de testar.
// Duas colunas embaralhadas de forma independente: a coluna ESQUERDA traz os
// TERMOS e a DIREITA traz as DEFINIÇÕES. O jogador liga cada termo à sua
// definição. Um par casa quando as duas cartas vêm do mesmo item e de lados opostos.

import type { Item } from "../data/schema";
import { embaralhar, type Rng } from "../lib/gerarQuiz";

/** Quantos pares (itens) entram numa rodada. */
export const PARES_POR_RODADA = 5;

/** Pontos por associação correta. */
export const PONTOS_POR_ACERTO = 10;

/** Bônus por completar a rodada sem nenhum erro. */
export const BONUS_SEM_ERRO = 20;

export type LadoColuna = "termo" | "definicao";

export type CartaColuna = {
  /** id único da carta (React keys / seleção). */
  id: string;
  /** id do Item de origem — duas cartas casam quando compartilham este id. */
  itemId: string;
  lado: LadoColuna;
  texto: string;
};

export type Colunas = { esquerda: CartaColuna[]; direita: CartaColuna[] };

/**
 * Monta as duas colunas: sorteia `pares` itens, cria a carta do termo (esquerda)
 * e a da definição (direita) de cada um, e embaralha cada coluna separadamente
 * (para o alinhamento visual não entregar as respostas).
 */
export function montarColunas(
  itens: readonly Item[],
  pares: number = PARES_POR_RODADA,
  rng: Rng = Math.random
): Colunas {
  const qtd = Math.max(1, Math.min(pares, itens.length));
  const escolhidos = embaralhar(itens, rng).slice(0, qtd);
  const esquerda: CartaColuna[] = escolhidos.map((it) => ({
    id: `${it.id}-t`,
    itemId: it.id,
    lado: "termo",
    texto: it.termo,
  }));
  const direita: CartaColuna[] = escolhidos.map((it) => ({
    id: `${it.id}-d`,
    itemId: it.id,
    lado: "definicao",
    texto: it.definicao,
  }));
  return { esquerda: embaralhar(esquerda, rng), direita: embaralhar(direita, rng) };
}

/** Duas cartas casam se são do mesmo item e de lados opostos (termo ↔ definição). */
export function casaColuna(a: CartaColuna, b: CartaColuna): boolean {
  return a.itemId === b.itemId && a.lado !== b.lado;
}

/**
 * Pontuação final:
 *   base = acertos × PONTOS_POR_ACERTO
 *   + BONUS_SEM_ERRO se a rodada foi perfeita (zero erros).
 */
export function calcularPontosColunas(acertos: number, erros: number): number {
  const base = Math.max(0, acertos) * PONTOS_POR_ACERTO;
  return base + (erros === 0 ? BONUS_SEM_ERRO : 0);
}
