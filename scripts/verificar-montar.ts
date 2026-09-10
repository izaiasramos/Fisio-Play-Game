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
  LENTE_NEUTRA,
  PONTOS_POR_PECA,
  RAIO_MAXIMO,
  VALOR_POR_DICA,
  ZOOM_MAX,
  ZOOM_MIN,
  acharPeca,
  avaliarSolta,
  comLenteValida,
  fracaoParaPonto,
  limiteDeslocamento,
  lenteNoPonto,
  pontoParaFracao,
  calcularPontosMontar,
  destinoMaisProximo,
  distanciaNoTabuleiro,
  encaixou,
  girarVista,
  montarBandeja,
  precisaoMontar,
  proximaRegiao,
  regiaoCompleta,
  regiaoConcluida,
  regiaoDe,
  regiaoLiberada,
  regiaoVizinha,
  regioesEmOrdem,
  resumoDaRegiao,
  vistaDo,
  vistasDaRegiao,
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
    VALOR_POR_DICA[0] > VALOR_POR_DICA[1] && VALOR_POR_DICA[1] > VALOR_POR_DICA[2],
    "cada nível de dica vale estritamente menos que o anterior"
  );
  checar(VALOR_POR_DICA[2] === 0, "a dica que encaixa sozinha não pontua");
  checar(
    Object.keys(VALOR_POR_DICA).length === 3,
    "só existem 3 níveis: o nome do osso é grátis, não é dica"
  );

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
    { id: "b", dica: 0 as NivelDica },
    { id: "c", dica: 1 as NivelDica },
    { id: "d", dica: 2 as NivelDica },
  ];
  checar(
    calcularPontosMontar(comDica, 4, 0) ===
      VALOR_POR_DICA[0] * 2 + VALOR_POR_DICA[1] + VALOR_POR_DICA[2],
    "com dicas, soma o valor de cada peça e não dá bônus"
  );
  checar(calcularPontosMontar([], 4, 0) === 0, "região sem peça resolvida vale 0");
  checar(!regiaoCompleta(comDica.slice(0, 3), 4), "3 de 4 peças não fecha a região");
  checar(regiaoCompleta(comDica, 4), "4 de 4 peças fecha a região");

  console.log("\n5b) precisão");
  checar(precisaoMontar(4, 0) === 100, "4 acertos e nenhum erro = 100%");
  checar(precisaoMontar(4, 4) === 50, "4 acertos e 4 erros = 50%");
  checar(precisaoMontar(0, 0) === 0, "sem tentativa nenhuma = 0% (e não divisão por zero)");
}

function cenarioFeedback(tabuleiros: TabuleiroCorpo[]) {
  console.log("\n5c) o erro distingue 'trocou de osso' de 'soltou longe'");
  for (const t of tabuleiros) {
    const [a, b] = t.pecas;
    const acerto = avaliarSolta(t, a.id, a.destino.x, a.destino.y);
    checar(acerto.tipo === "acerto", `${t.id}: ${a.nome} no próprio destino é acerto`);

    const trocado = avaliarSolta(t, a.id, b.destino.x, b.destino.y);
    checar(
      trocado.tipo === "trocado" && trocado.ondeCaiu === b.id,
      `${t.id}: ${a.nome} no lugar de ${b.nome} é "trocado" (aponta ${b.id})`
    );

    const longe = avaliarSolta(t, a.id, 0.5, 5.0);
    checar(longe.tipo === "longe", `${t.id}: solta muito fora é "longe", não erro de anatomia`);
  }
}

function cenarioResumo(tabuleiros: TabuleiroCorpo[]) {
  console.log("\n5d) resumo de estudo do fim da região");
  const t = tabuleiros[0];
  // resolve na ordem INVERSA para provar que o resumo reordena
  const resolvidas = t.pecas
    .slice()
    .reverse()
    .map((p, i) => ({ id: p.id, dica: (i === 0 ? 1 : 0) as NivelDica }));
  const resumo = resumoDaRegiao(t, resolvidas);
  checar(resumo.length === t.pecas.length, `resumo traz as ${t.pecas.length} peças`);
  checar(
    resumo.map((l) => l.id).join(",") === t.pecas.map((p) => p.id).join(","),
    `resumo segue a ordem do tabuleiro (${resumo.map((l) => l.nome).join(" → ")})`
  );
  checar(
    resumo.every((l) => l.pontos === VALOR_POR_DICA[l.dica]),
    "cada linha mostra os pontos coerentes com a dica usada"
  );
  const parcial = resumoDaRegiao(t, [{ id: t.pecas[1].id, dica: 0 }]);
  checar(
    parcial.length === 1 && parcial[0].id === t.pecas[1].id,
    "no meio da rodada, o resumo só lista o que já foi encaixado"
  );
}

