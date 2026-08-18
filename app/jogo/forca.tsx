import { useMemo, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { Item } from "@/data/schema";
import { carregarTrilha, type BancoTrilha } from "@/lib/loadTrilha";
import {
  ALFABETO,
  MAX_ERROS,
  calcularPontosForca,
  contarErros,
  escolherItemForca,
  letraCorreta,
  mascarar,
  normalizar,
  perdeu,
  venceu,
} from "@/games/forca";
import { nivelDoXp } from "@/games/gamificacao";
import { BarraNeon } from "@/components/BarraNeon";
import { useProgresso } from "@/store/useProgresso";
import { useFeedback } from "@/lib/useFeedback";
import { Confete } from "@/components/Confete";
import { FundoHalos } from "@/components/FundoHalos";
import { MonitorVital } from "@/components/forca/MonitorVital";

type Fase = "jogando" | "fim";

export default function ForcaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const addPontos = useProgresso((s) => s.addPontos);
  const registrarJogo = useProgresso((s) => s.registrarJogo);
  const pontosTrilha = useProgresso((s) => s.pontosPorTrilha[trilhaId] ?? 0);
  const xp = useProgresso((s) => s.xp);
  const streak = useProgresso((s) => s.streakDias);

  const [item, setItem] = useState<Item | null>(() =>
    banco ? escolherItemForca(banco.itens) : null
  );
  const [tentadas, setTentadas] = useState<Set<string>>(new Set());
  const [fase, setFase] = useState<Fase>("jogando");
  const [pontos, setPontos] = useState(0);
  const [ganhou, setGanhou] = useState(false);
  const [confeteKey, setConfeteKey] = useState(0);

  // shake do termo quando erra uma letra
  const shakeX = useSharedValue(0);
  const estiloShake = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));
  function dispararShake() {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 45 }),
      withTiming(10, { duration: 45 }),
      withTiming(-7, { duration: 45 }),
      withTiming(7, { duration: 45 }),
      withTiming(0, { duration: 45 })
    );
  }

  const termo = item?.termo ?? "";
  const erros = contarErros(termo, tentadas);
  const celulas = useMemo(() => mascarar(termo, tentadas), [termo, tentadas]);

  function chutar(letra: string) {
    if (fase !== "fim") Haptics.selectionAsync().catch(() => {});
    if (!item || fase === "fim") return;
    const norm = normalizar(letra);
    if (tentadas.has(norm)) return;

    const proximas = new Set(tentadas);
    proximas.add(norm);
    setTentadas(proximas);

    const acertouLetra = letraCorreta(termo, norm);
    if (!acertouLetra) dispararShake();

    // Fim de jogo?
    if (venceu(termo, proximas)) {
      finalizar(true, proximas);
    } else if (perdeu(termo, proximas)) {
      finalizar(false, proximas);
    }
  }

  function finalizar(venceuJogo: boolean, tentativasFinais: Set<string>) {
    const errosFinais = contarErros(termo, tentativasFinais);
    const ganhos = calcularPontosForca(venceuJogo, errosFinais);
    setGanhou(venceuJogo);
    setPontos(ganhos);
    if (ganhos > 0) addPontos(trilhaId, ganhos);
    registrarJogo();
    if (venceuJogo) {
      setConfeteKey((k) => k + 1);
      feedback.acerto();
    } else {
      feedback.erro();
    }
    setFase("fim");
  }

  function jogarNovamente() {
    if (!banco) return;
    setItem(escolherItemForca(banco.itens));
    setTentadas(new Set());
    setPontos(0);
    setGanhou(false);
    setFase("jogando");
  }

  // --- trilha inexistente ---
  if (!banco || !item) {
    return (
      <View className="flex-1 bg-bg px-6 pt-8">
        <Stack.Screen options={{ title: "Forca" }} />
        <Text className="text-ink text-lg font-bold">Não foi possível iniciar a Forca</Text>
        <Text className="text-muted mt-1">Trilha "{trilhaId}" indisponível.</Text>
      </View>
    );
  }

  // --- tela de resultado ---
  if (fase === "fim") {
    return (
      <View className="flex-1 bg-bg">
        <FundoHalos />
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pt-8"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
        <Stack.Screen options={{ title: "Resultado" }} />
        <Text className="text-3xl font-extrabold text-ink text-center">
          {ganhou ? "Você acertou! 🎉" : "Que pena! 💀"}
        </Text>

        <View className="items-center mt-5">
          <MonitorVital erros={erros} maxErros={MAX_ERROS} estado={ganhou ? "ganhou" : "perdeu"} />
        </View>

        <View className="bg-card rounded-3xl p-6 mt-6 items-center">
          <Text className="text-muted">A palavra era</Text>
          <Text className="text-3xl font-extrabold text-accent mt-1 text-center">
            {item.termo}
          </Text>

          {item.imagem && (
            <Image
              source={{ uri: item.imagem }}
              resizeMode="contain"
              accessibilityLabel={`Ilustração de ${item.termo}`}
              className="w-full h-52 mt-4 rounded-xl bg-white"
            />
          )}

          <Text className="text-muted text-sm mt-4 text-center">{item.definicao}</Text>
          <Text className="text-muted mt-5">Pontos ganhos</Text>
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

          <Pressable
            onPress={() => Linking.openURL(item.urlFonte).catch(() => {})}
            className="mt-5 self-center bg-surface rounded-xl px-3 py-2 active:opacity-70"
          >
            <Text className="text-accent font-semibold">Ver fonte ↗</Text>
          </Pressable>
          <Text className="text-muted text-[10px] mt-2">{item.fonte}</Text>
        </View>

        <Pressable
          onPress={jogarNovamente}
          className="mt-8 bg-primary rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-white text-lg font-bold">Jogar de novo</Text>
        </Pressable>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          className="mt-3 rounded-2xl py-4 items-center active:opacity-60"
        >
          <Text className="text-muted text-base font-semibold">Voltar</Text>
        </Pressable>

        {confeteKey > 0 && ganhou && <Confete key={confeteKey} />}
        </ScrollView>
      </View>
    );
  }

  // --- jogo em andamento ---
  const vidasRestantes = MAX_ERROS - erros;
  const progressoErro = (erros / MAX_ERROS) * 100;

  return (
    <View className="flex-1 bg-bg">
      <FundoHalos />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
      <Stack.Screen options={{ title: `Forca · ${banco.trilha.nome}` }} />

      {/* monitor de sinais vitais reativo + vidas restantes */}
      <View className="items-center mt-4">
        <MonitorVital erros={erros} maxErros={MAX_ERROS} estado="jogando" />
        <Text className="text-muted font-semibold mt-2">
          {vidasRestantes} {vidasRestantes === 1 ? "tentativa" : "tentativas"} restantes
        </Text>
      </View>
      <View className="mt-3">
        <BarraNeon pct={progressoErro} altura={8} tom="warning" critico={erros >= MAX_ERROS - 1} />
      </View>

      {/* dica: a definição do termo */}
      <View className="bg-card rounded-2xl p-4 mt-6">
        <Text className="text-muted text-xs uppercase tracking-wide">Dica</Text>
        <Text className="text-ink mt-1">{item.definicao}</Text>
      </View>

      {/* termo mascarado */}
      <Animated.View style={estiloShake} className="mt-8">
        <View className="flex-row flex-wrap justify-center gap-x-2 gap-y-3">
          {celulas.map((cel, i) => {
            if (!cel.ehLetra) {
              // espaço/hífen: mostra o caractere sem traço, servindo de separador
              return (
                <View key={i} className="w-4 items-center justify-end">
                  <Text className="text-ink text-2xl font-bold">
                    {cel.char === " " ? "" : cel.char}
                  </Text>
                </View>
              );
            }
            return (
              <View key={i} className="w-7 items-center border-b-2 border-muted pb-1">
                <Text className="text-ink text-2xl font-extrabold">
                  {cel.revelado ? cel.char : " "}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <View className="h-8" />

      {/* teclado A–Z */}
      <View className="flex-row flex-wrap justify-center gap-2">
        {ALFABETO.map((letra) => {
          const usada = tentadas.has(letra);
          const naPalavra = letraCorreta(termo, letra);
          let estilo = "bg-surface";
          if (usada) estilo = naPalavra ? "bg-successDeep" : "bg-card opacity-40";
          return (
            <Pressable
              key={letra}
              disabled={usada}
              onPress={() => chutar(letra)}
              accessibilityRole="button"
              accessibilityLabel={`Letra ${letra}`}
              accessibilityState={{ disabled: usada }}
              className={`${estilo} w-11 h-12 rounded-xl items-center justify-center active:opacity-70`}
            >
              <Text className="text-ink text-lg font-bold">{letra}</Text>
            </Pressable>
          );
        })}
      </View>
      </ScrollView>
    </View>
  );
}
