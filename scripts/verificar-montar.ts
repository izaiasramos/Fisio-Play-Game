/**
 * Verificação do jogo "Montar o corpo".
 *   - valida os tabuleiros gerados por scripts/gerar_montar.py
 *   - confere que TODA peça, solta no próprio destino, encaixa
 *   - confere que NENHUMA peça encaixa solta no destino de outra
 *     (é isso que faz o jogo exigir anatomia, e não só mira)
 *   - confere que cada peça tem SVG no módulo de geometria
 *   - confere dicas, pontuação e a progressão entre regiões
 *
 * Rodar:  npx tsx scripts/verificar-montar.ts
 */
import { PECAS_POR_MODULO, svgDaPeca } from "../src/components/pranchas/Pecas";
import type { TabuleiroCorpo } from "../src/data/schema";
import {
  BONUS_REGIAO_LIMPA,
  PONTOS_POR_PECA,
  RAIO_MAXIMO,
  VALOR_POR_DICA,
  acharPeca,
  calcularPontosMontar,
  destinoMaisProximo,
  distanciaNoTabuleiro,
  encaixou,
  montarBandeja,
  proximaRegiao,
  regiaoCompleta,
  regiaoLiberada,
  type NivelDica,
} from "../src/games/montar";
import { todosTabuleiros, validarTabuleiros } from "../src/lib/loadMontar";

let falhas = 0;
function checar(ok: boolean, desc: string) {
  if (ok) {
    console.log(`  ✓ ${desc}`);
  } else {
    console.error(`  ❌ ${desc}`);
    falhas += 1;
  }
}

function cenarioDados(tabuleiros: TabuleiroCorpo[]) {
  console.log("\n1) tabuleiros gerados são válidos");
  const res = validarTabuleiros(tabuleiros);
  if (!res.ok) {
    console.error("  ❌ inválidos:\n   - " + res.erros.join("\n   - "));
    falhas += 1;
    return;
  }
  checar(true, `${tabuleiros.length} tabuleiro(s) passaram na validação`);
  checar(
    tabuleiros.every((t) => t.pecas.length >= 2),
    "todo tabuleiro tem ao menos 2 peças"
  );
  const ordens = tabuleiros.map((t) => t.ordem);
  checar(
    new Set(ordens).size === ordens.length,
    `ordens de progressão sem repetição (${ordens.join(", ")})`
  );
}

function cenarioGeometria(tabuleiros: TabuleiroCorpo[]) {
  console.log("\n2) cada peça tem geometria SVG");
  for (const t of tabuleiros) {
    checar(
      PECAS_POR_MODULO[t.modulo] !== undefined,
      `módulo "${t.modulo}" registrado em Pecas.ts`
    );
    for (const p of t.pecas) {
      const svg = svgDaPeca(t.modulo, p.id);
      const ok =
        svg !== null && svg.includes("<svg") && svg.includes("viewBox") && svg.length > 200;
      checar(ok, `${t.id}/${p.id} (${p.nome}) tem SVG com viewBox`);
    }
  }
}

function cenarioEncaixe(tabuleiros: TabuleiroCorpo[]) {
  console.log("\n3) encaixe: cada peça acerta no seu lugar e erra no do vizinho");
  for (const t of tabuleiros) {
    // solta exatamente no destino -> encaixa
    const todasNoLugar = t.pecas.every((p) => encaixou(t, p.id, p.destino.x, p.destino.y));
    checar(todasNoLugar, `${t.id}: toda peça encaixa solta no próprio destino`);

    // solta no destino de OUTRA peça -> não encaixa
    let trocasAceitas = 0;
    for (const p of t.pecas) {
      for (const outra of t.pecas) {
        if (outra.id === p.id) continue;
        if (encaixou(t, p.id, outra.destino.x, outra.destino.y)) trocasAceitas += 1;
      }
    }
    checar(
      trocasAceitas === 0,
      `${t.id}: nenhuma peça aceita o destino de outra (${t.pecas.length} peças cruzadas)`
    );

    // solta muito longe -> não encaixa e não vira "mais próximo" de ninguém
    const longe = destinoMaisProximo(t, 0.5, 5.0);
    checar(longe === null, `${t.id}: ponto muito distante não casa com peça nenhuma`);
  }
}

function cenarioTolerancia(tabuleiros: TabuleiroCorpo[]) {
  console.log("\n4) a folga de encaixe é utilizável (não exige precisão de pixel)");
  for (const t of tabuleiros) {
    // menor distância entre destinos, em unidades de largura do tabuleiro
    let menor = Infinity;
    let par = "";
    for (let a = 0; a < t.pecas.length; a++) {
      for (let b = a + 1; b < t.pecas.length; b++) {
        const A = t.pecas[a];
        const B = t.pecas[b];
        const d = distanciaNoTabuleiro(
          A.destino.x,
          A.destino.y,
          B.destino.x,
          B.destino.y,
          t.aspecto
        );
        if (d < menor) {
          menor = d;
          par = `${A.nome}/${B.nome}`;
        }
      }
    }
    // a folga efetiva é metade da distância ao vizinho mais próximo
    const folga = menor / 2;
    // num tabuleiro exibido com 130 px de largura, quanto isso dá em px?
    const px = folga * 130;
    checar(
      px >= 4,
      `${t.id}: folga de ${px.toFixed(1)} px num tabuleiro de 130 px ` +
        `(vizinhos mais próximos: ${par})`
    );
  }
}

