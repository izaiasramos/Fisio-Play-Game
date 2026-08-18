/**
 * Verificação do jogo "Complete a palavra".
 *   - monta uma rodada para cada trilha registrada
 *   - confere que o gabarito preenche exatamente as lacunas
 *   - confere que o banco contém todas as letras do gabarito
 *   - confere a pontuação
 *
 * Rodar:  npx tsx scripts/verificar-completar.ts
 */
import { listarTrilhas, carregarTrilha } from "../src/lib/loadTrilha";
import {
  PALAVRAS_POR_RODADA,
  PONTOS_POR_PALAVRA,
  acertouPalavra,
  calcularPontosCompletar,
  montarRodadaCompletar,
} from "../src/games/completar";

function main() {
  const trilhas = listarTrilhas();
  if (trilhas.length === 0) {
    console.error("❌ nenhuma trilha registrada.");
    process.exit(1);
  }

  let totalPalavras = 0;
  for (const t of trilhas) {
    const banco = carregarTrilha(t.id);
    const rodada = montarRodadaCompletar(banco.itens, PALAVRAS_POR_RODADA, Math.random);
    totalPalavras += rodada.length;

    for (const p of rodada) {
      if (p.gabarito.length < 1) {
        console.error(`❌ ${t.id}/${p.id}: sem lacunas.`);
        process.exit(1);
      }
      // o gabarito deve pontuar como acerto
      if (!acertouPalavra(p, p.gabarito)) {
        console.error(`❌ ${t.id}/${p.id}: gabarito não valida.`);
        process.exit(1);
      }
      // o banco contém todas as letras do gabarito
      const banco = [...p.banco];
      const ok = p.gabarito.every((g) => {
        const idx = banco.indexOf(g);
        if (idx < 0) return false;
        banco.splice(idx, 1);
        return true;
      });
      if (!ok) {
        console.error(`❌ ${t.id}/${p.id}: banco não cobre o gabarito.`);
        process.exit(1);
      }
      // nº de lacunas = nº de células ocultas
      const ocultas = p.celulas.filter((c) => c.oculto).length;
      if (ocultas !== p.gabarito.length) {
        console.error(`❌ ${t.id}/${p.id}: lacunas (${ocultas}) ≠ gabarito (${p.gabarito.length}).`);
        process.exit(1);
      }
    }
    console.log(`✅ ${t.id}: rodada de ${rodada.length} palavras válida`);
  }

  const pts = calcularPontosCompletar(4);
  if (pts !== 4 * PONTOS_POR_PALAVRA) {
    console.error("❌ pontuação inconsistente.");
    process.exit(1);
  }

  console.log(
    `\n✅ DoD "Complete a palavra" OK — ${trilhas.length} trilhas, ${totalPalavras} palavras, 4 acertos = ${pts} pts.`
  );
}

main();
