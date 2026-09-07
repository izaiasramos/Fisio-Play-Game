import { useMemo, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MotiView } from "moti";
import { carregarTrilha, type BancoTrilha } from "@/lib/loadTrilha";
import {
  PALAVRAS_POR_RODADA,
  type PalavraCompletar,
  acertouPalavra,
  calcularPontosCompletar,
  montarRodadaCompletar,
} from "@/games/completar";
import { nivelDoXp } from "@/games/gamificacao";
import { BarraNeon } from "@/components/BarraNeon";
import { AnelProgresso } from "@/components/completar/AnelProgresso";
import { useProgresso } from "@/store/useProgresso";
import { useFeedback } from "@/lib/useFeedback";
import { Confete } from "@/components/Confete";
import { usePaddingRodape } from "@/lib/useRodape";
import { colors } from "@/theme/tokens";

type Fase = "jogando" | "fim";

export default function CompletarScreen() {
  const router = useRouter();
  const paddingRodape = usePaddingRodape();
  const { trilha } = useLocalSearchParams<{ trilha: string }>();
  const trilhaId = trilha ?? "";
  const feedback = useFeedback();

  const banco = useMemo<BancoTrilha | null>(() => {
    try {
      return carregarTrilha(trilhaId);
    } catch {
      return null;
    }
  }, [trilhaId]);

  const [palavras, setPalavras] = useState<PalavraCompletar[]>(() => {
    try {
      return montarRodadaCompletar(carregarTrilha(trilhaId).itens, PALAVRAS_POR_RODADA);
    } catch {
      return [];
    }
  });

  const addPontos = useProgresso((s) => s.addPontos);
  const registrarJogo = useProgresso((s) => s.registrarJogo);
  const pontosTrilha = useProgresso((s) => s.pontosPorTrilha[trilhaId] ?? 0);
  const xp = useProgresso((s) => s.xp);
  const streak = useProgresso((s) => s.streakDias);

  const [idx, setIdx] = useState(0);
  const [slots, setSlots] = useState<(number | null)[]>([]);
  const [respondido, setRespondido] = useState(false);
  const [acertou, setAcertou] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [fase, setFase] = useState<Fase>("jogando");
  const [pontos, setPontos] = useState(0);
  const [confeteKey, setConfeteKey] = useState(0);

  const atual = palavras[idx];
  const total = palavras.length;

  // inicializa as lacunas vazias sempre que a palavra muda
  const slotsAtuais = useMemo<(number | null)[]>(
    () => (atual ? new Array(atual.gabarito.length).fill(null) : []),
    [atual]
  );
  // sincroniza o estado com a palavra atual na primeira renderização dela
  const slotsProntos = slots.length === (atual?.gabarito.length ?? 0) ? slots : slotsAtuais;

  // mapeia cada célula do termo ao índice da sua lacuna (ordem de aparição)
  const tiles = useMemo(() => {
    if (!atual) return [];
    let b = -1;
    return atual.celulas.map((cel) => {
      if (cel.ehLetra && cel.oculto) {
        b += 1;
        return { ...cel, blank: b };
      }
      return { ...cel, blank: -1 };
    });
  }, [atual]);

  const usados = new Set(slotsProntos.filter((s): s is number => s !== null));
  const proximaLacuna = slotsProntos.findIndex((s) => s === null);

  function checar(preench: (number | null)[]) {
    if (!atual) return;
    const letras = preench.map((bi) => (bi !== null ? atual.banco[bi] : ""));
    const ok = acertouPalavra(atual, letras);
    setRespondido(true);
    setAcertou(ok);
    if (ok) {
      setAcertos((a) => a + 1);
      setConfeteKey((k) => k + 1);
      feedback.acerto();
    } else {
      feedback.erro();
    }
  }

  function tocarBanco(i: number) {
    if (respondido || !atual || usados.has(i)) return;
    const vazia = slotsProntos.findIndex((s) => s === null);
    if (vazia < 0) return;
    const novo = slotsProntos.slice();
    novo[vazia] = i;
    setSlots(novo);
    if (novo.every((s) => s !== null)) checar(novo);
  }

  function tocarLacuna(s: number) {
    if (respondido || slotsProntos[s] === null) return;
    const novo = slotsProntos.slice();
    novo[s] = null;
    setSlots(novo);
  }

  function limpar() {
    if (respondido || !atual) return;
    setSlots(new Array(atual.gabarito.length).fill(null));
  }

  function avancar() {
    if (idx < total - 1) {
      const prox = idx + 1;
      setIdx(prox);
      setSlots(new Array(palavras[prox].gabarito.length).fill(null));
      setRespondido(false);
      setAcertou(false);
    } else {
      const ganhos = calcularPontosCompletar(acertos);
      setPontos(ganhos);
      if (ganhos > 0) addPontos(trilhaId, ganhos);
      registrarJogo();
      setFase("fim");
    }
  }

  function jogarNovamente() {
    try {
      const nova = montarRodadaCompletar(carregarTrilha(trilhaId).itens, PALAVRAS_POR_RODADA);
      setPalavras(nova);
      setSlots(new Array(nova[0]?.gabarito.length ?? 0).fill(null));
    } catch {
      setPalavras([]);
      setSlots([]);
    }
    setIdx(0);
    setRespondido(false);
    setAcertou(false);
    setAcertos(0);
    setPontos(0);
    setFase("jogando");
  }

  // --- sem conteúdo ---
  if (!banco || total === 0) {
    return (
      <View className="flex-1 bg-bg px-6 pt-8">
        <Stack.Screen options={{ title: "Complete a palavra" }} />
        <Text className="text-ink text-lg font-bold">Sem palavras disponíveis</Text>
        <Text className="text-muted mt-1">A trilha "{trilhaId}" não tem conteúdo suficiente.</Text>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} className="mt-6 rounded-2xl py-4 items-center active:opacity-60">
          <Text className="text-muted text-base font-semibold">Voltar</Text>
        </Pressable>
      </View>
    );
  }

  // --- resultado ---
  if (fase === "fim") {
    return (
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: paddingRodape }}
      >
        <Stack.Screen options={{ title: "Resultado" }} />
        <Text className="text-3xl font-extrabold text-ink text-center">
          {acertos === total ? "Vocabulário afiado! 🔡✨" : "Rodada concluída! 🎉"}
        </Text>

        <View className="bg-card rounded-3xl p-6 mt-6 items-center">
          <Text className="text-muted">Palavras completadas</Text>
          <Text className="text-4xl font-extrabold text-accent mt-1">{acertos}/{total}</Text>
          <Text className="text-muted mt-4">Pontos ganhos</Text>
          <Text className="text-3xl font-extrabold text-ink mt-1">+{pontos}</Text>

          <View className="flex-row gap-6 mt-5">
            <View className="items-center">
              <Text className="text-lg font-bold text-warning">🔥 {streak}</Text>
              <Text className="text-muted text-xs">dias seguidos</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-primary">Nível {nivelDoXp(xp)}</Text>
              <Text className="text-muted text-xs">{xp} XP</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-ink">{pontosTrilha}</Text>
              <Text className="text-muted text-xs">na {banco.trilha.nome}</Text>
            </View>
          </View>
        </View>

        <Pressable onPress={jogarNovamente} className="mt-8 bg-primary rounded-2xl py-4 items-center active:opacity-80">
          <Text className="text-white text-lg font-bold">Jogar de novo</Text>
        </Pressable>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} className="mt-3 rounded-2xl py-4 items-center active:opacity-60">
          <Text className="text-muted text-base font-semibold">Voltar</Text>
        </Pressable>

        {confeteKey > 0 && <Confete key={confeteKey} />}
      </ScrollView>
    );
  }

  // --- palavra em andamento ---
  const progresso = ((idx + (respondido ? 1 : 0)) / total) * 100;

  const letraNaLacuna = (s: number): string => {
    const bi = slotsProntos[s];
    if (bi !== null && bi !== undefined) return atual.banco[bi];
    if (respondido) return atual.gabarito[s];
    return "";
  };

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: `Completar · ${banco.trilha.nome}` }} />

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <MotiView
          from={{ opacity: 0.15, scale: 1 }}
          animate={{ opacity: 0.26, scale: 1.25 }}
          transition={{ loop: true, type: "timing", duration: 4200 }}
          style={[styles.halo, styles.haloPrimary]}
        />
        <MotiView
          from={{ opacity: 0.12, scale: 1.15 }}
          animate={{ opacity: 0.24, scale: 1 }}
          transition={{ loop: true, type: "timing", duration: 5200 }}
          style={[styles.halo, styles.haloAccent]}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: paddingRodape }}
      >
        {/* HUD */}
        <View className="flex-row justify-between items-end">
          <Text className="text-accent text-3xl font-black">
            {idx + 1}
            <Text className="text-muted text-lg font-bold">/{total}</Text>
          </Text>
          <Text className="text-success text-xs font-semibold">{acertos} acertos</Text>
        </View>
        <View className="mt-3">
          <BarraNeon pct={progresso} />
        </View>

        {/* hero: anel de maestria */}
        <View className="items-center mt-4">
          <AnelProgresso total={total} ativos={acertos} />
        </View>

        {/* dica (definição) */}
        <MotiView
          key={atual.id}
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300 }}
        >
          <View className="bg-card rounded-3xl p-5 mt-5">
            <Text className="text-accent text-[10px] uppercase tracking-widest font-bold">Dica</Text>
            <Text className="text-ink mt-2 text-base leading-6">{atual.definicao}</Text>
          </View>
        </MotiView>

        {/* termo com lacunas */}
        <View className="flex-row flex-wrap items-end mt-6" style={{ gap: 6 }}>
          {tiles.map((cel, i) => {
            if (!cel.ehLetra) {
              // espaço, hífen, parênteses etc.
              return (
                <View key={i} style={{ width: cel.char === " " ? 14 : 10 }} className="h-11 justify-center">
                  <Text className="text-muted text-xl text-center">{cel.char === " " ? "" : cel.char}</Text>
                </View>
              );
            }
            if (!cel.oculto) {
              return (
                <View key={i} style={styles.tileRevelado} className="w-8 h-11 rounded-lg items-center justify-center">
                  <Text className="text-inkSoft text-lg font-bold">{cel.char}</Text>
                </View>
              );
            }
            // lacuna
            const s = cel.blank;
            const ativa = !respondido && s === proximaLacuna;
            const filled = letraNaLacuna(s);
            const corBorda = respondido
              ? acertou
                ? colors.success
                : colors.error
              : ativa
                ? colors.primary
                : "rgba(255,255,255,0.18)";
            return (
              <Pressable
                key={i}
                onPress={() => tocarLacuna(s)}
                disabled={respondido}
                style={[styles.lacuna, { borderColor: corBorda, shadowColor: ativa ? colors.primary : "transparent" }]}
                className="w-8 h-11 rounded-lg items-center justify-center active:opacity-70"
              >
                <Text
                  className="text-lg font-bold"
                  style={{ color: respondido && !acertou ? colors.error : colors.ink }}
                >
                  {filled}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* banco de letras */}
        {!respondido && (
          <>
            <View className="flex-row flex-wrap mt-7" style={{ gap: 8 }}>
              {atual.banco.map((L, i) => {
                const usado = usados.has(i);
                return (
                  <Pressable
                    key={i}
                    onPress={() => tocarBanco(i)}
                    disabled={usado}
                    accessibilityRole="button"
                    accessibilityLabel={`Letra ${L}`}
                    style={[styles.bancoTile, usado && styles.bancoUsado]}
                    className="w-11 h-12 rounded-xl items-center justify-center active:opacity-70"
                  >
                    <Text className={`text-xl font-black ${usado ? "text-muted" : "text-ink"}`}>{L}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={limpar}
              disabled={proximaLacuna === 0}
              className={`mt-6 rounded-2xl py-3 items-center ${proximaLacuna === 0 ? "opacity-40" : "active:opacity-70"}`}
            >
              <Text className="text-muted text-sm font-semibold">Limpar</Text>
            </Pressable>
          </>
        )}

        {/* feedback + fonte */}
        {respondido && (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 280 }}
          >
            <View className="bg-surface rounded-2xl p-4 mt-7">
              <Text className={`font-bold ${acertou ? "text-success" : "text-error"}`}>
                {acertou ? "Correto!" : `A palavra era: ${atual.termo}`}
              </Text>
              <Text className="text-muted text-sm mt-1 leading-5">{atual.definicao}</Text>
              <Pressable
                onPress={() => Linking.openURL(atual.urlFonte).catch(() => {})}
                className="mt-3 active:opacity-60"
              >
                <Text className="text-primary text-sm font-semibold">Ver fonte ↗</Text>
              </Pressable>
            </View>

            <Pressable onPress={avancar} className="mt-5 bg-primary rounded-2xl py-4 items-center active:opacity-80">
              <Text className="text-white text-lg font-bold">
                {idx < total - 1 ? "Próxima palavra" : "Ver resultado"}
              </Text>
            </Pressable>
          </MotiView>
        )}
      </ScrollView>

      {confeteKey > 0 && <Confete key={confeteKey} />}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { position: "absolute", width: 320, height: 320, borderRadius: 160 },
  haloPrimary: { top: -80, left: -70, backgroundColor: colors.primary, opacity: 0.35 },
  haloAccent: { bottom: 40, right: -90, backgroundColor: colors.accent, opacity: 0.3 },
  barra: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  tileRevelado: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  lacuna: {
    backgroundColor: colors.card,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  bancoTile: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(108,92,231,0.5)",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  bancoUsado: {
    backgroundColor: colors.surface,
    borderColor: "rgba(255,255,255,0.06)",
    shadowOpacity: 0,
  },
});