function cenarioLente(tabuleiros: TabuleiroCorpo[]) {
  console.log("\n5e) lente (zoom + deslocamento) não desalinha o encaixe");
  const W = 170;
  const H = 608;
  const perto = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) < tol;

  // sem lente, moldura e tabuleiro são a mesma coisa
  const canto = pontoParaFracao(0, 0, W, H, LENTE_NEUTRA);
  const centro = pontoParaFracao(W / 2, H / 2, W, H, LENTE_NEUTRA);
  checar(perto(canto.x, 0) && perto(canto.y, 0), "lente neutra: canto da moldura é a fração (0,0)");
  checar(
    perto(centro.x, 0.5) && perto(centro.y, 0.5),
    "lente neutra: centro da moldura é a fração (0.5,0.5)"
  );

  // ida e volta com uma lente qualquer
  const lente = comLenteValida({ escala: 2.5, dx: -40, dy: 120 }, W, H);
  for (const f of [0.1, 0.37, 0.5, 0.86]) {
    const pt = fracaoParaPonto(f, f, W, H, lente);
    const volta = pontoParaFracao(pt.x, pt.y, W, H, lente);
    checar(
      perto(volta.x, f, 1e-6) && perto(volta.y, f, 1e-6),
      `fração ${f} → pixel → fração volta igual (escala ${lente.escala}×)`
    );
  }

  // duplo-toque mantém sob o dedo o ponto tocado
  const tocado = { x: W * 0.5, y: H * 0.55 };
  const antes = pontoParaFracao(tocado.x, tocado.y, W, H, LENTE_NEUTRA);
  const nova = lenteNoPonto(tocado.x, tocado.y, W, H, 3, LENTE_NEUTRA);
  const depois = pontoParaFracao(tocado.x, tocado.y, W, H, nova);
  checar(
    perto(antes.x, depois.x, 1e-6) && perto(antes.y, depois.y, 1e-6),
    "duplo-toque amplia sem tirar do lugar o ponto tocado"
  );
  checar(nova.escala === 3, "a escala pedida é aplicada");

  // limites: nada de arrastar o tabuleiro para fora da moldura
  checar(limiteDeslocamento(W, 1) === 0, "em escala 1 não há deslocamento possível");
  checar(
    limiteDeslocamento(W, 3) === W,
    "em escala 3 o deslocamento máximo é a largura da moldura"
  );
  const exagerada = comLenteValida({ escala: 99, dx: 9999, dy: -9999 }, W, H);
  checar(exagerada.escala === ZOOM_MAX, `escala é limitada a ${ZOOM_MAX}×`);
  checar(
    Math.abs(exagerada.dx) <= limiteDeslocamento(W, ZOOM_MAX) &&
      Math.abs(exagerada.dy) <= limiteDeslocamento(H, ZOOM_MAX),
    "deslocamento absurdo é cortado no limite"
  );
  checar(comLenteValida({ escala: 0.2, dx: 0, dy: 0 }, W, H).escala === ZOOM_MIN, "não afasta além do tabuleiro inteiro");

  // e o principal: ampliar não muda quem encaixa onde
  const t = tabuleiros[0];
  const ampliada = comLenteValida({ escala: 3, dx: 20, dy: -80 }, W, H);
  const todasAindaEncaixam = t.pecas.every((p) => {
    const pt = fracaoParaPonto(p.destino.x, p.destino.y, W, H, ampliada);
    const f = pontoParaFracao(pt.x, pt.y, W, H, ampliada);
    return encaixou(t, p.id, f.x, f.y);
  });
  checar(todasAindaEncaixam, `${t.id}: com 3× de zoom, toda peça continua encaixando no lugar dela`);
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

/**
 * Vistas de uma mesma região (girar 360º sem 3D).
 *
 * Os dados reais têm uma vista por região, então o cenário monta um joelho
 * fictício de 3 vistas: é a única forma de exercitar o giro e o desbloqueio por
 * região ANTES de existir a ilustração. Se a fonte chegar e o mecanismo estiver
 * quebrado, o custo é descobrir aqui e não no aparelho.
 */
