import type { PranchaAnatomia } from "../data/schema";
import arrastarData from "../data/anatomia-arrastar.json";

/** Registro estático de pranchas por trilha (Metro faz bundle no build). */
const PRANCHAS: PranchaAnatomia[] = (arrastarData as { pranchas: PranchaAnatomia[] }).pranchas;

/** Raio de acerto padrão (fração da largura), quando o alvo não define o seu. */
export const RAIO_ALVO_PADRAO = 0.1;

export type ResultadoPranchas =
  | { ok: true; pranchas: PranchaAnatomia[] }
  | { ok: false; erros: string[] };

const ehString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

const noIntervalo = (v: unknown): v is number =>
  typeof v === "number" && v >= 0 && v <= 1;

/** Valida a forma das pranchas e a coerência dos alvos (acumula todos os erros). */
export function validarPranchas(raw: readonly PranchaAnatomia[]): ResultadoPranchas {
  const erros: string[] = [];
  const idsVistos = new Set<string>();

  raw.forEach((p, i) => {
    const tag = `pranchas[${i}]`;
    if (!ehString(p.id)) erros.push(`${tag}.id inválido.`);
    else if (idsVistos.has(p.id)) erros.push(`${tag}.id duplicado: "${p.id}".`);
    else idsVistos.add(p.id);

    if (!ehString(p.trilhaId)) erros.push(`${tag}.trilhaId inválido.`);
    if (!ehString(p.titulo)) erros.push(`${tag}.titulo inválido.`);
    const temDiagrama = ehString(p.diagrama);
    const temImagem = ehString(p.imagem);
    if (!temDiagrama && !temImagem) {
      erros.push(`${tag}: informe "diagrama" (SVG autoral) ou "imagem" (URL).`);
    }
    if (temImagem && !/^https?:\/\//.test(p.imagem as string)) {
      erros.push(`${tag}.imagem deve ser URL http(s).`);
    }
    if (ehString(p.urlFonte) && !/^https?:\/\//.test(p.urlFonte as string)) {
      erros.push(`${tag}.urlFonte, se presente, deve ser URL http(s).`);
    }
    if (typeof p.aspecto !== "number" || p.aspecto <= 0) {
      erros.push(`${tag}.aspecto deve ser número positivo.`);
    }

    if (!Array.isArray(p.alvos) || p.alvos.length < 2) {
      erros.push(`${tag}.alvos deve ter ao menos 2 alvos.`);
      return;
    }

    const idsAlvo = new Set<string>();
    const rotulos = new Set<string>();
    p.alvos.forEach((a, j) => {
      const at = `${tag}.alvos[${j}]`;
      if (!ehString(a.id)) erros.push(`${at}.id inválido.`);
      else if (idsAlvo.has(a.id)) erros.push(`${at}.id duplicado: "${a.id}".`);
      else idsAlvo.add(a.id);

      if (!ehString(a.rotulo)) erros.push(`${at}.rotulo inválido.`);
      else if (rotulos.has(a.rotulo)) erros.push(`${at}.rotulo duplicado: "${a.rotulo}".`);
      else rotulos.add(a.rotulo);

      if (!noIntervalo(a.x) || !noIntervalo(a.y)) {
        erros.push(`${at}.x/y devem estar em [0,1].`);
      }
      if (a.raio !== undefined && (typeof a.raio !== "number" || a.raio <= 0 || a.raio > 0.5)) {
        erros.push(`${at}.raio, se presente, deve estar em (0, 0.5].`);
      }
    });

    // alvos não podem se sobrepor: o centro de um deve ficar fora do raio do outro
    // (evita ambiguidade — soltar no centro de um alvo sempre resolve aquele alvo).
    for (let a = 0; a < p.alvos.length; a++) {
      for (let b = a + 1; b < p.alvos.length; b++) {
        const A = p.alvos[a];
        const B = p.alvos[b];
        // distância em px de uma imagem de largura W=1000 (altura W/aspecto)
        const W = 1000;
        const H = W / p.aspecto;
        const dpx = Math.hypot((A.x - B.x) * W, (A.y - B.y) * H);
        const raioMaxPx = Math.max(A.raio ?? RAIO_ALVO_PADRAO, B.raio ?? RAIO_ALVO_PADRAO) * W;
        if (dpx <= raioMaxPx) {
          erros.push(`${tag}: alvos "${A.id}" e "${B.id}" ficam muito próximos (ambíguos).`);
        }
      }
    }
  });

  if (erros.length) return { ok: false, erros };
  return { ok: true, pranchas: raw as PranchaAnatomia[] };
}

/** Pranchas de uma trilha (validadas). */
export function listarPranchas(trilhaId: string): PranchaAnatomia[] {
  const res = validarPranchas(PRANCHAS);
  if (!res.ok) return [];
  return res.pranchas.filter((p) => p.trilhaId === trilhaId);
}

/** True se a trilha tem ao menos uma prancha válida. */
export function temPranchas(trilhaId: string): boolean {
  return listarPranchas(trilhaId).length > 0;
}

/** Carrega uma prancha por id; lança se desconhecida ou inválida. */
export function carregarPrancha(pranchaId: string): PranchaAnatomia {
  const res = validarPranchas(PRANCHAS);
  if (!res.ok) {
    throw new Error(`Pranchas inválidas:\n- ${res.erros.join("\n- ")}`);
  }
  const p = res.pranchas.find((x) => x.id === pranchaId);
  if (!p) throw new Error(`Prancha desconhecida: "${pranchaId}".`);
  return p;
}
