import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { MotiView } from "moti";
import { listarPranchas } from "@/lib/loadPranchas";
import {
  type ChipArrastar,
  alvoNoPonto,
  calcularPontosArrastar,
  montarChips,
} from "@/games/arrastar";
import type { PranchaAnatomia } from "@/data/schema";
import { nivelDoXp } from "@/games/gamificacao";
import { useProgresso } from "@/store/useProgresso";
import { useFeedback } from "@/lib/useFeedback";
import { Confete } from "@/components/Confete";
import { DIAGRAMAS } from "@/components/pranchas/Diagramas";
import { colors } from "@/theme/tokens";

type Fase = "jogando" | "fim";

/** Largura fixa da imagem (mantém o drag curto e sem clipping de scroll). */
const IMG_W = 260;

export default function ArrastarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { trilha, prancha: pranchaParam } = useLocalSearchParams<{ trilha: string; prancha?: string }>();
  const trilhaId = trilha ?? "anatomia";
  const feedback = useFeedback();

  const lista = useMemo<PranchaAnatomia[]>(() => {
    try {
      return listarPranchas(trilhaId);
    } catch {
      return [];
    }
  }, [trilhaId]);

  const [rodada, setRodada] = useState(0);
  const prancha = useMemo<PranchaAnatomia | null>(() => {
    if (!lista.length) return null;
    if (pranchaParam) {
      const p = lista.find((x) => x.id === pranchaParam);
      if (p) return p;
    }
    return lista[Math.floor(Math.random() * lista.length)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, pranchaParam, rodada]);

  const addPontos = useProgresso((s) => s.addPontos);
  const registrarJogo = useProgresso((s) => s.registrarJogo);
  const pontosTrilha = useProgresso((s) => s.pontosPorTrilha[trilhaId] ?? 0);
  const xp = useProgresso((s) => s.xp);
  const streak = useProgresso((s) => s.streakDias);

  const [chips, setChips] = useState<ChipArrastar[]>([]);
  const [resolvidos, setResolvidos] = useState<string[]>([]);
  const [erros, setErros] = useState(0);
  const [fase, setFase] = useState<Fase>("jogando");
  const [pontos, setPontos] = useState(0);
  const [confeteKey, setConfeteKey] = useState(0);

  const imgRef = useRef<View>(null);
  const resolvidosRef = useRef<string[]>([]);
  resolvidosRef.current = resolvidos;

  // (re)inicia a rodada quando a prancha muda (troca de rodada / seleção)
  useEffect(() => {
    if (prancha) setChips(montarChips(prancha));
    setResolvidos([]);
    setErros(0);
    setPontos(0);
    setFase("jogando");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prancha]);

  const imgH = prancha ? IMG_W / prancha.aspecto : 0;
  const total = prancha ? prancha.alvos.length : 0;

  function finalizar(resolvidosFinais: number, errosFinais: number) {
    const ganhos = calcularPontosArrastar(resolvidosFinais, total, errosFinais);
    setPontos(ganhos);
    if (ganhos > 0) addPontos(trilhaId, ganhos);
    registrarJogo();
    setFase("fim");
  }

  function avaliarSoltar(chipId: string, centroX: number, centroY: number) {
    const node = imgRef.current;
    if (!node || !prancha) return;
    node.measureInWindow((x, y, w, h) => {
      const px = centroX - x;
      const py = centroY - y;
      const dentro = px >= 0 && py >= 0 && px <= w && py <= h;
      const hit = dentro
        ? alvoNoPonto(prancha.alvos, px, py, w, h, new Set(resolvidosRef.current))
        : null;

      if (hit === chipId) {
        const novos = [...resolvidosRef.current, chipId];
        setResolvidos(novos);
        setConfeteKey((k) => k + 1);
        feedback.acerto();
        if (novos.length === total) finalizar(novos.length, erros);
      } else {
        setErros((e) => e + 1);
        feedback.erro();
      }
    });
  }

  function jogarNovamente() {
    setConfeteKey(0);
    setRodada((r) => r + 1); // troca a prancha (aleatória); o efeito reinicia o resto
  }

  // --- sem prancha ---
  if (!prancha) {
    return (
      <View className="flex-1 bg-bg px-6 pt-8">
        <Stack.Screen options={{ title: "Arrastar na anatomia" }} />
        <Text className="text-ink text-lg font-bold">Sem prancha disponível</Text>
        <Text className="text-muted mt-1">A trilha "{trilhaId}" não tem pranchas de arrastar.</Text>
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
        contentContainerClassName="px-6 pt-8"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <Stack.Screen options={{ title: "Resultado" }} />
        <Text className="text-3xl font-extrabold text-ink text-center">
          {erros === 0 ? "Anatomia na ponta da língua! 🦴✨" : "Prancha concluída! 🎉"}
        </Text>

        <View className="bg-card rounded-3xl p-6 mt-6 items-center">
          <Text className="text-muted">Alvos corretos</Text>
          <Text className="text-4xl font-extrabold text-accent mt-1">
            {resolvidos.length}/{total}
          </Text>
          <Text className="text-muted mt-4">Pontos ganhos</Text>
          <Text className="text-3xl font-extrabold text-ink mt-1">+{pontos}</Text>
          {erros === 0 ? (
            <Text className="text-success text-sm font-bold mt-3">Sem erros — bônus aplicado! 🎯</Text>
          ) : (
            <Text className="text-muted text-sm mt-3">{erros} tentativa(s) errada(s)</Text>
          )}

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
              <Text className="text-muted text-xs">na anatomia</Text>
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

  // --- jogando ---
  const pendentes = chips.filter((c) => !resolvidos.includes(c.id));
  const Diagrama = prancha.diagrama ? DIAGRAMAS[prancha.diagrama] : undefined;

  return (
    <View className="flex-1 bg-bg px-6" style={{ paddingTop: 12, paddingBottom: insets.bottom + 12 }}>
      <Stack.Screen options={{ title: `Arrastar · ${prancha.titulo}` }} />

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <MotiView
          from={{ opacity: 0.14, scale: 1 }}
          animate={{ opacity: 0.24, scale: 1.2 }}
          transition={{ loop: true, type: "timing", duration: 4600 }}
          style={[styles.halo, styles.haloPrimary]}
        />
      </View>

      {/* HUD */}
      <View className="flex-row justify-between items-center mt-1">
        <Text className="text-accent text-2xl font-black">
          {resolvidos.length}
          <Text className="text-muted text-base font-bold">/{total}</Text>
          <Text className="text-muted text-xs font-semibold"> alvos</Text>
        </Text>
        <Text className={`text-xs font-semibold ${erros > 0 ? "text-error" : "text-muted"}`}>
          {erros} erro{erros === 1 ? "" : "s"}
        </Text>
      </View>

      <Text className="text-ink text-base font-bold mt-2">{prancha.titulo}</Text>
      <Text className="text-muted text-xs">Arraste cada nome até o osso certo</Text>

      {/* imagem + alvos */}
      <View className="items-center mt-3">
        <View ref={imgRef} style={{ width: IMG_W, height: imgH }}>
          {Diagrama ? (
            <View
              style={{ width: IMG_W, height: imgH, borderRadius: 12, backgroundColor: colors.surface, overflow: "hidden" }}
            >
              <Diagrama width={IMG_W} height={imgH} />
            </View>
          ) : (
            <Image
              source={{ uri: prancha.imagem }}
              resizeMode="contain"
              accessibilityLabel={prancha.titulo}
              style={{ width: IMG_W, height: imgH, borderRadius: 12, backgroundColor: "#fff" }}
            />
          )}
          {/* anéis-alvo (não resolvidos) */}
          {prancha.alvos.map((a) => {
            if (resolvidos.includes(a.id)) return null;
            return (
              <View
                key={a.id}
                pointerEvents="none"
                style={[
                  styles.alvoRing,
                  { left: a.x * IMG_W - 15, top: a.y * imgH - 15 },
                ]}
              />
            );
          })}
          {/* pílulas travadas (resolvidos) */}
          {prancha.alvos.map((a) => {
            if (!resolvidos.includes(a.id)) return null;
            return (
              <View
                key={a.id}
                pointerEvents="none"
                style={[styles.pilulaOk, { left: a.x * IMG_W - 44, top: a.y * imgH - 13 }]}
              >
                <Text className="text-white text-[11px] font-bold" numberOfLines={1}>
                  {a.rotulo}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* crédito / fonte */}
      {prancha.imagem && prancha.imagemCredito ? (
        <Pressable
          onPress={() => prancha.imagemFonte && Linking.openURL(prancha.imagemFonte).catch(() => {})}
          className="mt-1 self-center active:opacity-60"
        >
          <Text className="text-muted text-[10px]">Imagem: {prancha.imagemCredito} · Commons ↗</Text>
        </Pressable>
      ) : (
        <Text className="text-muted text-[10px] mt-1 self-center">{prancha.fonte}</Text>
      )}

      {/* banco de chips */}
      <View className="flex-1 justify-end">
        {pendentes.length > 0 ? (
          <View className="flex-row flex-wrap justify-center" style={{ gap: 10 }}>
            {pendentes.map((chip) => (
              <ChipArrastavel key={chip.id} chip={chip} onSoltar={avaliarSoltar} />
            ))}
          </View>
        ) : (
          <Text className="text-success text-center font-bold mb-2">Todos posicionados! 🎉</Text>
        )}
      </View>

      {confeteKey > 0 && <Confete key={confeteKey} />}
    </View>
  );
}

/** Chip arrastável isolado (cada um com seu próprio estado de gesto). */
function ChipArrastavel({
  chip,
  onSoltar,
}: {
  chip: ChipArrastar;
  onSoltar: (chipId: string, centroX: number, centroY: number) => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const arrastando = useSharedValue(0);
  // centro do chip (coords de janela) medido no início do arrasto
  const scx = useSharedValue(0);
  const scy = useSharedValue(0);
  const ref = useRef<any>(null);

  function medirInicio() {
    ref.current?.measureInWindow?.((x: number, y: number, w: number, h: number) => {
      scx.value = x + w / 2;
      scy.value = y + h / 2;
    });
  }

  const pan = Gesture.Pan()
    .onBegin(() => {
      arrastando.value = 1;
      runOnJS(medirInicio)();
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      // usa o CENTRO do chip (não o ponteiro): centro inicial + deslocamento
      runOnJS(onSoltar)(chip.id, scx.value + e.translationX, scy.value + e.translationY);
      tx.value = withSpring(0);
      ty.value = withSpring(0);
      arrastando.value = 0;
    });

  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: arrastando.value ? 1.08 : 1 }],
    zIndex: arrastando.value ? 50 : 1,
    elevation: arrastando.value ? 50 : 1,
    borderColor: arrastando.value ? colors.accent : "rgba(108,92,231,0.6)",
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View ref={ref} style={[styles.chip, estilo]}>
        <Text className="text-ink text-sm font-bold">{chip.rotulo}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  halo: { position: "absolute", width: 340, height: 340, borderRadius: 170 },
  haloPrimary: { top: -90, left: -80, backgroundColor: colors.primary, opacity: 0.3 },
  alvoRing: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: "rgba(0,210,168,0.12)",
  },
  pilulaOk: {
    position: "absolute",
    minWidth: 88,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: colors.successDeep,
    borderWidth: 1,
    borderColor: colors.success,
  },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
});
