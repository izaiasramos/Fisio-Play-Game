/**
 * Guarda as fotos do perfil (avatar + "momentos" da torcida) UMA POR CHAVE no
 * armazenamento local.
 *
 * Por que não tudo na mesma chave: no Android o AsyncStorage lê cada registro
 * através de um CursorWindow do SQLite, que tem teto de ~2 MB POR LINHA. O
 * perfil guardava nome, frase, cor, avatar e até 8 momentos em base64 na MESMA
 * chave (`fisioplay-perfil`); com poucas fotos aquela linha passava de 2 MB e a
 * LEITURA começava a falhar. O `persist` do zustand engole esse erro — o
 * `hydrate()` termina num `.catch` que só repassa para `onRehydrateStorage` —
 * então o app abria com o perfil no estado inicial e as fotos "desapareciam"
 * sem nenhum aviso no console.
 *
 * Uma foto por chave mantém cada linha pequena e isola falhas: uma foto
 * ilegível não derruba as outras nem o resto do perfil.
 *
 * Este módulo NÃO importa o AsyncStorage: o armazém é injetado por
 * `definirArmazem`. Isso mantém a lógica testável fora do app (o AsyncStorage é
 * módulo nativo e não carrega no Node) — ver `scripts/verificar-perfil.ts`.
 */

/** Contrato mínimo de armazenamento (o AsyncStorage já satisfaz). */
export type Armazem = {
  getItem(chave: string): Promise<string | null>;
  setItem(chave: string, valor: string): Promise<void>;
  removeItem(chave: string): Promise<void>;
};

let armazem: Armazem | null = null;

/** Liga o módulo a um armazém (AsyncStorage no app, fake nos testes). */
export function definirArmazem(novo: Armazem): void {
  armazem = novo;
}

function obterArmazem(): Armazem {
  if (armazem === null) {
    throw new Error("fotosPerfil: armazém não definido — chame definirArmazem() antes.");
  }
  return armazem;
}

/**
 * Teto por foto. O limite real do CursorWindow é ~2 MB; ficamos abaixo para
 * sobrar folga para a chave, o JSON e a variação entre aparelhos.
 */
export const LIMITE_FOTO_BYTES = 1_400_000;

/** Quantas fotos-momento o perfil guarda. */
export const MAX_MOMENTOS = 8;

const PREFIXO = "fisioplay-foto:";
const CHAVE_AVATAR = `${PREFIXO}avatar`;
const CHAVE_INDICE = `${PREFIXO}indice`;
const chaveMomento = (id: string) => `${PREFIXO}momento-${id}`;

/** Chave do formato antigo, onde tudo (inclusive as fotos) era gravado junto. */
export const CHAVE_PERFIL_LEGADO = "fisioplay-perfil";

import type { Momento } from "../data/schema";

export type { Momento };

/** Por que a gravação de uma foto falhou. */
export type FalhaFoto = "grande" | "erro";

export type ResultadoFoto = { ok: true } | { ok: false; motivo: FalhaFoto };

/**
 * Tamanho aproximado da foto em bytes. Um data URI é ASCII (base64 + cabeçalho),
 * então o comprimento da string já é uma boa medida.
 */
export function tamanhoFoto(dataUri: string): number {
  return dataUri.length;
}

/** true se a foto é grande demais para uma linha do AsyncStorage. */
export function fotoGrandeDemais(dataUri: string): boolean {
  return tamanhoFoto(dataUri) > LIMITE_FOTO_BYTES;
}

let contador = 0;

/** Id curto e único para uma foto-momento. */
export function novoId(): string {
  contador += 1;
  return `${Date.now().toString(36)}-${contador.toString(36)}`;
}

async function gravarFoto(chave: string, uri: string): Promise<ResultadoFoto> {
  if (fotoGrandeDemais(uri)) return { ok: false, motivo: "grande" };
  try {
    await obterArmazem().setItem(chave, uri);
    return { ok: true };
  } catch (e) {
    console.warn(`[fotosPerfil] falha ao gravar ${chave}:`, e);
    return { ok: false, motivo: "erro" };
  }
}

/** Lê uma foto; devolve null se não existir OU se a leitura falhar. */
async function lerFoto(chave: string): Promise<string | null> {
  try {
    return await obterArmazem().getItem(chave);
  } catch (e) {
    console.warn(`[fotosPerfil] falha ao ler ${chave}:`, e);
    return null;
  }
}

