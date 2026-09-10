// Lógica pura do jogo "Montar o corpo" — sem UI, fácil de testar.
//
// O jogador arrasta a PEÇA desenhada (o osso) até o lugar dela no tabuleiro.
// Diferente do "Arrastar na anatomia", onde ele arrasta um rótulo de texto até um
// ponto: aqui a peça tem forma, tamanho e um lugar certo.
//
// A peça vem COM O NOME à mostra desde a bandeja: o que se treina é a
// associação nome↔lugar ("onde fica a fíbula?"), não a identificação da forma
// solta ("que osso é esse risquinho?").
//
// Regra de encaixe: a peça acerta quando o destino DELA é o mais próximo do
// ponto onde foi solta. Não exigimos posição precisa de propósito — no tabuleiro
// da perna, os centros da tíbia e da fíbula ficam a ~13 px um do outro numa tela
// de celular, e pedir precisão de 7 px seria injogável. A regra do "mais
// próximo" é generosa no absoluto e continua exigindo a anatomia certa: pôr a
// fíbula do lado medial erra, porque ali o destino mais próximo é o da tíbia.

import type { PecaCorpo, TabuleiroCorpo, VistaCorpo } from "../data/schema";
import { embaralhar, type Rng } from "../lib/gerarQuiz";

/** Pontos por peça encaixada sem usar dica. */
export const PONTOS_POR_PECA = 15;

/** Bônus por fechar a região inteira sem erro e sem dica. */
export const BONUS_REGIAO_LIMPA = 30;

/**
 * Distância máxima aceita, em unidades de LARGURA do tabuleiro. Acima disso a
 * peça voltou para a bandeja: solta longe é engano, não tentativa.
 */
export const RAIO_MAXIMO = 0.5;

/** Níveis de dica, do mais barato ao mais caro. */
export type NivelDica = 0 | 1 | 2;

/**
 * Quanto cada nível de dica deixa a peça valer. Nível 0 = sem dica.
 *   1 = acende a silhueta do lugar ("Onde?")
 *   2 = encaixa sozinha ("Encaixar")
 *
 * O NOME DO OSSO NÃO É DICA: ele aparece de graça na peça, antes do arraste.
 * O jogo não é "adivinhe que osso é este" (a forma isolada não ensina nada) e
 * sim "onde este osso fica" — é a associação nome↔lugar que o aluno precisa
 * carregar para a prova e para o estágio. Por isso o nível "revelar nome"
 * deixou de existir: virou informação inicial, não recompensa.
 */
export const VALOR_POR_DICA: Record<NivelDica, number> = {
  0: PONTOS_POR_PECA,
  1: 8,
  2: 0,
};

/** Peça na bandeja, aguardando ser arrastada. */
export type PecaNaBandeja = { id: string; nome: string };

/** Estado de uma peça já resolvida. */
export type PecaResolvida = { id: string; dica: NivelDica };

/**
 * Converte um ponto do tabuleiro (frações 0..1) para unidades de LARGURA.
 *
 * Sem isso, comparar dx com dy seria comparar coisas diferentes: num tabuleiro
 * de aspecto 0.28, uma fração de altura vale 3,5 vezes menos em pixels que a
 * mesma fração de largura.
 */
function emUnidadesDeLargura(x: number, y: number, aspecto: number): [number, number] {
  return [x, y / aspecto];
}

/** Distância entre dois pontos do tabuleiro, em unidades de largura. */
export function distanciaNoTabuleiro(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  aspecto: number
): number {
  const [x1, y1] = emUnidadesDeLargura(ax, ay, aspecto);
  const [x2, y2] = emUnidadesDeLargura(bx, by, aspecto);
  return Math.hypot(x1 - x2, y1 - y2);
}

/**
 * Id da peça cujo destino está mais próximo do ponto, ou `null` se o ponto caiu
 * longe de tudo. Considera todas as peças do tabuleiro (inclusive as já
 * encaixadas): é justamente a vizinhança que torna a escolha significativa.
 */
