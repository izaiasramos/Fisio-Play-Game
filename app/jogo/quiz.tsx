import { useEffect, useMemo, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Linking, Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { Item, Pergunta } from "@/data/schema";
import { carregarTrilha, type BancoTrilha } from "@/lib/loadTrilha";
import { gerarQuiz } from "@/lib/gerarQuiz";
import {
  QUIZ_TAMANHO,
  SEGUNDOS_POR_PERGUNTA,
  calcularPontos,
} from "@/games/quiz";
import { nivelDoXp } from "@/games/gamificacao";
import { BarraNeon } from "@/components/BarraNeon";
import { AnelTimer } from "@/components/quiz/AnelTimer";
import { useProgresso } from "@/store/useProgresso";
import { useFeedback } from "@/lib/useFeedback";
import { Confete } from "@/components/Confete";
import { FundoHalos } from "@/components/FundoHalos";
import { TextoAdaptativo } from "@/components/TextoAdaptativo";
import { usePaddingRodape } from "@/lib/useRodape";

type Fase = "jogando" | "fim";

export default function QuizScreen() {
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

  const addPontos = useProgresso((s) => s.addPontos);
  const registrarJogo = useProgresso((s) => s.registrarJogo);
  const pontosTrilha = useProgresso((s) => s.pontosPorTrilha[trilhaId] ?? 0);
  const xp = useProgresso((s) => s.xp);
  const streak = useProgresso((s) => s.streakDias);

  const [perguntas, setPerguntas] = useState<Pergunta[]>(() =>
    banco ? gerarQuiz(banco.itens, QUIZ_TAMANHO) : []
  );
  const [idx, setIdx] = useState(0);
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [respondida, setRespondida] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [pontos, setPontos] = useState(0);
  const [segundos, setSegundos] = useState(SEGUNDOS_POR_PERGUNTA);
  const [fase, setFase] = useState<Fase>("jogando");
  const [erros, setErros] = useState<Pergunta[]>([]);
  const [confeteKey, setConfeteKey] = useState(0);

  const pergunta = perguntas[idx];
  const itemAtual = pergunta ? itemDaPergunta(pergunta) : undefined;

  // shake nas alternativas quando erra
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

  // Timer regressivo por pergunta. Ao zerar, conta como erro (timeout).
  useEffect(() => {
    if (fase !== "jogando" || respondida) return;
    if (segundos <= 0) {
      responder(null);
      return;
    }
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos, fase, respondida, idx]);

  function responder(escolha: number | null) {
    if (respondida || !pergunta) return;
    const acertou = escolha === pergunta.correta;
    setSelecionada(escolha);
    setRespondida(true);
    if (acertou) {
      setAcertos((a) => a + 1);
      setPontos((p) => p + calcularPontos(true, segundos));
      setConfeteKey((k) => k + 1);
      feedback.acerto();
    } else {
      setErros((e) => [...e, pergunta]);
      dispararShake();
      feedback.erro();
    }
  }

  function avancar() {
    const proximo = idx + 1;
    if (proximo >= perguntas.length) {
      finalizar();
      return;
    }
    setIdx(proximo);
    setSelecionada(null);
    setRespondida(false);
    setSegundos(SEGUNDOS_POR_PERGUNTA);
  }

  function finalizar() {
    if (pontos > 0) addPontos(trilhaId, pontos);
    registrarJogo();
    setFase("fim");
  }

  function jogarNovamente() {
    if (!banco) return;
    setPerguntas(gerarQuiz(banco.itens, QUIZ_TAMANHO));
    setIdx(0);
    setSelecionada(null);
    setRespondida(false);
    setAcertos(0);
    setPontos(0);
    setSegundos(SEGUNDOS_POR_PERGUNTA);
    setErros([]);
    setFase("jogando");
  }

  function itemDaPergunta(p: Pergunta): Item | undefined {
    const id = p.id.replace(/^q-/, "");
    return banco?.itens.find((i) => i.id === id);
  }

  // --- trilha inexistente ---
  if (!banco || perguntas.length === 0) {
    return (
      <View className="flex-1 bg-bg px-6 pt-8">
        <Stack.Screen options={{ title: "Quiz" }} />
        <Text className="text-ink text-lg font-bold">Não foi possível iniciar o quiz</Text>
        <Text className="text-muted mt-1">Trilha "{trilhaId}" indisponível.</Text>
      </View>
    );
  }

  // --- tela de resultado ---
  if (fase === "fim") {
    const total = perguntas.length;
    return (
      <View className="flex-1 bg-bg">
        <FundoHalos />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: paddingRodape }}
        >
        <Stack.Screen options={{ title: "Resultado" }} />
        <Text className="text-3xl font-extrabold text-ink text-center">Fim de rodada! 🎉</Text>

        <View className="bg-card rounded-3xl p-6 mt-6 items-center">
          <Text className="text-muted">Acertos</Text>
          <Text className="text-4xl font-extrabold text-accent mt-1">
            {acertos}/{total}
          </Text>
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

        {erros.length > 0 && (
          <View className="mt-8">
            <Text className="text-ink text-lg font-bold">Revisão dos erros</Text>
            {erros.map((p, i) => {
              const item = itemDaPergunta(p);
              if (!item) return null;
              return (
                <View key={i} className="bg-card rounded-2xl p-4 mt-3">
                  {item.imagem && (
                    <Image
                      source={{ uri: item.imagem }}
                      resizeMode="contain"
                      accessibilityLabel={`Ilustração de ${item.termo}`}
                      className="w-full h-52 mb-1 rounded-xl bg-white"
                    />
                  )}
                  {item.imagem && item.imagemCredito && (
                    <Text
                      onPress={() =>
                        item.imagemFonte &&
                        Linking.openURL(item.imagemFonte).catch(() => {})
                      }
                      className="text-muted text-[10px] mb-2"
                    >
                      Imagem: {item.imagemCredito} · Wikimedia Commons ↗
                    </Text>
                  )}
                  <Text className="text-muted text-sm">{item.definicao}</Text>
                  <Text className="text-ink font-bold mt-2">
                    Resposta certa: {item.termo}
                  </Text>
                  <Pressable
                    onPress={() => Linking.openURL(item.urlFonte).catch(() => {})}
                    className="mt-3 self-start bg-surface rounded-xl px-3 py-2 active:opacity-70"
                  >
                    <Text className="text-accent font-semibold">Ver fonte ↗</Text>
                  </Pressable>
                  <Text className="text-muted text-[10px] mt-2">{item.fonte}</Text>
                </View>
              );
            })}
          </View>
        )}

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
        </ScrollView>
      </View>
    );
  }

  // --- jogo em andamento ---

  return (
    <View className="flex-1 bg-bg">
      <FundoHalos />
      <Stack.Screen options={{ title: `Quiz · ${banco.trilha.nome}` }} />

      {/* Rolável: com imagem de apoio + alternativas longas o conteúdo passa da
          tela em aparelhos menores. flexGrow mantém o botão "Próxima" no rodapé
          quando sobra espaço. */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: paddingRodape,
        }}
      >
      {/* hero: anel de tempo + progresso da rodada */}
      <View className="items-center mt-1">
        <AnelTimer
          segundos={segundos}
          total={SEGUNDOS_POR_PERGUNTA}
          estado={respondida ? (selecionada === pergunta.correta ? "certo" : "errado") : "correndo"}
          tamanho={104}
        />
        <Text className="text-muted text-[11px] font-semibold tracking-widest uppercase mt-2">
          Pergunta {idx + 1} de {perguntas.length}
        </Text>
      </View>
      <View className="mt-3">
        <BarraNeon pct={((idx + (respondida ? 1 : 0)) / perguntas.length) * 100} tom="primary" />
      </View>

      {/* enunciado */}
      <Text className="text-xl font-bold text-ink mt-8">{pergunta.enunciado}</Text>

      {/* imagem de apoio (quando o item tiver) */}
      {itemAtual?.imagem && (
        <View className="mt-4">
          <Image
            source={{ uri: itemAtual.imagem }}
            resizeMode="contain"
            accessibilityLabel={`Ilustração de ${itemAtual.termo}`}
            className="w-full h-64 rounded-2xl bg-white"
          />
          <Text
            onPress={() => Linking.openURL(itemAtual.imagem!).catch(() => {})}
            className="text-accent text-xs mt-1 text-center"
          >
            Ampliar imagem ↗
          </Text>
          {itemAtual.imagemCredito && (
            <Text
              onPress={() =>
                itemAtual.imagemFonte &&
                Linking.openURL(itemAtual.imagemFonte).catch(() => {})
              }
              className="text-muted text-[10px] mt-1 text-center"
            >
              Imagem: {itemAtual.imagemCredito} · Wikimedia Commons ↗
            </Text>
          )}
        </View>
      )}

      {/* alternativas (com shake no erro) */}
      <Animated.View style={estiloShake} className="mt-6">
        <View className="gap-3">
          {pergunta.alternativas.map((alt, i) => {
            let estilo = "bg-surface";
            if (respondida) {
              if (i === pergunta.correta) estilo = "bg-successDeep";
              else if (i === selecionada) estilo = "bg-error";
              else estilo = "bg-surface opacity-50";
            }
            return (
              <Pressable
                key={i}
                disabled={respondida}
                onPress={() => responder(i)}
                accessibilityRole="button"
                accessibilityLabel={`Alternativa ${String.fromCharCode(65 + i)}: ${alt}`}
                accessibilityState={{ disabled: respondida }}
                className={`${estilo} rounded-2xl px-4 py-4 active:opacity-80`}
              >
                <TextoAdaptativo lhPx={24} className="text-ink text-base font-medium">
                  {String.fromCharCode(65 + i)}. {alt}
                </TextoAdaptativo>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      <View className="flex-1" />

      {/* rodapé: avançar (só após responder) */}
      {respondida && (
        <Pressable
          onPress={avancar}
          className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-white text-lg font-bold">
            {idx + 1 >= perguntas.length ? "Ver resultado" : "Próxima"}
          </Text>
        </Pressable>
      )}
      </ScrollView>

      {/* confete de acerto (remonta a cada acerto via key) */}
      {confeteKey > 0 && <Confete key={confeteKey} />}
    </View>
  );
}
