// Lógica pura do jogo "Verdadeiro ou Falso" — sem UI, fácil de testar.
// Gera afirmações "termo → definição": metade verdadeiras (a definição real do
// termo) e metade falsas (definição de OUTRO item). O jogador julga V ou F.

import type { Item } from "../data/schema";
import { embaralhar, type Rng } from "../lib/gerarQuiz";

/** Quantas afirmações entram numa rodada. */
export const AFIRMACOES_POR_RODADA = 8;

/** Pontos por afirmação julgada corretamente (base, antes dos bônus). */
export const PONTOS_POR_AFIRMACAO = 8;

/** Tempo (segundos) para julgar cada afirmação. */
export const SEGUNDOS_POR_AFIRMACAO = 15;

/** Teto do bônus de velocidade (1 ponto por segundo restante, até este limite). */
export const BONUS_VELOCIDADE_MAX = 6;

/** Bônus por acerto extra na sequência (combo). */
export const BONUS_SEQUENCIA_POR_ACERTO = 2;

/** Teto do bônus de sequência. */
export const BONUS_SEQUENCIA_MAX = 10;

/** Uma afirmação pronta para julgar. */
export type AfirmacaoVF = {
  id: string;
  trilhaId: string;
  termo: string;
  /** definição exibida (pode ser a errada, se a afirmação for falsa) */
  definicao: string;
  /** a associação termo↔definição está correta? */
  verdadeiro: boolean;
  /** a definição REAL do termo (para o feedback quando for falsa) */
  definicaoCorreta: string;
  fonte: string;
  urlFonte: string;
};

/**
 * Monta uma afirmação para um item-alvo.
 *  - `verdadeiro = true`  → usa a própria definição do alvo.
 *  - `verdadeiro = false` → usa a definição de outro item (associação errada).
 * Se não houver outro item com definição distinta, cai para verdadeira.
 */
export function montarAfirmacao(
  alvo: Item,
  itens: readonly Item[],
  verdadeiro: boolean,
  rng: Rng = Math.random
): AfirmacaoVF {
  const base = {
    id: `vf-${alvo.id}`,
    trilhaId: alvo.trilhaId,
    termo: alvo.termo,
    definicaoCorreta: alvo.definicao,
    fonte: alvo.fonte,
    urlFonte: alvo.urlFonte,
  };

  if (verdadeiro) {
    return { ...base, definicao: alvo.definicao, verdadeiro: true };
  }

  const outros = embaralhar(
    itens.filter((i) => i.termo !== alvo.termo && i.definicao !== alvo.definicao),
    rng
  );
  if (outros.length === 0) {
    return { ...base, definicao: alvo.definicao, verdadeiro: true };
  }
  return { ...base, definicao: outros[0].definicao, verdadeiro: false };
}

/** Monta uma rodada balanceada (~metade verdadeira, metade falsa), embaralhada. */
export function montarRodadaVF(
  itens: readonly Item[],
  n: number = AFIRMACOES_POR_RODADA,
  rng: Rng = Math.random
): AfirmacaoVF[] {
  const qtd = Math.max(1, Math.min(n, itens.length));
  const alvos = embaralhar(itens, rng).slice(0, qtd);
  const nVerd = Math.ceil(qtd / 2);
  const flags = embaralhar(
    [...Array(nVerd).fill(true), ...Array(qtd - nVerd).fill(false)] as boolean[],
    rng
  );
  return alvos.map((alvo, i) => montarAfirmacao(alvo, itens, flags[i], rng));
}

/** True se a resposta do jogador (V/F) bate com a afirmação. */
export function acertouVF(afirmacao: AfirmacaoVF, respostaVerdadeiro: boolean): boolean {
  return afirmacao.verdadeiro === respostaVerdadeiro;
}

/** Pontuação final (helper simples): acertos × PONTOS_POR_AFIRMACAO. */
export function calcularPontosVF(acertos: number): number {
  return Math.max(0, acertos) * PONTOS_POR_AFIRMACAO;
}

/**
 * Pontos de UMA afirmação, com bônus de velocidade e de sequência (combo):
 *   - erro/timeout → 0
 *   - acerto → base + min(segundosRestantes, teto) + bônus por combo,
 *     onde `sequenciaAtual` inclui este acerto (o 1º acerto não dá bônus de combo).
 */
export function pontosAfirmacao(
  acertou: boolean,
  segundosRestantes: number,
  sequenciaAtual: number
): number {
  if (!acertou) return 0;
  const velocidade = Math.min(
    BONUS_VELOCIDADE_MAX,
    Math.max(0, Math.floor(segundosRestantes))
  );
  const combo = Math.min(
    BONUS_SEQUENCIA_MAX,
    Math.max(0, sequenciaAtual - 1) * BONUS_SEQUENCIA_POR_ACERTO
  );
  return PONTOS_POR_AFIRMACAO + velocidade + combo;
}
