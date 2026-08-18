import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Progresso } from "../data/schema";

type ProgressoStore = Progresso & {
  /** Soma pontos numa trilha e no XP global. */
  addPontos: (trilhaId: string, pontos: number) => void;
  /** Marca que o usuário jogou hoje e atualiza a ofensiva (streak). */
  registrarJogo: () => void;
  /** Zera todo o progresso. */
  reset: () => void;
};

const estadoInicial: Progresso = {
  pontosPorTrilha: {},
  xp: 0,
  streakDias: 0,
  ultimoJogoISO: null,
};

const diaISO = (d: Date) => d.toISOString().slice(0, 10);

export const useProgresso = create<ProgressoStore>()(
  persist(
    (set, get) => ({
      ...estadoInicial,

      addPontos: (trilhaId, pontos) =>
        set((s) => ({
          pontosPorTrilha: {
            ...s.pontosPorTrilha,
            [trilhaId]: (s.pontosPorTrilha[trilhaId] ?? 0) + pontos,
          },
          xp: s.xp + pontos,
        })),

      registrarJogo: () => {
        const hoje = new Date();
        const hojeStr = diaISO(hoje);
        const ultimoStr = get().ultimoJogoISO?.slice(0, 10) ?? null;
        if (ultimoStr === hojeStr) return; // já contou hoje

        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        const manteveOfensiva = ultimoStr === diaISO(ontem);

        set((s) => ({
          streakDias: manteveOfensiva ? s.streakDias + 1 : 1,
          ultimoJogoISO: hoje.toISOString(),
        }));
      },

      reset: () => set({ ...estadoInicial }),
    }),
    {
      name: "fisioplay-progresso",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);