export function destinoMaisProximo(
  tabuleiro: TabuleiroCorpo,
  x: number,
  y: number
): string | null {
  let melhor: { id: string; d: number } | null = null;
  for (const p of tabuleiro.pecas) {
    const d = distanciaNoTabuleiro(x, y, p.destino.x, p.destino.y, tabuleiro.aspecto);
    if (melhor === null || d < melhor.d) melhor = { id: p.id, d };
  }
  if (melhor === null || melhor.d > RAIO_MAXIMO) return null;
  return melhor.id;
}

/**
 * O que aconteceu quando a peça foi solta (ou tocada) em (x, y).
 *
 * Separar "trocado" de "longe" existe para o feedback ENSINAR: soltar a fíbula
 * onde vai a tíbia é erro de anatomia ("esse lugar é de outro osso"); soltar no
 * meio do nada é só mira ("solte sobre o corpo"). Dar o mesmo buzz aos dois
 * desperdiça a única correção que o jogador recebe sem gastar dica.
 */
export type ResultadoSolta =
  | { tipo: "acerto" }
  | { tipo: "trocado"; ondeCaiu: string }
  | { tipo: "longe" };

/** Avalia a solta de `pecaId` no ponto (x, y), em frações do tabuleiro. */
export function avaliarSolta(
  tabuleiro: TabuleiroCorpo,
  pecaId: string,
  x: number,
  y: number
): ResultadoSolta {
  const perto = destinoMaisProximo(tabuleiro, x, y);
  if (perto === pecaId) return { tipo: "acerto" };
  if (perto === null) return { tipo: "longe" };
  return { tipo: "trocado", ondeCaiu: perto };
}

/**
 * A peça `pecaId`, solta em (x, y), encaixou?
 * Verdadeiro só quando o destino mais próximo do ponto é o dela.
 */
export function encaixou(
  tabuleiro: TabuleiroCorpo,
  pecaId: string,
  x: number,
  y: number
): boolean {
  return avaliarSolta(tabuleiro, pecaId, x, y).tipo === "acerto";
}

/** Peça pelo id (ou undefined). */
export function acharPeca(tabuleiro: TabuleiroCorpo, pecaId: string): PecaCorpo | undefined {
  return tabuleiro.pecas.find((p) => p.id === pecaId);
}

/** Bandeja inicial: todas as peças, em ordem aleatória. */
export function montarBandeja(
  tabuleiro: TabuleiroCorpo,
  rng: Rng = Math.random
): PecaNaBandeja[] {
  return embaralhar(
    tabuleiro.pecas.map((p) => ({ id: p.id, nome: p.nome })),
    rng
  );
}

/** Pontos de uma peça, considerando a dica mais cara que ela consumiu. */
export function pontosDaPeca(dica: NivelDica): number {
  return VALOR_POR_DICA[dica];
}

/**
 * Pontuação da região:
 *   soma dos pontos de cada peça (descontando dicas)
 *   + BONUS_REGIAO_LIMPA se fechou tudo sem erro e sem dica nenhuma.
 */
export function calcularPontosMontar(
  resolvidas: readonly PecaResolvida[],
  totalPecas: number,
  erros: number
): number {
  const base = resolvidas.reduce((s, r) => s + pontosDaPeca(r.dica), 0);
  const limpa =
    erros === 0 &&
    resolvidas.length === totalPecas &&
    resolvidas.every((r) => r.dica === 0);
  return base + (limpa ? BONUS_REGIAO_LIMPA : 0);
}

/** A região acabou quando toda peça encontrou o lugar. */
export function regiaoCompleta(
  resolvidas: readonly PecaResolvida[],
  totalPecas: number
): boolean {
  return resolvidas.length >= totalPecas;
}

// ---------------------------------------------------------------------------
// Vistas: girar a região em vez de girar um modelo 3D
// ---------------------------------------------------------------------------
// Um tabuleiro é uma REGIÃO vista de um ÂNGULO. Vistas da mesma região
// compartilham `regiaoId` e se distinguem por `vista`.
//
// A ordem abaixo é a de uma volta em torno do corpo — é ela que faz as setinhas
// "◀ ▶" parecerem girar em vez de pular de vista aleatoriamente. Ciclar do
// medial de volta ao anterior fecha os 360º.

