/**
 * Verificação anti-duplicação do banco de itens.
 *
 * Por que existe: 7 dos 8 jogos leem os mesmos `itens` da trilha, e o quiz usa
 * `definicao` como enunciado e `termo` como resposta. Um conceito copiado em
 * duas trilhas vira a MESMA pergunta em dois lugares; duas definições parecidas
 * dentro da mesma trilha viram uma pergunta ambígua (dois termos servem de
 * resposta). Este script trava os dois casos.
 *
 * Regras:
 *   1. termo repetido na MESMA trilha        → erro (resposta ambígua)
 *   2. termo repetido ENTRE trilhas          → erro (conteúdo copiado)
 *   3. definicao idêntica em qualquer par    → erro
 *   4. definicao similar ENTRE trilhas       → erro acima de LIMIAR_ENTRE
 *   5. definicao similar na MESMA trilha     → erro acima de LIMIAR_DENTRO
 *
 * O limiar de dentro da trilha é mais frouxo de propósito: pares de contraste
 * (ligamento/tendão, gaveta anterior/posterior) são escritos em paralelo por
 * decisão pedagógica. Pares assim, já revisados, ficam em PARES_ACEITOS.
 *
 * Rodar:  npx tsx scripts/verificar-duplicatas.ts
 *         npx tsx scripts/verificar-duplicatas.ts --listar   (top 25 p/ calibrar)
 */
import type { Item } from "../src/data/schema";
import { carregarTrilha, listarTrilhas } from "../src/lib/loadTrilha";

/** Acima disto, duas definições de trilhas DIFERENTES são consideradas cópia. */
const LIMIAR_ENTRE = 0.62;
/** Acima disto, duas definições da MESMA trilha tornam o quiz ambíguo. */
const LIMIAR_DENTRO = 0.82;

/**
 * Pares (ids ordenados, separados por "+") revisados e aceitos como contraste
 * intencional. Só entra aqui par que um humano olhou e aprovou.
 */
const PARES_ACEITOS = new Set<string>([
  "ana-027+ana-028", // Ligamento vs Tendão — osso-osso vs músculo-osso
  "ana-034+ana-035", // Quadríceps vs Isquiotibiais — anterior vs posterior da coxa
  "ana-038+ana-040", // Peitoral maior vs Grande dorsal — ambos aduzem e rodam medialmente
  "ort-002+ort-035", // Gaveta anterior vs posterior — LCA vs LCP
]);

/** Remove acento, pontuação e caixa: compara conteúdo, não formatação. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Similaridade 0..1 por coeficiente de Dice sobre bigramas de caracteres. */
function similaridade(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramas = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const g = a.slice(i, i + 2);
    bigramas.set(g, (bigramas.get(g) ?? 0) + 1);
  }

  let comuns = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.slice(i, i + 2);
    const n = bigramas.get(g) ?? 0;
    if (n > 0) {
      bigramas.set(g, n - 1);
      comuns += 1;
    }
  }

  return (2 * comuns) / (a.length - 1 + (b.length - 1));
}

const chavePar = (a: Item, b: Item): string => [a.id, b.id].sort().join("+");

type Par = { a: Item; b: Item; sim: number; mesmaTrilha: boolean };

function main() {
  const listar = process.argv.includes("--listar");

  const trilhas = listarTrilhas();
  if (trilhas.length === 0) {
    console.error("❌ nenhuma trilha registrada.");
    process.exit(1);
  }

  const itens: Item[] = trilhas.flatMap((t) => carregarTrilha(t.id).itens);
  const erros: string[] = [];

  // --- 1 e 2: termos repetidos ---
  const porTermo = new Map<string, Item[]>();
  for (const it of itens) {
    const k = normalizar(it.termo);
    porTermo.set(k, [...(porTermo.get(k) ?? []), it]);
  }
  for (const grupo of porTermo.values()) {
    if (grupo.length < 2) continue;
    const trilhasDoGrupo = new Set(grupo.map((i) => i.trilhaId));
    const onde = grupo.map((i) => `${i.trilhaId}/${i.id}`).join(", ");
    if (trilhasDoGrupo.size > 1) {
      erros.push(`termo "${grupo[0].termo}" repetido entre trilhas: ${onde}`);
    } else {
      erros.push(`termo "${grupo[0].termo}" repetido na mesma trilha: ${onde}`);
    }
  }

  // --- 3, 4 e 5: definições parecidas ---
  const pares: Par[] = [];
  for (let i = 0; i < itens.length; i++) {
    for (let j = i + 1; j < itens.length; j++) {
      const a = itens[i];
      const b = itens[j];
      const sim = similaridade(normalizar(a.definicao), normalizar(b.definicao));
      const mesmaTrilha = a.trilhaId === b.trilhaId;
      pares.push({ a, b, sim, mesmaTrilha });

      if (PARES_ACEITOS.has(chavePar(a, b))) continue;

      const limiar = mesmaTrilha ? LIMIAR_DENTRO : LIMIAR_ENTRE;
      if (sim >= limiar) {
        const escopo = mesmaTrilha ? "mesma trilha" : "entre trilhas";
        erros.push(
          `definições ${sim.toFixed(2)} similares (${escopo}): ` +
            `${a.trilhaId}/${a.id} "${a.termo}" ~ ${b.trilhaId}/${b.id} "${b.termo}"`
        );
      }
    }
  }

  if (listar) {
    console.log("Top 25 pares por similaridade de definição:\n");
    for (const p of pares.sort((x, y) => y.sim - x.sim).slice(0, 25)) {
      const escopo = p.mesmaTrilha ? "DENTRO" : "ENTRE ";
      const aceito = PARES_ACEITOS.has(chavePar(p.a, p.b)) ? " [aceito]" : "";
      console.log(
        `  ${p.sim.toFixed(2)} ${escopo} ${p.a.trilhaId}/${p.a.id} "${p.a.termo}"` +
          ` ~ ${p.b.trilhaId}/${p.b.id} "${p.b.termo}"${aceito}`
      );
    }
    console.log("");
  }

  if (erros.length > 0) {
    console.error(`❌ ${erros.length} duplicação(ões) encontrada(s):\n- ` + erros.join("\n- "));
    console.error(
      "\nCorrija diferenciando o ângulo de cada cópia (cada trilha aborda o " +
        "conceito pelo seu recorte) ou registre o par em PARES_ACEITOS se o " +
        "contraste for intencional e já revisado."
    );
    process.exit(1);
  }

  const maiorEntre = Math.max(...pares.filter((p) => !p.mesmaTrilha).map((p) => p.sim));
  const maiorDentro = Math.max(...pares.filter((p) => p.mesmaTrilha).map((p) => p.sim));

  console.log(
    `✅ Sem duplicação — ${itens.length} itens em ${trilhas.length} trilhas, ` +
      `${porTermo.size} termos únicos, ${pares.length} pares comparados.`
  );
  console.log(
    `   Maior similaridade entre trilhas: ${maiorEntre.toFixed(2)} (limiar ${LIMIAR_ENTRE}) · ` +
      `dentro da trilha: ${maiorDentro.toFixed(2)} (limiar ${LIMIAR_DENTRO}, ` +
      `${PARES_ACEITOS.size} pares aceitos).`
  );
}

main();
