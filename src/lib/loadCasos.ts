import type { CasoClinico } from "../data/schema";
import ortopediaCasos from "../data/casos/ortopedia.json";
import neuroCasos from "../data/casos/neuro.json";
import cardioCasos from "../data/casos/cardio.json";
import saudeMulherCasos from "../data/casos/saude-mulher.json";
import saudeGeralCasos from "../data/casos/saude-geral.json";
import anatomiaCasos from "../data/casos/anatomia.json";

/** Registro estático dos bancos de casos por trilha (Metro faz bundle no build). */
const CASOS: Record<string, unknown> = {
  ortopedia: ortopediaCasos,
  neuro: neuroCasos,
  cardio: cardioCasos,
  "saude-mulher": saudeMulherCasos,
  "saude-geral": saudeGeralCasos,
  anatomia: anatomiaCasos,
};

export type ResultadoCasos =
  | { ok: true; casos: CasoClinico[] }
  | { ok: false; erros: string[] };

const ehString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

const NIVEIS_EVIDENCIA = new Set([
  "comprovado",
  "convencional",
  "nao_convencional_aceito",
  "controverso",
  "insuficiente",
]);

/** Valida a forma do JSON de casos de uma trilha, acumulando todos os erros. */
export function validarCasos(raw: unknown): ResultadoCasos {
  const erros: string[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, erros: ["Banco de casos não é um objeto."] };
  }
  const obj = raw as Record<string, unknown>;
  const trilhaId = ehString(obj.trilhaId) ? (obj.trilhaId as string) : "";
  if (!trilhaId) erros.push("Campo 'trilhaId' ausente ou inválido.");

  const casos = obj.casos;
  if (!Array.isArray(casos)) {
    return { ok: false, erros: [...erros, "Campo 'casos' deve ser um array."] };
  }
  if (casos.length === 0) erros.push("Nenhum caso na trilha.");

  const idsVistos = new Set<string>();
  casos.forEach((c, i) => {
    const caso = c as Record<string, unknown>;
    const tag = `casos[${i}]`;
    if (!ehString(caso.id)) erros.push(`${tag}.id deve ser string não-vazia.`);
    else if (idsVistos.has(caso.id as string)) erros.push(`${tag}.id duplicado: "${caso.id}".`);
    else idsVistos.add(caso.id as string);

    if (!ehString(caso.caso)) erros.push(`${tag}.caso deve ser string não-vazia.`);
    if (!ehString(caso.explicacao)) erros.push(`${tag}.explicacao deve ser string não-vazia.`);
    if (!ehString(caso.fonte)) erros.push(`${tag}.fonte deve ser string não-vazia.`);
    if (!ehString(caso.urlFonte) || !/^https?:\/\//.test(caso.urlFonte as string)) {
      erros.push(`${tag}.urlFonte deve ser uma URL http(s).`);
    }
    if (trilhaId && caso.trilhaId !== trilhaId) {
      erros.push(`${tag}.trilhaId ("${caso.trilhaId}") difere de "${trilhaId}".`);
    }

    if (Array.isArray(caso.condutas)) {
      // --- multi-conduta ---
      const condutas = caso.condutas as unknown[];
      if (condutas.length < 1) {
        erros.push(`${tag}.condutas deve ter ao menos 1 conduta válida.`);
      }
      condutas.forEach((cv, j) => {
        const o = cv as Record<string, unknown>;
        const ct = `${tag}.condutas[${j}]`;
        if (!ehString(o.conduta)) erros.push(`${ct}.conduta deve ser string não-vazia.`);
        if (!ehString(o.nivelEvidencia) || !NIVEIS_EVIDENCIA.has(o.nivelEvidencia as string)) {
          erros.push(`${ct}.nivelEvidencia inválido.`);
        }
        if (
          o.urlFonte !== undefined &&
          (!ehString(o.urlFonte) || !/^https?:\/\//.test(o.urlFonte as string))
        ) {
          erros.push(`${ct}.urlFonte, se presente, deve ser URL http(s).`);
        }
      });
      if (caso.distratores !== undefined) {
        if (!Array.isArray(caso.distratores) || !caso.distratores.every((d) => ehString(d))) {
          erros.push(`${tag}.distratores deve ser array de strings não-vazias.`);
        }
      }
    } else {
      // --- legado (conduta única) ---
      if (!Array.isArray(caso.opcoes) || caso.opcoes.length < 2) {
        erros.push(`${tag}.opcoes deve ter ao menos 2 opções.`);
      } else if (!caso.opcoes.every((o) => ehString(o))) {
        erros.push(`${tag}.opcoes deve conter apenas strings não-vazias.`);
      }
      const nOpcoes = Array.isArray(caso.opcoes) ? caso.opcoes.length : 0;
      if (
        typeof caso.correta !== "number" ||
        caso.correta < 0 ||
        caso.correta >= nOpcoes
      ) {
        erros.push(`${tag}.correta deve ser índice válido de 'opcoes'.`);
      }
    }
  });

  if (erros.length) return { ok: false, erros };
  return { ok: true, casos: casos as CasoClinico[] };
}

/** True se a trilha tem um banco de casos válido e não-vazio. */
export function temCasos(trilhaId: string): boolean {
  const raw = CASOS[trilhaId];
  if (raw === undefined) return false;
  const res = validarCasos(raw);
  return res.ok && res.casos.length > 0;
}

/** Ids das trilhas com casos registrados. */
export function listarTrilhasComCasos(): string[] {
  return Object.keys(CASOS).filter((id) => temCasos(id));
}

/** Carrega e valida os casos de uma trilha. Lança se desconhecida ou inválida. */
export function carregarCasos(trilhaId: string): CasoClinico[] {
  const raw = CASOS[trilhaId];
  if (raw === undefined) throw new Error(`Sem casos para a trilha "${trilhaId}".`);
  const res = validarCasos(raw);
  if (!res.ok) {
    throw new Error(`Casos inválidos para "${trilhaId}":\n- ${res.erros.join("\n- ")}`);
  }
  return res.casos;
}
