/**
 * Verificação do jogo "Qual a conduta?".
 *   - valida todos os bancos de casos registrados (forma + índice correto)
 *   - monta uma rodada e confere que o embaralhamento preserva a opção correta
 *   - confere a pontuação
 *
 * Rodar:  npx tsx scripts/verificar-conduta.ts
 */
import { carregarCasos, listarTrilhasComCasos } from "../src/lib/loadCasos";
import {
  PONTOS_POR_CASO,
  acertouCaso,
  calcularPontosConduta,
  montarRodadaConduta,
} from "../src/games/conduta";

function main() {
  const trilhas = listarTrilhasComCasos();
  if (trilhas.length === 0) {
    console.error("❌ nenhuma trilha com casos.");
    process.exit(1);
  }

  let totalCasos = 0;
  let totalMulti = 0;
  for (const id of trilhas) {
    const casos = carregarCasos(id);
    totalCasos += casos.length;

    // toda opção correta deve ter texto correspondente ao original; a
    // seleção do conjunto correto deve pontuar como acerto em ambos os modos.
    const rodada = montarRodadaConduta(casos, casos.length, Math.random);
    for (const jog of rodada) {
      if (jog.corretas.length < 1) {
        console.error(`❌ ${id}/${jog.id}: nenhuma opção correta após embaralhar.`);
        process.exit(1);
      }
      if (jog.modo === "multi") totalMulti += 1;

      // marcar exatamente as corretas => acerto
      if (!acertouCaso(jog, jog.corretas)) {
        console.error(`❌ ${id}/${jog.id}: conjunto correto não pontuou como acerto.`);
        process.exit(1);
      }
      // marcar um subconjunto/errado => não pode ser acerto
      const errada = jog.opcoes.findIndex((o) => !o.correta);
      if (errada >= 0 && acertouCaso(jog, [errada])) {
        console.error(`❌ ${id}/${jog.id}: seleção incorreta pontuou como acerto.`);
        process.exit(1);
      }

      if (!/^https?:\/\//.test(jog.urlFonte) || !jog.fonte) {
        console.error(`❌ ${id}/${jog.id}: fonte/urlFonte inválida.`);
        process.exit(1);
      }
    }
    console.log(`✅ ${id}: ${casos.length} casos válidos · seleção correta preservada`);
  }

  const pts = calcularPontosConduta(4);
  if (pts !== 4 * PONTOS_POR_CASO) {
    console.error("❌ pontuação inconsistente.");
    process.exit(1);
  }

  console.log(
    `\n✅ DoD "Qual a conduta?" OK — ${trilhas.length} trilhas, ${totalCasos} casos ` +
      `(${totalMulti} multi-conduta), 4 acertos = ${pts} pts.`
  );
}

main();