function cenarioPontuacao() {
  console.log("\n5) dicas e pontuação");
  checar(VALOR_POR_DICA[0] === PONTOS_POR_PECA, "sem dica vale o valor cheio da peça");
  checar(
    VALOR_POR_DICA[0] > VALOR_POR_DICA[1] &&
      VALOR_POR_DICA[1] > VALOR_POR_DICA[2] &&
      VALOR_POR_DICA[2] > VALOR_POR_DICA[3],
    "cada nível de dica vale estritamente menos que o anterior"
  );
  checar(VALOR_POR_DICA[3] === 0, "a dica que encaixa sozinha não pontua");

  const quatro = [0, 0, 0, 0].map((d, i) => ({ id: `p${i}`, dica: d as NivelDica }));
  checar(
    calcularPontosMontar(quatro, 4, 0) === 4 * PONTOS_POR_PECA + BONUS_REGIAO_LIMPA,
    `região limpa: 4×${PONTOS_POR_PECA} + ${BONUS_REGIAO_LIMPA} = ${4 * PONTOS_POR_PECA + BONUS_REGIAO_LIMPA}`
  );
  checar(
    calcularPontosMontar(quatro, 4, 1) === 4 * PONTOS_POR_PECA,
    "com erro, perde só o bônus"
  );
  const comDica = [
    { id: "a", dica: 0 as NivelDica },
    { id: "b", dica: 1 as NivelDica },
    { id: "c", dica: 2 as NivelDica },
    { id: "d", dica: 3 as NivelDica },
  ];
  checar(
    calcularPontosMontar(comDica, 4, 0) === 15 + 10 + 6 + 0,
    "com dicas, soma o valor de cada peça e não dá bônus"
  );
  checar(calcularPontosMontar([], 4, 0) === 0, "região sem peça resolvida vale 0");
  checar(!regiaoCompleta(comDica.slice(0, 3), 4), "3 de 4 peças não fecha a região");
  checar(regiaoCompleta(comDica, 4), "4 de 4 peças fecha a região");
}

function cenarioProgressao(tabuleiros: TabuleiroCorpo[]) {
  console.log("\n6) progressão sequencial entre regiões");
  const emOrdem = tabuleiros.slice().sort((a, b) => a.ordem - b.ordem);
  const primeira = emOrdem[0];
  const segunda = emOrdem[1];

  const nada = new Set<string>();
  checar(proximaRegiao(tabuleiros, nada)?.id === primeira.id, `sem nada feito, começa em "${primeira.id}"`);
  checar(regiaoLiberada(tabuleiros, primeira.id, nada), "a primeira região já está liberada");

  if (segunda !== undefined) {
    checar(
      !regiaoLiberada(tabuleiros, segunda.id, nada),
      `"${segunda.id}" fica trancada até a anterior ser concluída`
    );
    const feita = new Set([primeira.id]);
    checar(
      regiaoLiberada(tabuleiros, segunda.id, feita),
      `"${segunda.id}" libera depois de "${primeira.id}"`
    );
    checar(
      proximaRegiao(tabuleiros, feita)?.id === segunda.id,
      `a próxima região passa a ser "${segunda.id}"`
    );
  }

  const todas = new Set(tabuleiros.map((t) => t.id));
  checar(proximaRegiao(tabuleiros, todas) === null, "com tudo concluído, não há próxima região");
  checar(!regiaoLiberada(tabuleiros, "nao-existe", nada), "região inexistente não é liberada");
}

function cenarioBandeja(tabuleiros: TabuleiroCorpo[]) {
  console.log("\n7) bandeja de peças");
  const t = tabuleiros[0];
  let semente = 7;
  const rng = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };
  const bandeja = montarBandeja(t, rng);
  checar(bandeja.length === t.pecas.length, `bandeja traz as ${t.pecas.length} peças`);
  checar(
    new Set(bandeja.map((p) => p.id)).size === bandeja.length,
    "sem peça repetida na bandeja"
  );
  checar(
    bandeja.every((p) => acharPeca(t, p.id) !== undefined),
    "toda peça da bandeja existe no tabuleiro"
  );
  checar(acharPeca(t, "inexistente") === undefined, "peça inexistente não é encontrada");
}

function main() {
  const tabuleiros = todosTabuleiros();
  if (tabuleiros.length === 0) {
    console.error("❌ nenhum tabuleiro válido — rode scripts/gerar_montar.py");
    process.exit(1);
  }

  cenarioDados(tabuleiros);
  cenarioGeometria(tabuleiros);
  cenarioEncaixe(tabuleiros);
  cenarioTolerancia(tabuleiros);
  cenarioPontuacao();
  cenarioProgressao(tabuleiros);
  cenarioBandeja(tabuleiros);

  if (falhas > 0) {
    console.error(`\n❌ ${falhas} verificação(ões) falharam.`);
    process.exit(1);
  }
  const pecas = tabuleiros.reduce((s, t) => s + t.pecas.length, 0);
  console.log(
    `\n✅ DoD "Montar o corpo" OK — ${tabuleiros.length} regiões, ${pecas} peças, ` +
      `encaixe por destino mais próximo (raio máx ${RAIO_MAXIMO}), ` +
      `3 níveis de dica e progressão sequencial validados.`
  );
}

main();
