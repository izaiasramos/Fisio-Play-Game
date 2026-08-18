// Lógica pura do jogo da Forca — sem UI, fácil de testar.
// O jogador adivinha o TERMO de um item da trilha, letra a letra, usando a
// DEFINIÇÃO como dica. Acentos são ignorados na comparação (Á == A) e
// espaços/pontuação são revelados de graça.

import type { Item } from "../data/schema";
import { embaralhar, type Rng } from "../lib/gerarQuiz";

/** Máximo de erros antes de perder (cabeça, tronco, 2 braços, 2 pernas). */
export const MAX_ERROS = 6;

/** Pontos-base de uma vitória, antes da penalidade por erro. */
export const PONTOS_BASE_FORCA = 20;

/** Pontos mínimos garantidos ao vencer (mesmo com muitos erros). */
export const PONTOS_MIN_FORCA = 5;

/** Mínimo de letras distintas para um termo ser sorteável (evita palavras curtas demais). */
export const MIN_LETRAS_DISTINTAS = 3;

/** Teclado exibido ao jogador (sem acento, sem espaço). */
export const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Normaliza para comparação: remove acentos e passa a maiúscula. */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

/** É uma letra A–Z (após normalizar)? Espaços, hífens e dígitos não são adivinháveis. */
export function ehLetra(c: string): boolean {
  return /^[A-Z]$/.test(normalizar(c));
}

/** Conjunto de letras (normalizadas) que precisam ser adivinhadas num termo. */
export function letrasParaAdivinhar(termo: string): Set<string> {
  const set = new Set<string>();
  for (const c of termo) if (ehLetra(c)) set.add(normalizar(c));
  return set;
}

/** Venceu quando toda letra a adivinhar já foi tentada. */
export function venceu(termo: string, tentadas: ReadonlySet<string>): boolean {
  for (const l of letrasParaAdivinhar(termo)) if (!tentadas.has(l)) return false;
  return true;
}

/** Nº de erros: letras tentadas que não existem no termo. */
export function contarErros(termo: string, tentadas: ReadonlySet<string>): number {
  const alvo = letrasParaAdivinhar(termo);
  let erros = 0;
  for (const l of tentadas) if (!alvo.has(l)) erros++;
  return erros;
}

/** Perdeu ao atingir MAX_ERROS. */
export function perdeu(termo: string, tentadas: ReadonlySet<string>): boolean {
  return contarErros(termo, tentadas) >= MAX_ERROS;
}

/** Uma letra ainda em jogo já foi tentada corretamente? (para colorir o teclado) */
export function letraCorreta(termo: string, letra: string): boolean {
  return letrasParaAdivinhar(termo).has(normalizar(letra));
}

/** Célula do termo mascarado para exibição. */
export type CelulaForca = {
  /** caractere original (com acento) */
  char: string;
  /** já deve aparecer? (letra acertada, ou não-letra como espaço/hífen) */
  revelado: boolean;
  /** é uma letra adivinhável? (para desenhar o traço "_") */
  ehLetra: boolean;
};

/** Mascara o termo: revela letras acertadas + tudo que não é letra; esconde o resto. */
export function mascarar(termo: string, tentadas: ReadonlySet<string>): CelulaForca[] {
  return [...termo].map((c) => {
    const letra = ehLetra(c);
    return { char: c, ehLetra: letra, revelado: !letra || tentadas.has(normalizar(c)) };
  });
}

/**
 * Pontos da rodada:
 *   - derrota → 0
 *   - vitória → PONTOS_BASE_FORCA − 2 por erro, com piso em PONTOS_MIN_FORCA
 */
export function calcularPontosForca(ganhou: boolean, erros: number): number {
  if (!ganhou) return 0;
  return Math.max(PONTOS_MIN_FORCA, PONTOS_BASE_FORCA - erros * 2);
}

/** Sorteia um item cujo termo tenha letras suficientes; cai no acervo todo se nenhum servir. */
export function escolherItemForca(itens: readonly Item[], rng: Rng = Math.random): Item {
  const candidatos = itens.filter(
    (i) => letrasParaAdivinhar(i.termo).size >= MIN_LETRAS_DISTINTAS
  );
  const pool = candidatos.length ? candidatos : itens.slice();
  if (pool.length === 0) throw new Error("Não há itens para o jogo da Forca.");
  return embaralhar(pool, rng)[0];
}
