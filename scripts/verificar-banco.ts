/**
 * Verificação do DoD da Fase 1 (roadmap):
 *   - carrega a trilha Anatomia e valida o formato
 *   - imprime N itens válidos
 *   - gera uma pergunta de quiz com alternativas embaralhadas
 *
 * Rodar:  npx tsx scripts/verificar-banco.ts
 */
import { carregarTrilha, validarBanco } from "../src/lib/loadTrilha";
import { gerarPergunta, gerarQuiz } from "../src/lib/gerarQuiz";
import anatomia from "../src/data/trilhas/anatomia.json";

function main() {
  const res = validarBanco(anatomia);
  if (!res.ok) {
    console.error("❌ Banco INVÁLIDO:\n- " + res.erros.join("\n- "));
    process.exit(1);
  }

  const banco = carregarTrilha("anatomia");
  console.log(`✅ Trilha "${banco.trilha.nome}" carregada — ${banco.itens.length} itens válidos.`);
  console.log(`   Todos os itens têm fonte + urlFonte: ${banco.itens.every((i) => i.fonte && i.urlFonte)}`);

  const pergunta = gerarPergunta(banco.itens);
  console.log("\n📝 Pergunta gerada:");
  console.log("   " + pergunta.enunciado);
  pergunta.alternativas.forEach((alt, i) => {
    const marca = i === pergunta.correta ? "✔" : " ";
    console.log(`   [${marca}] ${String.fromCharCode(65 + i)}. ${alt}`);
  });

  // Sanidade: a correta aponta para uma alternativa existente e única.
  const quiz = gerarQuiz(banco.itens, 5);
  const todasOk = quiz.every(
    (q) =>
      q.alternativas.length === 4 &&
      q.correta >= 0 &&
      q.correta < q.alternativas.length &&
      new Set(q.alternativas).size === q.alternativas.length
  );
  console.log(`\n✅ Quiz de 5 perguntas geradas, todas consistentes: ${todasOk}`);
  if (!todasOk) process.exit(1);
}

main();
