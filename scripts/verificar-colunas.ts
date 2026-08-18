/**
 * Verificação do jogo Colunas A-B.
 *   - monta as duas colunas a partir da trilha Anatomia
 *   - checa que cada coluna tem PARES itens e que o casamento por itemId é consistente
 *   - simula uma rodada perfeita e uma com erros, conferindo a pontuação
 *
 * Rodar:  npx tsx scripts/verificar-colunas.ts
 */
import { carregarTrilha } from "../src/lib/loadTrilha";
import {
  BONUS_SEM_ERRO,
  PARES_POR_RODADA,
  PONTOS_POR_ACERTO,
  calcularPontosColunas,
  casaColuna,
  montarColunas,
} from "../src/games/colunas";

function main() {
  const banco = carregarTrilha("anatomia");
  const { esquerda, direita } = montarColunas(banco.itens, PARES_POR_RODADA);

  if (esquerda.length !== PARES_POR_RODADA || direita.length !== PARES_POR_RODADA) {
    console.error(`❌ colunas com tamanho errado: ${esquerda.length}/${direita.length}`);
    process.exit(1);
  }

  // cada termo tem exatamente uma definição correspondente na outra coluna
  let paresValidos = 0;
  for (const t of esquerda) {
    const par = direita.filter((d) => casaColuna(t, d));
    if (par.length !== 1) {
      console.error(`❌ termo ${t.itemId} não tem par único (${par.length}).`);
      process.exit(1);
    }
    paresValidos++;
  }

  // rodada perfeita
  const perfeita = calcularPontosColunas(PARES_POR_RODADA, 0);
  const esperadaPerfeita = PARES_POR_RODADA * PONTOS_POR_ACERTO + BONUS_SEM_ERRO;

  // rodada com 2 erros (sem bônus)
  const comErros = calcularPontosColunas(PARES_POR_RODADA, 2);
  const esperadaComErros = PARES_POR_RODADA * PONTOS_POR_ACERTO;

  console.log(`✅ Colunas montadas: ${paresValidos} pares válidos (${PARES_POR_RODADA} esperados).`);
  console.log(`   Rodada perfeita: ${perfeita} pts (esperado ${esperadaPerfeita})`);
  console.log(`   Rodada com 2 erros: ${comErros} pts (esperado ${esperadaComErros})`);

  if (perfeita !== esperadaPerfeita || comErros !== esperadaComErros) {
    console.error("❌ pontuação inconsistente.");
    process.exit(1);
  }
  console.log("\n✅ DoD do jogo Colunas A-B OK.");
}

main();
