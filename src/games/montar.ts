// Lógica pura do jogo "Montar o corpo" — sem UI, fácil de testar.
//
// O jogador arrasta a PEÇA desenhada (o osso) até o lugar dela no tabuleiro.
// Diferente do "Arrastar na anatomia", onde ele arrasta um rótulo de texto até um
// ponto: aqui a peça tem forma, tamanho e um lugar certo.
//
// Regra de encaixe: a peça acerta quando o destino DELA é o mais próximo do
// ponto onde foi solta. Não exigimos posição precisa de propósito — no tabuleiro
// da perna, os centros da tíbia e da fíbula ficam a ~13 px um do outro numa tela
// de celular, e pedir precisão de 7 px seria injogável. A regra do "mais
// próximo" é generosa no absoluto e continua exigindo a anatomia certa: pôr a
// fíbula do lado medial erra, porque ali o destino mais próximo é o da tíbia.

import type { PecaCorpo, TabuleiroCorpo } from "../data/schema";
import { embaralhar, type Rng } from "../lib/gerarQuiz";

/** Pontos por peça encaixada sem usar dica. */
export const PONTOS_POR_PECA = 15;

/** Bônus por fechar a região inteira sem erro e sem dica. */
export const BONUS_REGIAO_LIMPA = 30;

/**
 * Distância máxima aceita, em unidades de LARGURA do tabuleiro. Acima disso a
 * peça voltou para a bandeja: solta longe é engano, não tentativa.
 */
export const RAIO_MAXIMO = 0.5;

/** Níveis de dica, do mais barato ao mais caro. */
export type NivelDica = 0 | 1 | 2 | 3;

/**
 * Quanto cada nível de dica deixa a peça valer. Nível 0 = sem dica.
 *   1 = acende a silhueta do lugar
 *   2 = revela o nome do osso
 *   3 = encaixa sozinha
 */
export const VALOR_POR_DICA: Record<NivelDica, number> = {
  0: PONTOS_POR_PECA,
  1: 10,
  2: 6,
  3: 0,
};

/** Peça na bandeja, aguardando ser arrastada. */
export type PecaNaBandeja = { id: string; nome: string };

/** Estado de uma peça já resolvida. */
export type PecaResolvida = { id: string; dica: NivelDica };

/**
 * Converte um ponto do tabuleiro (frações 0..1) para unidades de LARGURA.
 *
 * Sem isso, comparar dx com dy seria comparar coisas diferentes: num tabuleiro
 * de aspecto 0.28, uma fração de altura vale 3,5 vezes menos em pixels que a
 * mesma fração de largura.
 */
function emUnidadesDeLargura(x: number, y: number, aspecto: number): [number, number] {
  return [x, y / aspecto];
}

/** Distância entre dois pontos do tabuleiro, em unidades de largura. */
export function distanciaNoTabuleiro(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  aspecto: number
): number {
  const [x1, y1] = emUnidadesDeLargura(ax, ay, aspecto);
  const [x2, y2] = emUnidadesDeLargura(bx, by, aspecto);
  return Math.hypot(x1 - x2, y1 - y2);
}

/**
 * Id da peça cujo destino está mais próximo do ponto, ou `null` se o ponto caiu
 * longe de tudo. Considera todas as peças do tabuleiro (inclusive as já
 * encaixadas): é justamente a vizinhança que torna a escolha significativa.
 */
export function destinoMaisProximo(
  tabuleiro: TabuleiroCorpo,
  x: number,
  y: number
): string | null {
  let melhor: { id: string; d: number } | null = null;
  for (const p of tabuleiro.pecas) {
    const d = distanciaNoTabuleiro(x, y, p.destino.x, p.destino.y, tabuleiro.aspecto);
    if (melhor === null || d < melhor.d) melhor = { id: p.id, d };
  }
  if (melhor === null || melhor.d > RAIO_MAXIMO) return null;
  return melhor.id;
}

/**
 * A peça `pecaId`, solta em (x, y), encaixou?
 * Verdadeiro só quando o destino mais próximo do ponto é o dela.
 */
export function encaixou(
  tabuleiro: TabuleiroCorpo,
  pecaId: string,
  x: number,
  y: number
): boolean {
  return destinoMaisProximo(tabuleiro, x, y) === pecaId;
}

/** Peça pelo id (ou undefined). */
export function acharPeca(tabuleiro: TabuleiroCorpo, pecaId: string): PecaCorpo | undefined {
  return tabuleiro.pecas.find((p) => p.id === pecaId);
}

/** Bandeja inicial: todas as peças, em ordem aleatória. */
export function montarBandeja(
  tabuleiro: TabuleiroCorpo,
  rng: Rng = Math.random
): PecaNaBandeja[] {
  return embaralhar(
    tabuleiro.pecas.map((p) => ({ id: p.id, nome: p.nome })),
    rng
  );
}

/** Pontos de uma peça, considerando a dica mais cara que ela consumiu. */
export function pontosDaPeca(dica: NivelDica): number {
  return VALOR_POR_DICA[dica];
}

/**
 * Pontuação da região:
 *   soma dos pontos de cada peça (descontando dicas)
 *   + BONUS_REGIAO_LIMPA se fechou tudo sem erro e sem dica nenhuma.
 */
export function calcularPontosMontar(
  resolvidas: readonly PecaResolvida[],
  totalPecas: number,
  erros: number
): number {
  const base = resolvidas.reduce((s, r) => s + pontosDaPeca(r.dica), 0);
  const limpa =
    erros === 0 &&
    resolvidas.length === totalPecas &&
    resolvidas.every((r) => r.dica === 0);
  return base + (limpa ? BONUS_REGIAO_LIMPA : 0);
}

/** A região acabou quando toda peça encontrou o lugar. */
export function regiaoCompleta(
  resolvidas: readonly PecaResolvida[],
  totalPecas: number
): boolean {
  return resolvidas.length >= totalPecas;
}

/**
 * Próxima região da progressão: a de menor `ordem` que ainda não foi concluída.
 * `null` quando o jogador fechou todas.
 */
export function proximaRegiao(
  tabuleiros: readonly TabuleiroCorpo[],
  concluidas: ReadonlySet<string>
): TabuleiroCorpo | null {
  const pendentes = tabuleiros
    .filter((t) => !concluidas.has(t.id))
    .sort((a, b) => a.ordem - b.ordem);
  return pendentes[0] ?? null;
}

/**
 * Uma região está liberada quando todas as de `ordem` menor já foram concluídas
 * — a progressão é sequencial (uma perna, depois a outra, depois o tronco).
 */
export function regiaoLiberada(
  tabuleiros: readonly TabuleiroCorpo[],
  id: string,
  concluidas: ReadonlySet<string>
): boolean {
  const alvo = tabuleiros.find((t) => t.id === id);
  if (alvo === undefined) return false;
  return tabuleiros
    .filter((t) => t.ordem < alvo.ordem)
    .every((t) => concluidas.has(t.id));
}
