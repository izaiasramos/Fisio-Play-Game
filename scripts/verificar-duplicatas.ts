/**
 * Verificação anti-duplicação do banco de itens.
 *
 * Por que existe: 7 dos 8 jogos leem os mesmos `itens` da trilha, e o quiz usa
 * `definicao` como enunciado e `termo` como resposta. Um conceito copiado em
 * duas trilhas vira a MESMA pergunta em dois lugares; duas definições parecidas
 * dentro da mesma trilha viram uma pergunta ambígua (dois termos servem de
 * resposta).
 *
 * A política do banco (rota "diferenciar o ângulo") aceita que um conceito
 * apareça em mais de uma trilha — desde que cada trilha o aborde pelo seu
 * recorte. Ex.: "Frequência cardíaca" existe em Cardio (controle autonômico) e
 * em Saúde Geral (como aferir o pulso). Por isso termo repetido entre trilhas
 * NÃO é erro por si; o erro é o par ter também a definição parecida.
 *
 * Regras:
 *   1. termo repetido na MESMA trilha                    → erro (resposta ambígua)
 *   2. mesmo termo em trilhas diferentes + definição      → erro acima de LIMIAR_MESMO_TERMO
 *      parecida (o ângulo não foi diferenciado)
 *   3. termos diferentes na MESMA trilha, definição       → erro acima de LIMIAR_DENTRO
 *      parecida (quiz ambíguo)
 *   4. termos diferentes em trilhas diferentes,           → erro acima de LIMIAR_ENTRE
 *      definição parecida (copiar e colar)
 *
 * Limiares calibrados contra o banco real (Dice sobre bigramas):
 *   - os 8 conceitos que estavam duplicados marcavam 0.72 a 1.00 com termo igual;
 *   - depois de diferenciados, caíram para 0.35 a 0.61;
 *   - o par não-relacionado mais parecido entre trilhas marca 0.65 (piso de ruído);
 *   - dentro da trilha, pares de contraste intencional chegam a 0.83.
 *
 * Rodar:  npx tsx scripts/verificar-duplicatas.ts
 *         npx tsx scripts/verificar-duplicatas.ts --listar   (top 25 p/ calibrar)
 */
import type { Item } from "../src/data/schema";
import { carregarTrilha, listarTrilhas } from "../src/lib/loadTrilha";

/** Mesmo termo em trilhas diferentes: acima disto o ângulo não foi diferenciado. */
const LIMIAR_MESMO_TERMO = 0.7;
/** Termos diferentes na mesma trilha: acima disto o quiz fica ambíguo. */
const LIMIAR_DENTRO = 0.8;
/** Termos diferentes em trilhas diferentes: acima disto é copiar e colar. */
const LIMIAR_ENTRE = 0.85;

/**
 * Pares (ids ordenados, unidos por "+") revisados e aceitos como contraste
 * intencional. Só entra aqui par que um humano olhou e aprovou.
 */
const PARES_ACEITOS = new Set<string>([
  "ana-034+ana-035", // Quadríceps vs Isquiotibiais — anterior vs posterior da coxa
]);

/** Remove acento, parênteses, pontuação e caixa: compara conteúdo, não formatação. */
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

type Par = {
  a: Item;
  b: Item;
  sim: number;
  mesmaTrilha: boolean;
  mesmoTermo: boolean;
  limiar: number;
};

