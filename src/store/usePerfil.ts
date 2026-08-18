import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Perfil } from "../data/schema";
import { colors } from "../theme/tokens";

type PerfilStore = Perfil & {
  setNome: (nome: string) => void;
  setFrase: (frase: string) => void;
  setAvatar: (uri: string | null) => void;
  setCorTema: (cor: string) => void;
  addMomento: (uri: string) => void;
  removeMomento: (index: number) => void;
  reset: () => void;
};

/** Limite de fotos guardadas para não estourar o AsyncStorage. */
export const MAX_MOMENTOS = 8;

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

export const usePerfil = create<PerfilStore>()(
  persist(
    (set) => ({
      ...inicial,

      setNome: (nome) => set({ nome: nome.slice(0, 24) }),
      setFrase: (frase) => set({ frase: frase.slice(0, 80) }),
      setAvatar: (avatarUri) => set({ avatarUri }),
      setCorTema: (corTema) => set({ corTema }),

      addMomento: (uri) =>
        set((s) =>
          s.momentos.length >= MAX_MOMENTOS
            ? s
            : { momentos: [...s.momentos, uri] }
        ),

      removeMomento: (index) =>
        set((s) => ({ momentos: s.momentos.filter((_, i) => i !== index) })),

      reset: () => set({ ...inicial }),
    }),
    {
      name: "fisioplay-perfil",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);

/** true quando a Isa já personalizou algo (nome, avatar ou fotos). */
export function perfilPersonalizado(p: Perfil): boolean {
  return Boolean(p.nome || p.avatarUri || p.momentos.length);
}
