import type { Item, Pergunta } from "../data/schema";

/** RNG: retorna float em [0, 1). Injetável para testes determinísticos. */
export type Rng = () => number;

/** Fisher-Yates: retorna uma NOVA lista embaralhada (não muta a original). */
export function embaralhar<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Quantas alternativas por pergunta (1 correta + distratores). */
export const ALTERNATIVAS_POR_PERGUNTA = 4;

/**
 * Gera uma pergunta (definição → termo) para um item-alvo.
 * A resposta correta é `alvo.termo`; os distratores são termos de outros itens.
 * Lança se não houver itens suficientes para montar os distratores.
 */
export function gerarPergunta(
  itens: readonly Item[],
  alvo?: Item,
  rng: Rng = Math.random
): Pergunta {
  if (itens.length < ALTERNATIVAS_POR_PERGUNTA) {
    throw new Error(
      `São necessários ao menos ${ALTERNATIVAS_POR_PERGUNTA} itens para gerar uma pergunta (recebidos ${itens.length}).`
    );
  }

  const escolhido = alvo ?? embaralhar(itens, rng)[0];

  // Distratores: termos distintos de outros itens (evita repetir o termo correto).
  const distratores = embaralhar(
    itens.filter((i) => i.id !== escolhido.id && i.termo !== escolhido.termo),
    rng
  )
    .map((i) => i.termo)
    .filter((termo, idx, arr) => arr.indexOf(termo) === idx) // remove duplicados
    .slice(0, ALTERNATIVAS_POR_PERGUNTA - 1);

  const alternativas = embaralhar([escolhido.termo, ...distratores], rng);

  return {
    id: `q-${escolhido.id}`,
    trilhaId: escolhido.trilhaId,
    enunciado: `Qual estrutura corresponde a: "${escolhido.definicao}"?`,
    alternativas,
    correta: alternativas.indexOf(escolhido.termo),
  };
}

/**
 * Gera um quiz de `n` perguntas com alvos distintos (sem repetir item).
 * Se `n` exceder o número de itens, gera o máximo possível.
 */
export function gerarQuiz(
  itens: readonly Item[],
  n: number,
  rng: Rng = Math.random
): Pergunta[] {
  const alvos = embaralhar(itens, rng).slice(0, Math.max(0, n));
  return alvos.map((alvo) => gerarPergunta(itens, alvo, rng));
}
