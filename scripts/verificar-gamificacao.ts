/**
 * Verificação da lógica de gamificação (XP → nível).
 * Rodar:  npx tsx scripts/verificar-gamificacao.ts
 */
import {
  nivelDoXp,
  progressoNoNivel,
  xpParaProximoNivel,
} from "../src/games/gamificacao";

const casos: Array<[number, number, number, number]> = [
  // xp, nivelEsperado, progresso%Esperado, faltamEsperado
  [0, 1, 0, 100],
  [50, 1, 50, 50],
  [99, 1, 99, 1],
  [100, 2, 0, 100],
  [250, 3, 50, 50],
];

let ok = true;
for (const [xp, nivel, prog, faltam] of casos) {
  const n = nivelDoXp(xp);
  const p = Math.round(progressoNoNivel(xp) * 100);
  const f = xpParaProximoNivel(xp);
  const passou = n === nivel && p === prog && f === faltam;
  ok = ok && passou;
  console.log(
    `xp=${xp} → nível ${n} (esp ${nivel}), progresso ${p}% (esp ${prog}), faltam ${f} (esp ${faltam})  ${passou ? "✅" : "❌"}`
  );
}

console.log(ok ? "\n✅ Gamificação consistente." : "\n❌ Falha na gamificação.");
process.exit(ok ? 0 : 1);
