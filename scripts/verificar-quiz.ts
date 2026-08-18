/**
 * Verificação do DoD da Fase 2 (roadmap): simula uma rodada COMPLETA de Quiz
 * (sem UI) e confere acertos e pontuação.
 *
 * Rodar:  npx tsx scripts/verificar-quiz.ts
 */
import { carregarTrilha } from "../src/lib/loadTrilha";
import { gerarQuiz } from "../src/lib/gerarQuiz";
import {
  QUIZ_TAMANHO,
  PONTOS_ACERTO,
  calcularPontos,
} from "../src/games/quiz";

// RNG determinístico (LCG) para tornar a simulação reprodutível.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function main() {
  const banco = carregarTrilha("anatomia");
  const rng = lcg(42);
  const perguntas = gerarQuiz(banco.itens, QUIZ_TAMANHO, rng);

  console.log(`Rodada de ${perguntas.length} perguntas gerada (esperado ${QUIZ_TAMANHO}).`);
  if (perguntas.length !== QUIZ_TAMANHO) process.exit(1);

  // Cenário 1: acerta todas com 10s restantes → pontos = (base + bônus) por pergunta.
  const segundosRestantes = 10;
  let acertos = 0;
  let pontos = 0;
  for (const q of perguntas) {
    const escolha = q.correta; // responde sempre a correta
    const acertou = escolha === q.correta;
    if (acertou) acertos++;
    pontos += calcularPontos(acertou, segundosRestantes);
  }

  const pontosEsperados = QUIZ_TAMANHO * (PONTOS_ACERTO + segundosRestantes);
  console.log(`Cenário "acertou tudo": acertos=${acertos}/${QUIZ_TAMANHO}, pontos=${pontos} (esperado ${pontosEsperados}).`);

  // Cenário 2: erra tudo (timeout) → 0 pontos.
  const pontosErrando = perguntas.reduce((acc, _q) => acc + calcularPontos(false, 0), 0);
  console.log(`Cenário "errou tudo": pontos=${pontosErrando} (esperado 0).`);

  const ok =
    acertos === QUIZ_TAMANHO &&
    pontos === pontosEsperados &&
    pontosErrando === 0;

  console.log(ok ? "\n✅ Rodada de quiz consistente." : "\n❌ Inconsistência na pontuação.");
  process.exit(ok ? 0 : 1);
}

main();
