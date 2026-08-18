/**
 * Verificação da lógica da Memória (Fase 4): simula uma partida COMPLETA sem UI
 * e confere baralho, casamento de pares e pontuação (com e sem bônus).
 *
 * Rodar:  npx tsx scripts/verificar-memoria.ts
 */
import { carregarTrilha } from "../src/lib/loadTrilha";
import {
  BONUS_SEM_ERRO,
  PARES_POR_RODADA,
  PONTOS_POR_PAR,
  calcularPontosMemoria,
  casaPar,
  montarBaralho,
} from "../src/games/memoria";

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

let falhas = 0;
function checar(cond: boolean, msg: string) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) falhas++;
}

function main() {
  const banco = carregarTrilha("anatomia");
  const rng = lcg(99);
  const baralho = montarBaralho(banco.itens, PARES_POR_RODADA, rng);

  // 1) Tamanho e composição do baralho
  checar(
    baralho.length === PARES_POR_RODADA * 2,
    `baralho tem ${baralho.length} cartas (esperado ${PARES_POR_RODADA * 2})`
  );
  const ids = new Set(baralho.map((c) => c.id));
  checar(ids.size === baralho.length, "todas as cartas têm id único");

  // 2) Cada item aparece exatamente 2x, uma de cada lado
  const porItem = new Map<string, string[]>();
  for (const c of baralho) {
    porItem.set(c.itemId, [...(porItem.get(c.itemId) ?? []), c.lado]);
  }
  const paresOk = [...porItem.values()].every(
    (lados) => lados.length === 2 && lados.includes("termo") && lados.includes("definicao")
  );
  checar(paresOk, "cada item tem exatamente 1 carta de termo + 1 de definição");

  // 3) casaPar: par correto casa; lados iguais ou itens diferentes não casam
  const primeiroItem = [...porItem.keys()][0];
  const doItem = baralho.filter((c) => c.itemId === primeiroItem);
  checar(casaPar(doItem[0], doItem[1]), "termo e definição do mesmo item casam");
  checar(!casaPar(doItem[0], doItem[0]), "uma carta não casa consigo mesma");
  const deOutroItem = baralho.find((c) => c.itemId !== primeiroItem)!;
  checar(!casaPar(doItem[0], deOutroItem), "cartas de itens diferentes não casam");

  // 4) Simulação de partida perfeita (casa todos os pares, 0 erros)
  const casados = new Set<string>();
  let erros = 0;
  for (const itemId of porItem.keys()) {
    const [a, b] = baralho.filter((c) => c.itemId === itemId);
    if (casaPar(a, b)) {
      casados.add(a.id);
      casados.add(b.id);
    } else {
      erros++;
    }
  }
  const paresEncontrados = casados.size / 2;
  checar(paresEncontrados === PARES_POR_RODADA, `encontrou ${paresEncontrados} pares (todos)`);
  checar(erros === 0, "partida perfeita não acumulou erros");

  // 5) Pontuação
  const pontosPerfeito = calcularPontosMemoria(PARES_POR_RODADA, 0);
  const esperadoPerfeito = PARES_POR_RODADA * PONTOS_POR_PAR + BONUS_SEM_ERRO;
  checar(
    pontosPerfeito === esperadoPerfeito,
    `partida perfeita vale ${pontosPerfeito} (base + bônus = ${esperadoPerfeito})`
  );
  const pontosComErro = calcularPontosMemoria(PARES_POR_RODADA, 3);
  checar(
    pontosComErro === PARES_POR_RODADA * PONTOS_POR_PAR,
    `partida com erro não recebe bônus (${pontosComErro})`
  );

  console.log(falhas === 0 ? "\n✅ Lógica da Memória consistente." : `\n❌ ${falhas} verificação(ões) falharam.`);
  process.exit(falhas === 0 ? 0 : 1);
}

main();
