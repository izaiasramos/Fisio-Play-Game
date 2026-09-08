import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Perfil } from "../data/schema";
import {
  CHAVE_PERFIL_LEGADO,
  MAX_MOMENTOS,
  type Momento,
  type ResultadoFoto,
  apagarAvatar,
  apagarMomento,
  carregarFotos,
  definirArmazem,
  limparFotos,
  migrarFotosLegado,
  salvarAvatar,
  salvarMomento,
} from "../lib/fotosPerfil";
import { colors } from "../theme/tokens";

// Liga o módulo de fotos ao AsyncStorage. Fica aqui (e não dentro de
// fotosPerfil.ts) para aquele módulo continuar carregável fora do app.
definirArmazem(AsyncStorage);

export { MAX_MOMENTOS };
export type { Momento };

type PerfilStore = Perfil & {
  /** false até as fotos serem lidas do disco (elas não vêm no persist). */
  fotosCarregadas: boolean;

  setNome: (nome: string) => void;
  setFrase: (frase: string) => void;
  setCorTema: (cor: string) => void;

  /** Lê as fotos do disco. Chamado uma vez na abertura do app. */
  hidratarFotos: () => Promise<void>;

  setAvatar: (uri: string | null) => Promise<ResultadoFoto>;
  addMomento: (uri: string) => Promise<ResultadoFoto>;
  removeMomento: (id: string) => Promise<void>;
  reset: () => Promise<void>;
};

/** Cores de destaque que a Isa pode escolher para o app. */
export const CORES_TEMA = [
  { nome: "Verde-menta", hex: colors.accent },
  { nome: "Rosa", hex: "#F472B6" },
  { nome: "Roxo", hex: "#A78BFA" },
  { nome: "Coral", hex: "#FB7185" },
  { nome: "Âmbar", hex: colors.warning },
  { nome: "Céu", hex: "#38BDF8" },
] as const;

const inicial: Perfil = {
  nome: "Luuh",
  frase: "",
  avatarUri: null,
  corTema: colors.accent,
  momentos: [],
};

/** Versão do formato persistido. 2 = fotos saíram desta chave. */
const VERSAO = 2;

/**
 * Resolve quando o `persist` termina de hidratar — em sucesso OU em erro.
 * Importa porque a migração das fotos antigas roda dentro do `migrate`, e ler
 * as fotos antes disso devolveria uma lista vazia.
 */
let resolverHidratacao: (() => void) | null = null;
const hidratacaoAssentada = new Promise<void>((resolve) => {
  resolverHidratacao = resolve;
});
const assentar = () => {
  resolverHidratacao?.();
  resolverHidratacao = null;
};

export const usePerfil = create<PerfilStore>()(
  persist(
    (set, get) => ({
      ...inicial,
      fotosCarregadas: false,

      setNome: (nome) => set({ nome: nome.slice(0, 24) }),
      setFrase: (frase) => set({ frase: frase.slice(0, 80) }),
      setCorTema: (corTema) => set({ corTema }),

      hidratarFotos: async () => {
        const { avatarUri, momentos } = await carregarFotos();
        set({ avatarUri, momentos, fotosCarregadas: true });
      },

      setAvatar: async (uri) => {
        if (uri === null) {
          await apagarAvatar();
          set({ avatarUri: null });
          return { ok: true };
        }
        const res = await salvarAvatar(uri);
        // Só reflete na tela o que realmente foi gravado, para a foto não
        // aparecer agora e sumir no próximo abrir do app.
        if (res.ok) set({ avatarUri: uri });
        return res;
      },

      addMomento: async (uri) => {
        if (get().momentos.length >= MAX_MOMENTOS) return { ok: false, motivo: "erro" };
        const res = await salvarMomento(uri);
        if (!res.ok) return res;
        // Só entra na tela depois de gravado, para não exibir foto que
        // desapareceria no próximo abrir do app.
        if (res.id !== undefined) {
          const id = res.id;
          set((s) => ({ momentos: [...s.momentos, { id, uri }] }));
        }
        return { ok: true };
      },

      removeMomento: async (id) => {
        await apagarMomento(id);
        set((s) => ({ momentos: s.momentos.filter((m) => m.id !== id) }));
      },

      reset: async () => {
        await limparFotos();
        set({ ...inicial, fotosCarregadas: true });
      },
    }),
    {
      name: CHAVE_PERFIL_LEGADO,
      storage: createJSONStorage(() => AsyncStorage),
      version: VERSAO,

      // Só texto curto vai para esta chave. As fotos ficam uma por chave (ver
      // lib/fotosPerfil.ts): base64 aqui estourava o limite de 2 MB por linha
      // do AsyncStorage no Android e derrubava a leitura do perfil inteiro.
      partialize: (s) => ({ nome: s.nome, frase: s.frase, corTema: s.corTema }),

      // Sem `migrate`, o persist DESCARTA silenciosamente o estado quando a
      // versão muda. Aqui a migração também é a única chance de resgatar as
      // fotos do formato antigo, antes de esta chave ser reescrita sem elas.
      migrate: async (persistido, versaoAntiga) => {
        const antigo = (persistido ?? {}) as Record<string, unknown>;

        if (versaoAntiga < 2) {
          try {
            const n = await migrarFotosLegado(antigo);
            if (n > 0) console.log(`[perfil] ${n} foto(s) migradas para o novo formato.`);
          } catch (e) {
            console.warn("[perfil] não foi possível migrar as fotos antigas:", e);
          }
        }

        return {
          nome: typeof antigo.nome === "string" ? antigo.nome : inicial.nome,
          frase: typeof antigo.frase === "string" ? antigo.frase : inicial.frase,
          corTema: typeof antigo.corTema === "string" ? antigo.corTema : inicial.corTema,
        } as PerfilStore;
      },

      // O hydrate do persist termina num .catch que só avisa por aqui. Sem
      // isto, uma falha de leitura zera o perfil sem deixar rastro — foi o que
      // escondeu o bug das fotos. Se a chave estiver ilegível (linha grande
      // demais), apagamos: o dado já não é recuperável e, mantido, faria toda
      // abertura futura falhar do mesmo jeito.
      onRehydrateStorage: () => (_estado, erro) => {
        // Chamado nos DOIS caminhos do persist (sucesso e falha), por isso é
        // aqui que liberamos quem espera a hidratação.
        assentar();
        if (erro === undefined) return;
        console.warn("[perfil] falha ao ler o perfil salvo:", erro);
        AsyncStorage.removeItem(CHAVE_PERFIL_LEGADO).catch(() => {});
      },
    }
  )
);

/**
 * Prepara o perfil na abertura do app: espera o `persist` assentar (para a
 * migração das fotos antigas ter acontecido) e então lê as fotos do disco.
 *
 * O timeout é rede de segurança: se o armazenamento estiver indisponível, o
 * persist nunca chama `onRehydrateStorage` e não podemos travar as fotos para
 * sempre esperando por ele.
 */
export async function iniciarPerfil(msTimeout = 4000): Promise<void> {
  const limite = new Promise<void>((r) => setTimeout(r, msTimeout));
  await Promise.race([hidratacaoAssentada, limite]);
  await usePerfil.getState().hidratarFotos();
}

/** true quando a Isa já personalizou algo (nome, avatar ou fotos). */
export function perfilPersonalizado(p: Perfil): boolean {
  return Boolean(p.nome || p.avatarUri || p.momentos.length);
}
