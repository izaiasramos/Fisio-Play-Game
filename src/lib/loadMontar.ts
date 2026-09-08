import type { TabuleiroCorpo } from "../data/schema";
import montarData from "../data/anatomia-montar.json";

/** Registro estático dos tabuleiros (Metro faz bundle do JSON no build). */
const TABULEIROS: TabuleiroCorpo[] = (
  montarData as { tabuleiros: TabuleiroCorpo[] }
).tabuleiros;

const SISTEMAS = ["ossos", "veias", "nervos", "orgaos"] as const;

export type ResultadoTabuleiros =
  | { ok: true; tabuleiros: TabuleiroCorpo[] }
  | { ok: false; erros: string[] };

const ehString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

const fracao = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

/**
 * Valida a forma dos tabuleiros e a coerência das peças (acumula todos os erros).
 *
 * O JSON é gerado por `scripts/gerar_montar.py`, então isto é rede de segurança
 * contra edição à mão e contra o gerador mudar de contrato sem ninguém notar.
 */
export function validarTabuleiros(
  raw: readonly TabuleiroCorpo[]
): ResultadoTabuleiros {
  const erros: string[] = [];
  const ids = new Set<string>();
  const ordens = new Map<number, string>();

  raw.forEach((t, i) => {
    const tag = `tabuleiros[${i}]`;

    if (!ehString(t.id)) erros.push(`${tag}.id inválido.`);
    else if (ids.has(t.id)) erros.push(`${tag}.id duplicado: "${t.id}".`);
    else ids.add(t.id);

    if (!ehString(t.trilhaId)) erros.push(`${tag}.trilhaId inválido.`);
    if (!ehString(t.titulo)) erros.push(`${tag}.titulo inválido.`);
    if (!ehString(t.modulo)) erros.push(`${tag}.modulo inválido.`);
    if (!SISTEMAS.includes(t.sistema)) {
      erros.push(`${tag}.sistema deve ser um de ${SISTEMAS.join(", ")}.`);
    }
    if (typeof t.ordem !== "number" || !Number.isInteger(t.ordem) || t.ordem < 1) {
      erros.push(`${tag}.ordem deve ser inteiro >= 1.`);
    } else if (ordens.has(t.ordem)) {
      erros.push(`${tag}.ordem ${t.ordem} repetida (já é de "${ordens.get(t.ordem)}").`);
    } else {
      ordens.set(t.ordem, t.id);
    }
    if (typeof t.aspecto !== "number" || t.aspecto <= 0) {
      erros.push(`${tag}.aspecto deve ser número positivo.`);
    }
    if (!ehString(t.fonte)) erros.push(`${tag}.fonte inválida.`);
    if (t.urlFonte !== undefined && !/^https?:\/\//.test(t.urlFonte)) {
      erros.push(`${tag}.urlFonte, se presente, deve ser URL http(s).`);
    }

    if (!Array.isArray(t.pecas) || t.pecas.length < 2) {
      erros.push(`${tag}.pecas deve ter ao menos 2 peças.`);
      return;
    }

    const idsPeca = new Set<string>();
    const nomes = new Set<string>();
    t.pecas.forEach((p, j) => {
      const pt = `${tag}.pecas[${j}]`;
      if (!ehString(p.id)) erros.push(`${pt}.id inválido.`);
      else if (idsPeca.has(p.id)) erros.push(`${pt}.id duplicado: "${p.id}".`);
      else idsPeca.add(p.id);

      if (!ehString(p.nome)) erros.push(`${pt}.nome inválido.`);
      else if (nomes.has(p.nome)) erros.push(`${pt}.nome duplicado: "${p.nome}".`);
      else nomes.add(p.nome);

      if (!fracao(p.destino?.x) || !fracao(p.destino?.y)) {
        erros.push(`${pt}.destino.x/y devem estar em [0,1].`);
      }
      if (!fracao(p.tamanho?.w) || !fracao(p.tamanho?.h)) {
        erros.push(`${pt}.tamanho.w/h devem estar em [0,1].`);
      } else if (p.tamanho.w <= 0 || p.tamanho.h <= 0) {
        erros.push(`${pt}.tamanho deve ser positivo.`);
      }
    });

    // Duas peças no mesmo lugar tornariam o encaixe uma moeda ao ar: a regra do
    // "destino mais próximo" não conseguiria distinguir uma da outra.
    for (let a = 0; a < t.pecas.length; a++) {
      for (let b = a + 1; b < t.pecas.length; b++) {
        const A = t.pecas[a];
        const B = t.pecas[b];
        const dx = A.destino.x - B.destino.x;
        const dy = (A.destino.y - B.destino.y) / t.aspecto;
        if (Math.hypot(dx, dy) < 0.02) {
          erros.push(
            `${tag}: peças "${A.id}" e "${B.id}" têm destinos praticamente no mesmo ponto.`
          );
        }
      }
    }
  });

  if (erros.length) return { ok: false, erros };
  return { ok: true, tabuleiros: raw as TabuleiroCorpo[] };
}

/** Tabuleiros de uma trilha, já em ordem de progressão. */
export function listarTabuleiros(trilhaId: string): TabuleiroCorpo[] {
  const res = validarTabuleiros(TABULEIROS);
  if (!res.ok) return [];
  return res.tabuleiros
    .filter((t) => t.trilhaId === trilhaId)
    .sort((a, b) => a.ordem - b.ordem);
}

/** True se a trilha tem ao menos um tabuleiro válido. */
export function temTabuleiros(trilhaId: string): boolean {
  return listarTabuleiros(trilhaId).length > 0;
}

/** Carrega um tabuleiro por id; lança se desconhecido ou inválido. */
export function carregarTabuleiro(id: string): TabuleiroCorpo {
  const res = validarTabuleiros(TABULEIROS);
  if (!res.ok) {
    throw new Error(`Tabuleiros inválidos:\n- ${res.erros.join("\n- ")}`);
  }
  const t = res.tabuleiros.find((x) => x.id === id);
  if (!t) throw new Error(`Tabuleiro desconhecido: "${id}".`);
  return t;
}

/** Todos os tabuleiros válidos (qualquer trilha), em ordem de progressão. */
export function todosTabuleiros(): TabuleiroCorpo[] {
  const res = validarTabuleiros(TABULEIROS);
  if (!res.ok) return [];
  return res.tabuleiros.slice().sort((a, b) => a.ordem - b.ordem);
}