/** Sequência de uma volta completa. */
export const ORDEM_VISTAS: readonly VistaCorpo[] = [
  "anterior",
  "lateral",
  "posterior",
  "medial",
];

/** Rótulos em pt-BR para a interface. */
export const NOME_VISTA: Record<VistaCorpo, string> = {
  anterior: "de frente",
  lateral: "de lado",
  posterior: "de trás",
  medial: "por dentro",
};

/** Vista do tabuleiro (ausente = anterior, que é o padrão das ilustrações). */
export function vistaDo(t: TabuleiroCorpo): VistaCorpo {
  return t.vista ?? "anterior";
}

/** Região do tabuleiro (ausente = o próprio id, ou seja, região de uma vista só). */
export function regiaoDe(t: TabuleiroCorpo): string {
  return t.regiaoId ?? t.id;
}

/** Vistas de uma região, na ordem da volta. */
export function vistasDaRegiao(
  tabuleiros: readonly TabuleiroCorpo[],
  regiaoId: string
): TabuleiroCorpo[] {
  return tabuleiros
    .filter((t) => regiaoDe(t) === regiaoId)
    .sort((a, b) => ORDEM_VISTAS.indexOf(vistaDo(a)) - ORDEM_VISTAS.indexOf(vistaDo(b)));
}

/**
 * Gira `passo` vistas dentro da mesma região, ciclicamente.
 * `null` quando a região só tem uma vista (não há o que girar).
 */
export function girarVista(
  tabuleiros: readonly TabuleiroCorpo[],
  idAtual: string,
  passo: number
): TabuleiroCorpo | null {
  const atual = tabuleiros.find((t) => t.id === idAtual);
  if (atual === undefined) return null;
  const vistas = vistasDaRegiao(tabuleiros, regiaoDe(atual));
  if (vistas.length < 2) return null;
  const i = vistas.findIndex((t) => t.id === idAtual);
  if (i < 0) return null;
  const total = vistas.length;
  const j = ((i + passo) % total + total) % total;
  return vistas[j];
}

/** Ids das regiões, na ordem de progressão. */
export function regioesEmOrdem(tabuleiros: readonly TabuleiroCorpo[]): string[] {
  const ordemPorRegiao = new Map<string, number>();
  for (const t of tabuleiros) {
    const r = regiaoDe(t);
    const atual = ordemPorRegiao.get(r);
    if (atual === undefined || t.ordem < atual) ordemPorRegiao.set(r, t.ordem);
  }
  return [...ordemPorRegiao.entries()].sort((a, b) => a[1] - b[1]).map(([r]) => r);
}

/**
 * Uma região só está concluída quando TODAS as suas vistas foram montadas.
 * Girar o joelho e montar só a vista de frente não fecha o joelho.
 */
export function regiaoConcluida(
  tabuleiros: readonly TabuleiroCorpo[],
  regiaoId: string,
  concluidas: ReadonlySet<string>
): boolean {
  const vistas = vistasDaRegiao(tabuleiros, regiaoId);
  return vistas.length > 0 && vistas.every((t) => concluidas.has(t.id));
}

/**
 * Região vizinha (`passo` = +1 seguinte, -1 anterior), ciclicamente, devolvendo
 * a primeira vista dela. Só entrega região LIBERADA — as setinhas não podem ser
 * um atalho para furar a progressão.
 */
export function regiaoVizinha(
  tabuleiros: readonly TabuleiroCorpo[],
  idAtual: string,
  passo: number,
  concluidas: ReadonlySet<string>
): TabuleiroCorpo | null {
  const atual = tabuleiros.find((t) => t.id === idAtual);
  if (atual === undefined) return null;
  const regioes = regioesEmOrdem(tabuleiros);
  if (regioes.length < 2) return null;
  const i = regioes.indexOf(regiaoDe(atual));
  if (i < 0) return null;
  const total = regioes.length;
  // procura a próxima liberada, andando no sentido pedido
  for (let n = 1; n < total; n++) {
    const j = ((i + passo * n) % total + total) % total;
    const vistas = vistasDaRegiao(tabuleiros, regioes[j]);
    const primeira = vistas[0];
    if (primeira && regiaoLiberada(tabuleiros, primeira.id, concluidas)) return primeira;
  }
  return null;
}

