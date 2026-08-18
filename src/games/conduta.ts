// Lógica pura do jogo "Qual a conduta?" — raciocínio clínico, sem UI.
// Sorteia N mini-casos e embaralha as opções de cada um. Suporta dois modos:
//   - "single": uma única conduta correta (formato legado).
//   - "multi":  várias condutas válidas + distratores; o jogador marca TODAS
//               as adequadas (multi-conduta).

import type { CasoClinico, NivelEvidencia } from "../data/schema";
import { embaralhar, type Rng } from "../lib/gerarQuiz";

/** Quantos casos entram numa rodada. */
export const CASOS_POR_RODADA = 5;

/** Pontos por caso respondido corretamente (raciocínio clínico vale mais). */
export const PONTOS_POR_CASO = 15;

/** Uma opção já pronta para renderizar, com metadados (multi-conduta). */
export type OpcaoJogavel = {
  texto: string;
  /** se marcá-la conta como acerto */
  correta: boolean;
  /** só em condutas válidas de casos multi */
  nivelEvidencia?: NivelEvidencia;
  indicadoQuando?: string;
  justificativa?: string;
  urlFonte?: string;
};

/** Caso pronto para jogar: opções embaralhadas, com os índices corretos. */
export type CasoJogavel = {
  id: string;
  trilhaId: string;
  caso: string;
  /** "single" = 1 correta; "multi" = marcar todas as adequadas */
  modo: "single" | "multi";
  opcoes: OpcaoJogavel[];
  /** índices das opções corretas em `opcoes` (1 para single, >= 1 para multi) */
  corretas: number[];
  explicacao: string;
  fonte: string;
  urlFonte: string;
};

const ehMulti = (c: CasoClinico): boolean =>
  Array.isArray(c.condutas) && c.condutas.length > 0;

const indicesCorretos = (opcoes: readonly OpcaoJogavel[]): number[] =>
  opcoes.reduce<number[]>((acc, o, i) => (o.correta ? [...acc, i] : acc), []);

/** Embaralha as opções de um caso, recalculando os índices corretos. */
export function embaralharOpcoes(caso: CasoClinico, rng: Rng = Math.random): CasoJogavel {
  const base = {
    id: caso.id,
    trilhaId: caso.trilhaId,
    caso: caso.caso,
    explicacao: caso.explicacao,
    fonte: caso.fonte,
    urlFonte: caso.urlFonte,
  };

  if (ehMulti(caso)) {
    const validas: OpcaoJogavel[] = (caso.condutas ?? []).map((cv) => ({
      texto: cv.conduta,
      correta: true,
      nivelEvidencia: cv.nivelEvidencia,
      indicadoQuando: cv.indicadoQuando,
      justificativa: cv.justificativa,
      urlFonte: cv.urlFonte,
    }));
    const erradas: OpcaoJogavel[] = (caso.distratores ?? []).map((texto) => ({
      texto,
      correta: false,
    }));
    const opcoes = embaralhar([...validas, ...erradas], rng);
    return { ...base, modo: "multi", opcoes, corretas: indicesCorretos(opcoes) };
  }

  // legado: conduta única
  const marcadas: OpcaoJogavel[] = (caso.opcoes ?? []).map((texto, i) => ({
    texto,
    correta: i === caso.correta,
  }));
  const opcoes = embaralhar(marcadas, rng);
  return { ...base, modo: "single", opcoes, corretas: indicesCorretos(opcoes) };
}

/** Monta uma rodada: sorteia até `n` casos distintos e embaralha as opções de cada um. */
export function montarRodadaConduta(
  casos: readonly CasoClinico[],
  n: number = CASOS_POR_RODADA,
  rng: Rng = Math.random
): CasoJogavel[] {
  const qtd = Math.max(1, Math.min(n, casos.length));
  return embaralhar(casos, rng)
    .slice(0, qtd)
    .map((c) => embaralharOpcoes(c, rng));
}

/**
 * True se a seleção do jogador corresponde EXATAMENTE ao conjunto correto.
 * Para "single" isso significa escolher a única correta; para "multi",
 * marcar todas as condutas válidas e nenhum distrator.
 */
export function acertouCaso(caso: CasoJogavel, selecionadas: readonly number[]): boolean {
  const sel = new Set(selecionadas);
  if (sel.size !== caso.corretas.length) return false;
  return caso.corretas.every((i) => sel.has(i));
}

/** Pontuação final: acertos × PONTOS_POR_CASO. */
export function calcularPontosConduta(acertos: number): number {
  return Math.max(0, acertos) * PONTOS_POR_CASO;
}
