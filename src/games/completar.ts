// Lógica pura do jogo "Complete a palavra" — sem UI, fácil de testar.
// A partir de um Item da trilha, oculta ~40% das letras do TERMO e oferece um
// banco de letras (as que faltam + alguns engodos) para o jogador preencher as
// lacunas, usando a DEFINIÇÃO como dica. Acentos são normalizados na comparação.

import type { Item } from "../data/schema";
import { embaralhar, type Rng } from "../lib/gerarQuiz";
import { ALFABETO, ehLetra, normalizar } from "./forca";

/** Quantas palavras entram numa rodada. */
export const PALAVRAS_POR_RODADA = 6;

/** Pontos por palavra completada corretamente. */
export const PONTOS_POR_PALAVRA = 10;

/** Fração das letras adivinháveis que ficam ocultas. */
export const FRACAO_OCULTA = 0.4;

/** Teto de lacunas por palavra (mantém o banco de letras gerenciável). */
export const MAX_OCULTAS = 6;

/** Letras "engodo" adicionadas ao banco além das necessárias. */
export const LETRAS_ENGODO = 3;

/** Mínimo de letras adivinháveis para um termo ser sorteável. */
export const MIN_LETRAS = 3;

/** Célula do termo para exibição. */
export type CelulaCompletar = {
  /** caractere original (com acento) */
  char: string;
  /** é letra adivinhável (A–Z após normalizar)? */
  ehLetra: boolean;
  /** é uma lacuna a preencher? */
  oculto: boolean;
};

/** Palavra pronta para jogar. */
export type PalavraCompletar = {
  id: string;
  trilhaId: string;
  termo: string;
  definicao: string;
  fonte: string;
  urlFonte: string;
  /** o termo decomposto em células (na ordem original) */
  celulas: CelulaCompletar[];
  /** letras corretas das lacunas, normalizadas, na ordem de aparição */
  gabarito: string[];
  /** banco de letras (gabarito + engodos), embaralhado, em maiúsculas */
  banco: string[];
};

/** Só termos com letras suficientes servem ao jogo. */
export function itensJogaveis(itens: readonly Item[]): Item[] {
  return itens.filter((i) => contarLetras(i.termo) >= MIN_LETRAS);
}

function contarLetras(termo: string): number {
  let n = 0;
  for (const c of termo) if (ehLetra(c)) n++;
  return n;
}

/** Monta uma palavra jogável: escolhe as lacunas e o banco de letras. */
export function montarPalavra(item: Item, rng: Rng = Math.random): PalavraCompletar {
  const chars = [...item.termo];
  const idxLetras = chars
    .map((c, i) => (ehLetra(c) ? i : -1))
    .filter((i) => i >= 0);

  const nOcultar = Math.min(
    MAX_OCULTAS,
    Math.max(1, Math.round(idxLetras.length * FRACAO_OCULTA))
  );
  const ocultas = new Set(embaralhar(idxLetras, rng).slice(0, nOcultar));

  const celulas: CelulaCompletar[] = chars.map((c, i) => ({
    char: c,
    ehLetra: ehLetra(c),
    oculto: ocultas.has(i),
  }));

  // gabarito na ordem de índice (mesma ordem das lacunas exibidas)
  const gabarito = chars
    .map((c, i) => (ocultas.has(i) ? normalizar(c) : null))
    .filter((c): c is string => c !== null);

  const engodos = embaralhar(ALFABETO, rng).slice(0, LETRAS_ENGODO);
  const banco = embaralhar([...gabarito, ...engodos], rng);

  return {
    id: item.id,
    trilhaId: item.trilhaId,
    termo: item.termo,
    definicao: item.definicao,
    fonte: item.fonte,
    urlFonte: item.urlFonte,
    celulas,
    gabarito,
    banco,
  };
}

/** Monta uma rodada com até `n` palavras distintas. */
export function montarRodadaCompletar(
  itens: readonly Item[],
  n: number = PALAVRAS_POR_RODADA,
  rng: Rng = Math.random
): PalavraCompletar[] {
  const pool = itensJogaveis(itens);
  const fonte = pool.length ? pool : itens.slice();
  const qtd = Math.max(1, Math.min(n, fonte.length));
  return embaralhar(fonte, rng)
    .slice(0, qtd)
    .map((it) => montarPalavra(it, rng));
}

/** True se as letras preenchidas correspondem exatamente ao gabarito (normalizado). */
export function acertouPalavra(
  palavra: PalavraCompletar,
  preenchidas: readonly string[]
): boolean {
  if (preenchidas.length !== palavra.gabarito.length) return false;
  return palavra.gabarito.every((g, i) => normalizar(preenchidas[i]) === g);
}

/** Pontuação final: acertos × PONTOS_POR_PALAVRA. */
export function calcularPontosCompletar(acertos: number): number {
  return Math.max(0, acertos) * PONTOS_POR_PALAVRA;
}