/**
 * Próxima região da progressão: a de menor `ordem` que ainda não foi concluída.
 * `null` quando o jogador fechou todas.
 */
export function proximaRegiao(
  tabuleiros: readonly TabuleiroCorpo[],
  concluidas: ReadonlySet<string>
): TabuleiroCorpo | null {
  const pendentes = tabuleiros
    .filter((t) => !concluidas.has(t.id))
    .sort((a, b) => a.ordem - b.ordem);
  return pendentes[0] ?? null;
}

/**
 * Um tabuleiro está liberado quando todas as REGIÕES anteriores à dele já foram
 * concluídas — a progressão é sequencial (uma perna, depois a outra, depois o
 * tronco).
 *
 * O raciocínio é por região, e não por tabuleiro, de propósito: dentro de uma
 * região as vistas são livres. Exigir a vista de frente para poder olhar a de
 * lado seria trancar o giro, que é justamente o que as vistas existem para
 * permitir. Com uma vista por região (o caso de hoje) isto é idêntico ao
 * comportamento antigo.
 */
export function regiaoLiberada(
  tabuleiros: readonly TabuleiroCorpo[],
  id: string,
  concluidas: ReadonlySet<string>
): boolean {
  const alvo = tabuleiros.find((t) => t.id === id);
  if (alvo === undefined) return false;
  const regiaoAlvo = regiaoDe(alvo);
  const ordens = new Map<string, number>();
  for (const t of tabuleiros) {
    const r = regiaoDe(t);
    const atual = ordens.get(r);
    if (atual === undefined || t.ordem < atual) ordens.set(r, t.ordem);
  }
  const minhaOrdem = ordens.get(regiaoAlvo) ?? alvo.ordem;
  for (const [regiao, ordem] of ordens) {
    if (regiao === regiaoAlvo) continue;
    if (ordem < minhaOrdem && !regiaoConcluida(tabuleiros, regiao, concluidas)) return false;
  }
  return true;
}

/** Linha do resumo de estudo mostrado no fim da região. */
export type LinhaResumo = {
  id: string;
  nome: string;
  dica: NivelDica;
  pontos: number;
};

/**
 * Resumo da região na ORDEM DO TABULEIRO (de cima para baixo), não na ordem em
 * que o jogador acertou: quem termina quer reler a sequência anatômica —
 * fêmur, patela, tíbia, fíbula — e não o histórico dos próprios cliques.
 */
export function resumoDaRegiao(
  tabuleiro: TabuleiroCorpo,
  resolvidas: readonly PecaResolvida[]
): LinhaResumo[] {
  const porId = new Map(resolvidas.map((r) => [r.id, r.dica]));
  return tabuleiro.pecas
    .filter((p) => porId.has(p.id))
    .map((p) => {
      const dica = porId.get(p.id) as NivelDica;
      return { id: p.id, nome: p.nome, dica, pontos: pontosDaPeca(dica) };
    });
}

/**
 * Acertos sobre tentativas, em %. Serve de leitura honesta do desempenho: dois
 * jogadores podem fechar a mesma região com a mesma pontuação base e um ter
 * chutado o dobro de vezes.
 */
export function precisaoMontar(acertos: number, erros: number): number {
  const tentativas = acertos + erros;
  if (tentativas === 0) return 0;
  return Math.round((acertos / tentativas) * 100);
}

// ---------------------------------------------------------------------------
// Lente: zoom + deslocamento do tabuleiro
// ---------------------------------------------------------------------------
// A lente é só VISÃO — não toca na regra de encaixe, que continua em frações do
// tabuleiro. É o que permite pedir ossos pequenos em lugares específicos (hoje a
// patela; amanhã cabeça da fíbula, sesamoides, carpo) sem transformar o jogo num
// teste de pontaria: ampliando 3×, a mesma tolerância em fração vira 3× mais
// pixels de folga, e a exigência anatômica fica idêntica.
//
// Convenção: `moldura` é a janela fixa onde o tabuleiro aparece (px). O conteúdo
// tem o tamanho da moldura em escala 1 e é transformado como no React Native —
// escala em torno do CENTRO e depois translação:
//
//     ponto_na_moldura = centro + escala * (ponto_no_conteudo - centro) + desloc
//
// Todas as funções abaixo são a álgebra dessa linha, para frente e para trás.

