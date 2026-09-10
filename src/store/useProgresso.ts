import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Progresso } from "../data/schema";

type ProgressoStore = Progresso & {
  /** Soma pontos numa trilha e no XP global. */
  addPontos: (trilhaId: string, pontos: number) => void;
  /** Marca que o usuário jogou hoje e atualiza a ofensiva (streak). */
  registrarJogo: () => void;
  /** Marca uma região de "Montar o corpo" como concluída (idempotente). */
  concluirMontar: (trilhaId: string, regiaoId: string) => void;
  /** Zera todo o progresso. */
  reset: () => void;
};

const estadoInicial: Progresso = {
  pontosPorTrilha: {},
  xp: 0,
  streakDias: 0,
  ultimoJogoISO: null,
  montarConcluidas: {},
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

      concluirMontar: (trilhaId, regiaoId) =>
        set((s) => {
          const feitas = s.montarConcluidas[trilhaId] ?? [];
          if (feitas.includes(regiaoId)) return s; // refazer não duplica
          return {
            montarConcluidas: {
              ...s.montarConcluidas,
              [trilhaId]: [...feitas, regiaoId],
            },
          };
        }),

      reset: () => set({ ...estadoInicial }),
    }),
    {
      name: "fisioplay-progresso",
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      /**
       * v1 não tinha `montarConcluidas`. Sem este migrate, quem já usava o app
       * carregaria `undefined` na chave e o jogo quebraria ao ler as regiões
       * concluídas.
       */
      migrate: (estado, versao) => {
        const s = (estado ?? {}) as Partial<Progresso>;
        if (versao < 2) {
          return { ...s, montarConcluidas: s.montarConcluidas ?? {} } as Progresso;
        }
        return s as Progresso;
      },
    }
  )
);
