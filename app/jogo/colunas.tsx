import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";
import { carregarTrilha, type BancoTrilha } from "@/lib/loadTrilha";
import {
  PARES_POR_RODADA,
  type CartaColuna,
  type Colunas,
  calcularPontosColunas,
  casaColuna,
  montarColunas,
} from "@/games/colunas";
import { nivelDoXp } from "@/games/gamificacao";
import { BarraNeon } from "@/components/BarraNeon";
import { ElosColunas } from "@/components/colunas/ElosColunas";
import { useProgresso } from "@/store/useProgresso";
import { useFeedback } from "@/lib/useFeedback";
import { Confete } from "@/components/Confete";
import { TextoAdaptativo } from "@/components/TextoAdaptativo";
import { colors } from "@/theme/tokens";

type Fase = "jogando" | "fim";

export default function ColunasScreen() {
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

  const [colunas, setColunas] = useState<Colunas>(() =>
    banco ? montarColunas(banco.itens, PARES_POR_RODADA) : { esquerda: [], direita: [] }
  );
  const [selEsq, setSelEsq] = useState<string | null>(null);
  const [selDir, setSelDir] = useState<string | null>(null);
  const [casados, setCasados] = useState<Set<string>>(new Set()); // itemIds já ligados
  const [errado, setErrado] = useState<[string, string] | null>(null); // par em erro (shake)
  const [travado, setTravado] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [erros, setErros] = useState(0);
  const [fase, setFase] = useState<Fase>("jogando");
  const [pontos, setPontos] = useState(0);
  const [confeteKey, setConfeteKey] = useState(0);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const totalPares = colunas.esquerda.length;

  // avalia quando há uma carta selecionada em cada coluna
  useEffect(() => {
    if (!selEsq || !selDir || travado) return;
    const a = colunas.esquerda.find((c) => c.id === selEsq);
    const b = colunas.direita.find((c) => c.id === selDir);
    if (!a || !b) return;

    setTravado(true);
    if (casaColuna(a, b)) {
      const novos = new Set(casados);
      novos.add(a.itemId);
      setCasados(novos);
      const novosAcertos = acertos + 1;
      setAcertos(novosAcertos);
      setSelEsq(null);
      setSelDir(null);
      setTravado(false);
      setConfeteKey((k) => k + 1);
      feedback.acerto();
      if (novosAcertos === totalPares) finalizar(novosAcertos, erros);
    } else {
      setErros((e) => e + 1);
      setErrado([a.id, b.id]);
      feedback.erro();
      timeoutRef.current = setTimeout(() => {
        setErrado(null);
        setSelEsq(null);
        setSelDir(null);
        setTravado(false);
      }, 700);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selEsq, selDir]);

  function tocarEsq(carta: CartaColuna) {
    if (travado || fase === "fim" || casados.has(carta.itemId)) return;
    Haptics.selectionAsync().catch(() => {});
    setSelEsq((cur) => (cur === carta.id ? null : carta.id));
  }

  function tocarDir(carta: CartaColuna) {
    if (travado || fase === "fim" || casados.has(carta.itemId)) return;
    Haptics.selectionAsync().catch(() => {});
    setSelDir((cur) => (cur === carta.id ? null : carta.id));
  }

  function finalizar(acertosFinais: number, errosFinais: number) {
    const ganhos = calcularPontosColunas(acertosFinais, errosFinais);
    setPontos(ganhos);
    if (ganhos > 0) addPontos(trilhaId, ganhos);
    registrarJogo();
    setFase("fim");
  }

  function jogarNovamente() {
    if (!banco) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setColunas(montarColunas(banco.itens, PARES_POR_RODADA));
    setSelEsq(null);
    setSelDir(null);
    setCasados(new Set());
    setErrado(null);
    setTravado(false);
    setAcertos(0);
    setErros(0);
    setPontos(0);
    setFase("jogando");
  }

  // --- trilha inexistente ---
  if (!banco || totalPares === 0) {
    return (
      <View className="flex-1 bg-bg px-6 pt-8">
        <Stack.Screen options={{ title: "Colunas" }} />
        <Text className="text-ink text-lg font-bold">Não foi possível iniciar as Colunas</Text>
        <Text className="text-muted mt-1">Trilha "{trilhaId}" indisponível.</Text>
      </View>
    );
  }

  // --- tela de resultado ---
  if (fase === "fim") {
    return (
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerClassName="px-6 pt-8"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <Stack.Screen options={{ title: "Resultado" }} />
        <Text className="text-3xl font-extrabold text-ink text-center">
          {erros === 0 ? "Perfeito! 🔗✨" : "Rodada concluída! 🎉"}
        </Text>

        <View className="bg-card rounded-3xl p-6 mt-6 items-center">
          <Text className="text-muted">Associações corretas</Text>
          <Text className="text-4xl font-extrabold text-accent mt-1">
            {totalPares}/{totalPares}
          </Text>
          <Text className="text-muted mt-4">
            {erros} {erros === 1 ? "erro" : "erros"}
          </Text>
          <Text className="text-muted mt-4">Pontos ganhos</Text>
          <Text className="text-3xl font-extrabold text-ink mt-1">+{pontos}</Text>
          {erros === 0 && (
            <Text className="text-success text-xs mt-1 font-semibold">
              inclui bônus de partida perfeita
            </Text>
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
              <Text className="text-muted text-xs">na {banco.trilha.nome}</Text>
            </View>
          </View>
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

        {confeteKey > 0 && <Confete key={confeteKey} />}
      </ScrollView>
    );
  }

  // --- jogo em andamento ---
  const progresso = (acertos / totalPares) * 100;

  const estiloCarta = (carta: CartaColuna, selecionada: boolean) => {
    const casada = casados.has(carta.itemId);
    const emErro = errado?.includes(carta.id) ?? false;
    if (casada) return "bg-surface border border-success/40 opacity-40";
    if (emErro) return "bg-error/20 border border-error";
    if (selecionada) return "bg-card border border-accent";
    return "bg-card border border-white/5";
  };

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: `Colunas · ${banco.trilha.nome}` }} />

      {/* fundo futurista */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <MotiView
          from={{ opacity: 0.15, scale: 1 }}
          animate={{ opacity: 0.28, scale: 1.25 }}
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
        contentContainerClassName="px-6 pt-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        {/* HUD */}
        <View className="flex-row justify-between items-end">
          <View>
            <Text className="text-accent text-3xl font-black">
              {acertos}
              <Text className="text-muted text-lg font-bold">/{totalPares}</Text>
            </Text>
            <Text className="text-muted text-[11px] font-semibold tracking-widest uppercase">
              associações
            </Text>
          </View>
          <Text className="text-error text-xs font-semibold">{erros} erros</Text>
        </View>

        <View className="mt-3">
          <BarraNeon pct={progresso} />
        </View>

        {/* hero: elos que ligam */}
        <View className="items-center mt-4">
          <ElosColunas total={totalPares} ativos={acertos} erros={erros} />
        </View>

        <Text className="text-muted text-xs mt-3">
          Toque um <Text className="text-primary font-bold">TERMO</Text> e depois a sua{" "}
          <Text className="text-accent font-bold">DEFINIÇÃO</Text>. O par certo trava.
        </Text>

        {/* duas colunas */}
        <View className="flex-row mt-5" style={{ gap: 10 }}>
          {/* esquerda: termos */}
          <View className="flex-1" style={{ gap: 10 }}>
            <Text className="text-primary text-[11px] font-bold uppercase tracking-widest mb-1">
              Termo
            </Text>
            {colunas.esquerda.map((carta, i) => {
              const selecionada = selEsq === carta.id;
              return (
                <MotiView
                  key={carta.id}
                  from={{ opacity: 0, translateX: -16 }}
                  animate={{
                    opacity: 1,
                    translateX: errado?.[0] === carta.id ? [0, -6, 6, -4, 0] : 0,
                  }}
                  transition={{ type: "timing", duration: 260, delay: i * 60 }}
                >
                  <Pressable
                    onPress={() => tocarEsq(carta)}
                    disabled={casados.has(carta.itemId)}
                    className={`rounded-2xl px-3 h-[108px] justify-center ${estiloCarta(
                      carta,
                      selecionada
                    )}`}
                  >
                    <TextoAdaptativo
                      lhPx={20}
                      className="text-ink font-semibold text-sm leading-5"
                    >
                      {carta.texto}
                    </TextoAdaptativo>
                  </Pressable>
                </MotiView>
              );
            })}
          </View>

          {/* direita: definições */}
          <View className="flex-1" style={{ gap: 10 }}>
            <Text className="text-accent text-[11px] font-bold uppercase tracking-widest mb-1">
              Definição
            </Text>
            {colunas.direita.map((carta, i) => {
              const selecionada = selDir === carta.id;
              return (
                <MotiView
                  key={carta.id}
                  from={{ opacity: 0, translateX: 16 }}
                  animate={{
                    opacity: 1,
                    translateX: errado?.[1] === carta.id ? [0, 6, -6, 4, 0] : 0,
                  }}
                  transition={{ type: "timing", duration: 260, delay: i * 60 }}
                >
                  <Pressable
                    onPress={() => tocarDir(carta)}
                    disabled={casados.has(carta.itemId)}
                    className={`rounded-2xl px-3 h-[108px] justify-center ${estiloCarta(
                      carta,
                      selecionada
                    )}`}
                  >
                    <TextoAdaptativo
                      lhPx={16}
                      className="text-inkSoft text-[12px] leading-[16px]"
                    >
                      {carta.texto}
                    </TextoAdaptativo>
                  </Pressable>
                </MotiView>
              );
            })}
          </View>
        </View>
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
});
