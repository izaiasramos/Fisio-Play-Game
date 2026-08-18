/**
 * Verificação do jogo "Verdadeiro ou Falso".
 *   - monta uma rodada por trilha
 *   - confere que afirmações verdadeiras usam a definição correta e as falsas não
 *   - confere que responder conforme o gabarito pontua como acerto
 *   - confere o balanceamento (~metade V / metade F) e a pontuação
 *
 * Rodar:  npx tsx scripts/verificar-vf.ts
 */
import { listarTrilhas, carregarTrilha } from "../src/lib/loadTrilha";
import {
  AFIRMACOES_POR_RODADA,
  BONUS_SEQUENCIA_MAX,
  PONTOS_POR_AFIRMACAO,
  acertouVF,
  calcularPontosVF,
  montarRodadaVF,
  pontosAfirmacao,
} from "../src/games/vf";

function main() {
  const trilhas = listarTrilhas();
  if (trilhas.length === 0) {
    console.error("❌ nenhuma trilha registrada.");
    process.exit(1);
  }

  let total = 0;
  for (const t of trilhas) {
    const banco = carregarTrilha(t.id);
    const rodada = montarRodadaVF(banco.itens, AFIRMACOES_POR_RODADA, Math.random);
    total += rodada.length;

    let verds = 0;
    for (const a of rodada) {
      if (a.verdadeiro) {
        verds += 1;
        if (a.definicao !== a.definicaoCorreta) {
          console.error(`❌ ${t.id}/${a.id}: verdadeira mas definição ≠ correta.`);
          process.exit(1);
        }
      } else if (a.definicao === a.definicaoCorreta) {
        console.error(`❌ ${t.id}/${a.id}: falsa mas definição == correta.`);
        process.exit(1);
      }
      // responder conforme o gabarito deve acertar; o oposto deve errar
      if (!acertouVF(a, a.verdadeiro) || acertouVF(a, !a.verdadeiro)) {
        console.error(`❌ ${t.id}/${a.id}: julgamento inconsistente.`);
        process.exit(1);
      }
    }
    // balanceamento: entre 40% e 60% verdadeiras
    const frac = verds / rodada.length;
    if (frac < 0.4 || frac > 0.6) {
      console.error(`❌ ${t.id}: balanceamento ruim (${verds}/${rodada.length} verdadeiras).`);
      process.exit(1);
    }
    console.log(`✅ ${t.id}: ${rodada.length} afirmações (${verds} V / ${rodada.length - verds} F)`);
  }

  const pts = calcularPontosVF(4);
  if (pts !== 4 * PONTOS_POR_AFIRMACAO) {
    console.error("❌ pontuação inconsistente.");
    process.exit(1);
  }

  // erro/timeout não pontua
  if (pontosAfirmacao(false, 15, 3) !== 0) {
    console.error("❌ erro/timeout deveria pontuar 0.");
    process.exit(1);
  }
  // 1º acerto não tem bônus de combo; velocidade entra
  if (pontosAfirmacao(true, 5, 1) !== PONTOS_POR_AFIRMACAO + 5) {
    console.error("❌ bônus de velocidade inconsistente.");
    process.exit(1);
  }
  // combo cresce com a sequência e respeita o teto
  const alto = pontosAfirmacao(true, 0, 50);
  if (alto !== PONTOS_POR_AFIRMACAO + BONUS_SEQUENCIA_MAX) {
    console.error("❌ bônus de sequência (teto) inconsistente.");
    process.exit(1);
  }
  if (!(pontosAfirmacao(true, 0, 3) > pontosAfirmacao(true, 0, 1))) {
    console.error("❌ combo deveria aumentar com a sequência.");
    process.exit(1);
  }

  console.log(
    `\n✅ DoD "Verdadeiro ou Falso" OK — ${trilhas.length} trilhas, ${total} afirmações, ` +
      `timer+combo validados, 4 acertos-base = ${pts} pts.`
  );
}

main();