async function remover(chave: string): Promise<void> {
  try {
    await obterArmazem().removeItem(chave);
  } catch (e) {
    console.warn(`[fotosPerfil] falha ao remover ${chave}:`, e);
  }
}

/** Ordem das fotos-momento. Fonte da verdade de quais momentos existem. */
async function lerIndice(): Promise<string[]> {
  const cru = await lerFoto(CHAVE_INDICE);
  if (cru === null) return [];
  try {
    const lista = JSON.parse(cru);
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function escreverIndice(ids: string[]): Promise<void> {
  try {
    await obterArmazem().setItem(CHAVE_INDICE, JSON.stringify(ids));
  } catch (e) {
    console.warn("[fotosPerfil] falha ao gravar o índice:", e);
  }
}

export const salvarAvatar = (uri: string): Promise<ResultadoFoto> =>
  gravarFoto(CHAVE_AVATAR, uri);

export const apagarAvatar = (): Promise<void> => remover(CHAVE_AVATAR);

/** Grava um momento novo e o acrescenta ao fim do índice. */
export async function salvarMomento(uri: string): Promise<ResultadoFoto & { id?: string }> {
  const ids = await lerIndice();
  if (ids.length >= MAX_MOMENTOS) return { ok: false, motivo: "erro" };

  const id = novoId();
  const res = await gravarFoto(chaveMomento(id), uri);
  if (!res.ok) return res;

  await escreverIndice([...ids, id]);
  return { ok: true, id };
}

/** Apaga um momento e o retira do índice. */
export async function apagarMomento(id: string): Promise<void> {
  const ids = await lerIndice();
  await remover(chaveMomento(id));
  await escreverIndice(ids.filter((x) => x !== id));
}

/**
 * Carrega avatar e momentos. Momentos cujo dado sumiu (ou não pôde ser lido)
 * são descartados e o índice é reescrito sem eles, para o perfil não ficar
 * apontando para fotos que não existem mais.
 */
export async function carregarFotos(): Promise<{
  avatarUri: string | null;
  momentos: Momento[];
}> {
  const avatarUri = await lerFoto(CHAVE_AVATAR);
  const ids = await lerIndice();

  const momentos: Momento[] = [];
  for (const id of ids) {
    const uri = await lerFoto(chaveMomento(id));
    if (uri !== null) momentos.push({ id, uri });
  }

  if (momentos.length !== ids.length) {
    await escreverIndice(momentos.map((m) => m.id));
  }

  return { avatarUri, momentos };
}

/** Apaga avatar, todos os momentos e o índice. */
export async function limparFotos(): Promise<void> {
  const ids = await lerIndice();
  await apagarAvatar();
  for (const id of ids) await remover(chaveMomento(id));
  await remover(CHAVE_INDICE);
}

/** Forma antiga do perfil, quando as fotos moravam na mesma chave. */
type PerfilLegado = { avatarUri?: unknown; momentos?: unknown };

/**
 * Move as fotos do formato antigo (tudo numa chave) para uma chave por foto.
 *
 * Roda dentro do `migrate` do persist, que é o único ponto que vê o estado
 * antigo antes de ele ser sobrescrito. Devolve quantas fotos foram migradas.
 *
 * Num aparelho onde a linha antiga já passou de 2 MB a leitura falha ANTES
 * daqui, e nesse caso as fotos são irrecuperáveis — não há o que migrar.
 */
export async function migrarFotosLegado(legado: PerfilLegado): Promise<number> {
  let migradas = 0;

  if (typeof legado.avatarUri === "string" && legado.avatarUri.length > 0) {
    const res = await salvarAvatar(legado.avatarUri);
    if (res.ok) migradas += 1;
  }

  if (Array.isArray(legado.momentos)) {
    const jaTem = (await lerIndice()).length;
    const cabem = Math.max(0, MAX_MOMENTOS - jaTem);
    for (const uri of legado.momentos.slice(0, cabem)) {
      if (typeof uri !== "string" || uri.length === 0) continue;
      const res = await salvarMomento(uri);
      if (res.ok) migradas += 1;
    }
  }

  return migradas;
}