function main() {
  const listar = process.argv.includes("--listar");

  const trilhas = listarTrilhas();
  if (trilhas.length === 0) {
    console.error("❌ nenhuma trilha registrada.");
    process.exit(1);
  }

  const itens: Item[] = trilhas.flatMap((t) => carregarTrilha(t.id).itens);
  const erros: string[] = [];

  // --- regra 1: termo repetido dentro da mesma trilha ---
  const porTermo = new Map<string, Item[]>();
  for (const it of itens) {
    const k = normalizar(it.termo);
    porTermo.set(k, [...(porTermo.get(k) ?? []), it]);
  }

  const compartilhados: Item[][] = [];
  for (const grupo of porTermo.values()) {
    if (grupo.length < 2) continue;
    const porTrilha = new Map<string, Item[]>();
    for (const i of grupo) porTrilha.set(i.trilhaId, [...(porTrilha.get(i.trilhaId) ?? []), i]);

    for (const [trilhaId, mesmos] of porTrilha) {
      if (mesmos.length > 1) {
        erros.push(
          `termo "${mesmos[0].termo}" repetido na trilha ${trilhaId}: ` +
            mesmos.map((i) => i.id).join(", ")
        );
      }
    }
    if (porTrilha.size > 1) compartilhados.push(grupo);
  }

  // --- regras 2, 3 e 4: definições parecidas ---
  const pares: Par[] = [];
  for (let i = 0; i < itens.length; i++) {
    for (let j = i + 1; j < itens.length; j++) {
      const a = itens[i];
      const b = itens[j];
      const mesmaTrilha = a.trilhaId === b.trilhaId;
      const mesmoTermo = normalizar(a.termo) === normalizar(b.termo);
      const limiar = mesmoTermo
        ? LIMIAR_MESMO_TERMO
        : mesmaTrilha
          ? LIMIAR_DENTRO
          : LIMIAR_ENTRE;
      const sim = similaridade(normalizar(a.definicao), normalizar(b.definicao));

      pares.push({ a, b, sim, mesmaTrilha, mesmoTermo, limiar });

      if (PARES_ACEITOS.has(chavePar(a, b))) continue;
      if (sim < limiar) continue;

      const motivo = mesmoTermo
        ? "mesmo termo, ângulo não diferenciado"
        : mesmaTrilha
          ? "mesma trilha, quiz ambíguo"
          : "trilhas diferentes, conteúdo copiado";
      erros.push(
        `definições ${sim.toFixed(2)} similares (limiar ${limiar}, ${motivo}): ` +
          `${a.trilhaId}/${a.id} "${a.termo}" ~ ${b.trilhaId}/${b.id} "${b.termo}"`
      );
    }
  }

  if (listar) {
    console.log("Top 25 pares por folga até o limiar (sim - limiar):\n");
    const ordenados = pares
      .slice()
      .sort((x, y) => y.sim - y.limiar - (x.sim - x.limiar))
      .slice(0, 25);
    for (const p of ordenados) {
      const escopo = p.mesmoTermo ? "TERMO=" : p.mesmaTrilha ? "DENTRO" : "ENTRE ";
      const aceito = PARES_ACEITOS.has(chavePar(p.a, p.b)) ? " [aceito]" : "";
      console.log(
        `  ${p.sim.toFixed(2)}/${p.limiar.toFixed(2)} ${escopo} ` +
          `${p.a.trilhaId}/${p.a.id} "${p.a.termo}" ~ ` +
          `${p.b.trilhaId}/${p.b.id} "${p.b.termo}"${aceito}`
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

  const folga = (f: (p: Par) => boolean) => {
    const sel = pares.filter(f);
    return sel.length === 0 ? null : sel.reduce((m, p) => (p.sim > m.sim ? p : m));
  };
  const pTermo = folga((p) => p.mesmoTermo);
  const pDentro = folga((p) => !p.mesmoTermo && p.mesmaTrilha);
  const pEntre = folga((p) => !p.mesmoTermo && !p.mesmaTrilha);

  console.log(
    `✅ Sem duplicação — ${itens.length} itens em ${trilhas.length} trilhas, ` +
      `${porTermo.size} termos únicos, ${pares.length} pares comparados.`
  );
  const linha = (rot: string, p: Par | null, limiar: number) =>
    p === null
      ? `   ${rot}: nenhum par.`
      : `   ${rot}: máx ${p.sim.toFixed(2)} (limiar ${limiar}) — ` +
        `${p.a.trilhaId}/${p.a.id} ~ ${p.b.trilhaId}/${p.b.id}`;
  console.log(linha("Mesmo termo entre trilhas ", pTermo, LIMIAR_MESMO_TERMO));
  console.log(linha("Dentro da trilha         ", pDentro, LIMIAR_DENTRO));
  console.log(linha("Entre trilhas            ", pEntre, LIMIAR_ENTRE));

  if (compartilhados.length > 0) {
    console.log(
      `\nℹ️  ${compartilhados.length} conceito(s) presentes em mais de uma trilha ` +
        `(aceito, desde que o ângulo difira):`
    );
    for (const g of compartilhados) {
      console.log(`   "${g[0].termo}" — ${g.map((i) => `${i.trilhaId}/${i.id}`).join(", ")}`);
    }
  }
}

main();