function cenarioVistas() {
  console.log("\n6b) vistas: girar a região em vez de girar um modelo 3D");
  const peca = (id: string, x: number, y: number) => ({
    id,
    nome: id,
    destino: { x, y },
    tamanho: { w: 0.3, h: 0.3 },
  });
  const base = {
    trilhaId: "anatomia",
    sistema: "ossos" as const,
    subtitulo: "fixture",
    aspecto: 1,
    fonte: "fixture",
    pecas: [peca("a", 0.2, 0.2), peca("b", 0.8, 0.8)],
  };
  const fixture: TabuleiroCorpo[] = [
    { ...base, id: "perna", ordem: 1, titulo: "Perna", modulo: "m" },
    {
      ...base,
      id: "joelho-ant",
      ordem: 2,
      titulo: "Joelho",
      modulo: "m",
      regiaoId: "joelho",
      vista: "anterior",
    },
    {
      ...base,
      id: "joelho-lat",
      ordem: 3,
      titulo: "Joelho",
      modulo: "m",
      regiaoId: "joelho",
      vista: "lateral",
    },
    {
      ...base,
      id: "joelho-post",
      ordem: 4,
      titulo: "Joelho",
      modulo: "m",
      regiaoId: "joelho",
      vista: "posterior",
    },
    { ...base, id: "ombro", ordem: 5, titulo: "Ombro", modulo: "m" },
  ];

  checar(vistaDo(fixture[0]) === "anterior", "tabuleiro sem `vista` conta como anterior");
  checar(regiaoDe(fixture[0]) === "perna", "tabuleiro sem `regiaoId` é a própria região");
  checar(
    vistasDaRegiao(fixture, "joelho")
      .map((t) => vistaDo(t))
      .join(",") === "anterior,lateral,posterior",
    "as vistas saem na ordem da volta (anterior → lateral → posterior)"
  );
  checar(
    regioesEmOrdem(fixture).join(",") === "perna,joelho,ombro",
    "as regiões saem na ordem de progressão, sem repetir o joelho 3×"
  );

  // giro cíclico = os 360º
  checar(girarVista(fixture, "joelho-ant", 1)?.id === "joelho-lat", "girar → passa para a lateral");
  checar(
    girarVista(fixture, "joelho-post", 1)?.id === "joelho-ant",
    "girar na última vista volta para a primeira (fecha os 360º)"
  );
  checar(
    girarVista(fixture, "joelho-ant", -1)?.id === "joelho-post",
    "girar para trás na primeira vai para a última"
  );
  checar(girarVista(fixture, "perna", 1) === null, "região de vista única não gira");

  // desbloqueio por REGIÃO: as vistas são livres entre si
  const nada = new Set<string>();
  checar(regiaoLiberada(fixture, "perna", nada), "a primeira região começa liberada");
  checar(!regiaoLiberada(fixture, "joelho-ant", nada), "o joelho fica trancado até a perna");
  const soPerna = new Set(["perna"]);
  checar(regiaoLiberada(fixture, "joelho-ant", soPerna), "concluída a perna, o joelho libera");
  checar(
    regiaoLiberada(fixture, "joelho-post", soPerna),
    "e a vista de trás libera junto — girar não exige montar a de frente antes"
  );
  checar(
    !regiaoConcluida(fixture, "joelho", new Set(["perna", "joelho-ant", "joelho-lat"])),
    "faltando uma vista, a região não está concluída"
  );
  checar(
    regiaoConcluida(fixture, "joelho", new Set(["joelho-ant", "joelho-lat", "joelho-post"])),
    "com as 3 vistas montadas, a região fecha"
  );
  checar(
    !regiaoLiberada(fixture, "ombro", new Set(["perna", "joelho-ant"])),
    "o ombro não libera com o joelho pela metade"
  );
  checar(
    regiaoLiberada(
      fixture,
      "ombro",
      new Set(["perna", "joelho-ant", "joelho-lat", "joelho-post"])
    ),
    "o ombro libera quando o joelho fecha inteiro"
  );

  // setinhas de região só entregam região liberada
  checar(
    regiaoVizinha(fixture, "perna", 1, soPerna)?.id === "joelho-ant",
    "vizinha à frente é a primeira vista do joelho"
  );
  checar(
    regiaoVizinha(fixture, "perna", 1, nada) === null,
    "sem nada concluído, a setinha não fura a progressão"
  );

  // e a validação impede vista repetida
  const duplicada = validarTabuleiros([
    fixture[1],
    { ...fixture[2], id: "joelho-lat2", vista: "anterior" },
  ]);
  checar(
    !duplicada.ok && duplicada.erros.some((e) => e.includes("duas vistas")),
    "duas vistas iguais na mesma região são rejeitadas na validação"
  );
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
  cenarioFeedback(tabuleiros);
  cenarioResumo(tabuleiros);
  cenarioLente(tabuleiros);
  cenarioProgressao(tabuleiros);
  cenarioVistas();
  cenarioBandeja(tabuleiros);

  if (falhas > 0) {
    console.error(`\n❌ ${falhas} verificação(ões) falharam.`);
    process.exit(1);
  }
  const pecas = tabuleiros.reduce((s, t) => s + t.pecas.length, 0);
  console.log(
    `\n✅ DoD "Montar o corpo" OK — ${tabuleiros.length} regiões, ${pecas} peças, ` +
      `encaixe por destino mais próximo (raio máx ${RAIO_MAXIMO}), ` +
      `nome do osso visível desde a bandeja, 2 níveis de dica, ` +
      `feedback de erro por motivo, lente de zoom, giro entre vistas ` +
      `e progressão sequencial por região validados.`
  );
}

main();
