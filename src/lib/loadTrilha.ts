import type { Item, Trilha } from "../data/schema";
import anatomiaRaw from "../data/trilhas/anatomia.json";
import ortopediaRaw from "../data/trilhas/ortopedia.json";
import neuroRaw from "../data/trilhas/neuro.json";
import cardioRaw from "../data/trilhas/cardio.json";
import saudeMulherRaw from "../data/trilhas/saude-mulher.json";
import saudeGeralRaw from "../data/trilhas/saude-geral.json";

/** Uma trilha carregada: metadados + itens de conteúdo. */
export type BancoTrilha = { trilha: Trilha; itens: Item[] };

export type ResultadoValidacao =
  | { ok: true; banco: BancoTrilha }
  | { ok: false; erros: string[] };

/** Registro estático das trilhas (Metro faz bundle dos JSON no build). */
const TRILHAS: Record<string, unknown> = {
  anatomia: anatomiaRaw,
  ortopedia: ortopediaRaw,
  neuro: neuroRaw,
  cardio: cardioRaw,
  "saude-mulher": saudeMulherRaw,
  "saude-geral": saudeGeralRaw,
};

const ehString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

/** Valida a forma do JSON de uma trilha, acumulando todos os erros encontrados. */
export function validarBanco(raw: unknown): ResultadoValidacao {
  const erros: string[] = [];

  if (typeof raw !== "object" || raw === null) {
    return { ok: false, erros: ["Banco não é um objeto."] };
  }
  const obj = raw as Record<string, unknown>;

  // --- trilha ---
  const t = obj.trilha as Record<string, unknown> | undefined;
  if (!t || typeof t !== "object") {
    erros.push("Campo 'trilha' ausente ou inválido.");
  } else {
    for (const campo of ["id", "nome", "cor", "icone"] as const) {
      if (!ehString(t[campo])) erros.push(`trilha.${campo} deve ser string não-vazia.`);
    }
  }
  const trilhaId = ehString(t?.id) ? (t!.id as string) : "";

  // --- itens ---
  const itens = obj.itens;
  if (!Array.isArray(itens)) {
    erros.push("Campo 'itens' deve ser um array.");
    return erros.length ? { ok: false, erros } : { ok: false, erros: ["Erro desconhecido."] };
  }
  if (itens.length === 0) erros.push("A trilha não tem nenhum item.");

  const idsVistos = new Set<string>();
  itens.forEach((it, i) => {
    const item = it as Record<string, unknown>;
    const tag = `itens[${i}]`;

    if (!ehString(item.id)) {
      erros.push(`${tag}.id deve ser string não-vazia.`);
    } else if (idsVistos.has(item.id as string)) {
      erros.push(`${tag}.id duplicado: "${item.id}".`);
    } else {
      idsVistos.add(item.id as string);
    }

    if (!ehString(item.termo)) erros.push(`${tag}.termo deve ser string não-vazia.`);
    if (!ehString(item.definicao)) erros.push(`${tag}.definicao deve ser string não-vazia.`);
    if (!ehString(item.fonte)) erros.push(`${tag}.fonte deve ser string não-vazia.`);
    if (!ehString(item.urlFonte) || !/^https?:\/\//.test(item.urlFonte as string)) {
      erros.push(`${tag}.urlFonte deve ser uma URL http(s).`);
    }
    if (![1, 2, 3].includes(item.dificuldade as number)) {
      erros.push(`${tag}.dificuldade deve ser 1, 2 ou 3.`);
    }
    if (trilhaId && item.trilhaId !== trilhaId) {
      erros.push(`${tag}.trilhaId ("${item.trilhaId}") difere de trilha.id ("${trilhaId}").`);
    }
    if (item.imagem !== undefined && typeof item.imagem !== "string") {
      erros.push(`${tag}.imagem, quando presente, deve ser string.`);
    }
  });

  if (erros.length) return { ok: false, erros };

  return {
    ok: true,
    banco: { trilha: obj.trilha as Trilha, itens: itens as Item[] },
  };
}

/** Ids das trilhas registradas. */
export function listarTrilhasIds(): string[] {
  return Object.keys(TRILHAS);
}

/** Metadados de todas as trilhas válidas registradas. */
export function listarTrilhas(): Trilha[] {
  return listarTrilhasIds()
    .map((id) => {
      const res = validarBanco(TRILHAS[id]);
      return res.ok ? res.banco.trilha : null;
    })
    .filter((t): t is Trilha => t !== null);
}

/** Carrega e valida uma trilha pelo id. Lança se desconhecida ou inválida. */
export function carregarTrilha(id: string): BancoTrilha {
  const raw = TRILHAS[id];
  if (raw === undefined) throw new Error(`Trilha desconhecida: "${id}".`);
  const res = validarBanco(raw);
  if (!res.ok) {
    throw new Error(`Banco inválido para "${id}":\n- ${res.erros.join("\n- ")}`);
  }
  return res.banco;
}