/** Estado da lente aplicada ao tabuleiro. */
export type Lente = { escala: number; dx: number; dy: number };

export const LENTE_NEUTRA: Lente = { escala: 1, dx: 0, dy: 0 };

/** Nunca reduz além do tabuleiro inteiro: afastar mais só criaria borda vazia. */
export const ZOOM_MIN = 1;
/** 4× já mostra a patela do tamanho de um dedo; além disso a silhueta se perde. */
export const ZOOM_MAX = 4;
/** Um duplo-toque leva direto a esta escala, centrado no ponto tocado. */
export const ZOOM_DUPLO_TOQUE = 2.5;
/** Passo dos botões − / +. */
export const ZOOM_PASSO = 0.5;

/**
 * Deslocamento máximo em um eixo, para o conteúdo ampliado nunca descolar da
 * moldura (sem isso o jogador arrasta o tabuleiro para fora e fica olhando um
 * retângulo vazio, sem entender que precisa voltar).
 */
export function limiteDeslocamento(tamanho: number, escala: number): number {
  return Math.max(0, (tamanho * (escala - 1)) / 2);
}

/** Ajusta uma lente aos limites válidos de escala e deslocamento. */
export function comLenteValida(lente: Lente, molduraW: number, molduraH: number): Lente {
  const escala = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, lente.escala));
  const lx = limiteDeslocamento(molduraW, escala);
  const ly = limiteDeslocamento(molduraH, escala);
  return {
    escala,
    dx: Math.min(lx, Math.max(-lx, lente.dx)),
    dy: Math.min(ly, Math.max(-ly, lente.dy)),
  };
}

/** Ponto da moldura (px) → fração do tabuleiro, desfazendo a lente. */
export function pontoParaFracao(
  vpx: number,
  vpy: number,
  molduraW: number,
  molduraH: number,
  lente: Lente
): { x: number; y: number } {
  if (molduraW <= 0 || molduraH <= 0 || lente.escala <= 0) return { x: 0, y: 0 };
  const cx = molduraW / 2;
  const cy = molduraH / 2;
  return {
    x: (cx + (vpx - cx - lente.dx) / lente.escala) / molduraW,
    y: (cy + (vpy - cy - lente.dy) / lente.escala) / molduraH,
  };
}

/** Fração do tabuleiro → ponto da moldura (px), aplicando a lente. */
export function fracaoParaPonto(
  fx: number,
  fy: number,
  molduraW: number,
  molduraH: number,
  lente: Lente
): { x: number; y: number } {
  const cx = molduraW / 2;
  const cy = molduraH / 2;
  return {
    x: cx + lente.escala * (fx * molduraW - cx) + lente.dx,
    y: cy + lente.escala * (fy * molduraH - cy) + lente.dy,
  };
}

/**
 * Lente que muda a escala mantendo FIXO o ponto tocado — o duplo-toque leva o
 * joelho para debaixo do dedo em vez de dar zoom no centro e obrigar a arrastar
 * atrás dele. O ponto só sai do lugar quando o limite de deslocamento entra em
 * ação (perto das bordas, onde não há conteúdo para mostrar).
 */
export function lenteNoPonto(
  vpx: number,
  vpy: number,
  molduraW: number,
  molduraH: number,
  escalaNova: number,
  atual: Lente
): Lente {
  const cx = molduraW / 2;
  const cy = molduraH / 2;
  const px = cx + (vpx - cx - atual.dx) / atual.escala;
  const py = cy + (vpy - cy - atual.dy) / atual.escala;
  const escala = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, escalaNova));
  return comLenteValida(
    {
      escala,
      dx: vpx - cx - escala * (px - cx),
      dy: vpy - cy - escala * (py - cy),
    },
    molduraW,
    molduraH
  );
}
