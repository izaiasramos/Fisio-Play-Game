/**
 * Verificação do jogo "Arrastar na anatomia".
 *   - valida todas as pranchas registradas (forma + alvos coerentes + sem sobreposição)
 *   - confere que soltar EXATAMENTE no centro de um alvo resolve aquele alvo
 *   - confere que um ponto longe de tudo não resolve nada
 *   - confere que o banco de chips cobre todos os alvos
 *   - confere a pontuação (base + bônus sem erro)
 *
 * Rodar:  npx tsx scripts/verificar-arrastar.ts
 */
import { validarPranchas, listarPranchas } from "../src/lib/loadPranchas";
import arrastarData from "../src/data/anatomia-arrastar.json";
import type { PranchaAnatomia } from "../src/data/schema";
import {
  BONUS_SEM_ERRO,
  PONTOS_POR_ALVO,
  alvoNoPonto,
  calcularPontosArrastar,
  montarChips,
} from "../src/games/arrastar";

function main() {
  const pranchas = (arrastarData as { pranchas: PranchaAnatomia[] }).pranchas;
  const res = validarPranchas(pranchas);
  if (!res.ok) {
    console.error("❌ pranchas inválidas:\n- " + res.erros.join("\n- "));
    process.exit(1);
  }

  const W = 1000;
  for (const p of res.pranchas) {
    const H = W / p.aspecto;

    // soltar no centro de cada alvo resolve aquele alvo (e não outro)
    for (const a of p.alvos) {
      const hit = alvoNoPonto(p.alvos, a.x * W, a.y * H, W, H);
      if (hit !== a.id) {
        console.error(`❌ ${p.id}/${a.id}: centro resolveu "${hit}" em vez de "${a.id}".`);
        process.exit(1);
      }
    }

    // ponto fora da imagem não resolve nada
    if (alvoNoPonto(p.alvos, -100, -100, W, H) !== null) {
      console.error(`❌ ${p.id}: ponto distante não deveria resolver alvo.`);
      process.exit(1);
    }

    // banco cobre todos os alvos
    const chips = montarChips(p, Math.random);
    const idsChips = new Set(chips.map((c) => c.id));
    if (idsChips.size !== p.alvos.length || !p.alvos.every((a) => idsChips.has(a.id))) {
      console.error(`❌ ${p.id}: banco de chips não cobre os alvos.`);
      process.exit(1);
    }

    console.log(`✅ ${p.id}: ${p.alvos.length} alvos válidos · centros resolvem sem ambiguidade`);
  }

  // pontuação: completo sem erro = base + bônus; com erro = só base
  const n = res.pranchas[0].alvos.length;
  const cheio = calcularPontosArrastar(n, n, 0);
  if (cheio !== n * PONTOS_POR_ALVO + BONUS_SEM_ERRO) {
    console.error("❌ pontuação (sem erro) inconsistente.");
    process.exit(1);
  }
  if (calcularPontosArrastar(n, n, 2) !== n * PONTOS_POR_ALVO) {
    console.error("❌ pontuação (com erro) inconsistente.");
    process.exit(1);
  }

  console.log(
    `\n✅ DoD "Arrastar na anatomia" OK — ${res.pranchas.length} prancha(s); ` +
      `anatomia tem ${listarPranchas("anatomia").length}.`
  );
}

main();
