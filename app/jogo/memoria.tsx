import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";
import { carregarTrilha, type BancoTrilha } from "@/lib/loadTrilha";
import {
  PARES_POR_RODADA,
  type Carta,
  calcularPontosMemoria,
  casaPar,
  montarBaralho,
} from "@/games/memoria";
import { nivelDoXp } from "@/games/gamificacao";
import { BarraNeon } from "@/components/BarraNeon";
import { NucleoSinapse } from "@/components/memoria/NucleoSinapse";
import { useProgresso } from "@/store/useProgresso";
import { useFeedback } from "@/lib/useFeedback";
import { Confete } from "@/components/Confete";
import { CartaMemoria } from "@/components/CartaMemoria";
import { colors } from "@/theme/tokens";

type Fase = "jogando" | "fim";

export default function MemoriaScreen() {
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

  const [cartas, setCartas] = useState<Carta[]>(() =>
    banco ? montarBaralho(banco.itens, PARES_POR_RODADA) : []
  );
  const [viradas, setViradas] = useState<string[]>([]); // ids virados no momento (0..2)
  const [casadas, setCasadas] = useState<Set<string>>(new Set()); // ids já casados
  const [travado, setTravado] = useState(false); // bloqueia toques durante a checagem
  const [aguardando, setAguardando] = useState(false); // par errado à mostra, esperando leitura/toque
  const [erros, setErros] = useState(0);
  const [jogadas, setJogadas] = useState(0);
  const [fase, setFase] = useState<Fase>("jogando");
  const [pontos, setPontos] = useState(0);
  const [confeteKey, setConfeteKey] = useState(0);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const totalPares = cartas.length / 2;
  const paresEncontrados = casadas.size / 2;

  function virar(carta: Carta) {
    if (travado || fase === "fim") return;
    if (casadas.has(carta.id) || viradas.includes(carta.id)) return;
    Haptics.selectionAsync().catch(() => {});

    const proximas = [...viradas, carta.id];
    setViradas(proximas);

    if (proximas.length < 2) return;

    // segunda carta virada → avalia o par
    setJogadas((j) => j + 1);
    setTravado(true);
    const [aId, bId] = proximas;
    const a = cartas.find((c) => c.id === aId)!;
    const b = cartas.find((c) => c.id === bId)!;

    if (casaPar(a, b)) {
      const novasCasadas = new Set(casadas);
      novasCasadas.add(aId);
      novasCasadas.add(bId);
      setCasadas(novasCasadas);
      setViradas([]);
      setTravado(false);
      setConfeteKey((k) => k + 1);
      feedback.acerto();
      // vitória: o lance vencedor é um acerto, então `erros` já está final aqui
      if (novasCasadas.size === cartas.length) finalizar(erros);
    } else {
      setErros((e) => e + 1);
      feedback.erro();
      setAguardando(true);
      // Tempo de leitura proporcional ao texto (mais texto = mais tempo), com
      // piso e teto. O usuário também pode tocar em qualquer lugar para continuar.
      const maxLen = Math.max(a.texto.length, b.texto.length);
      const espera = Math.min(6000, 1600 + maxLen * 35);
      timeoutRef.current = setTimeout(desvirar, espera);
    }
  }

  // desvira o par errado (por tempo esgotado ou toque do usuário)
  function desvirar() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setViradas([]);
    setTravado(false);
    setAguardando(false);
  }

  function finalizar(errosFinais: number) {
    const ganhos = calcularPontosMemoria(totalPares, errosFinais);
    setPontos(ganhos);
    if (ganhos > 0) addPontos(trilhaId, ganhos);
    registrarJogo();
    setFase("fim");
  }

  function jogarNovamente() {
    if (!banco) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCartas(montarBaralho(banco.itens, PARES_POR_RODADA));
    setViradas([]);
    setCasadas(new Set());
    setTravado(false);
    setAguardando(false);
    setErros(0);
    setJogadas(0);
    setPontos(0);
    setFase("jogando");
  }

  // --- trilha inexistente ---
  if (!banco || cartas.length === 0) {
    return (
      <View className="flex-1 bg-bg px-6 pt-8">
        <Stack.Screen options={{ title: "Memória" }} />
        <Text className="text-ink text-lg font-bold">Não foi possível iniciar a Memória</Text>
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
          {erros === 0 ? "Memória perfeita! 🧠✨" : "Rodada concluída! 🎉"}
        </Text>

        <View className="bg-card rounded-3xl p-6 mt-6 items-center">
          <Text className="text-muted">Pares encontrados</Text>
          <Text className="text-4xl font-extrabold text-accent mt-1">
            {totalPares}/{totalPares}
          </Text>
          <Text className="text-muted mt-4">
            {jogadas} jogadas · {erros} {erros === 1 ? "erro" : "erros"}
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
  const progresso = (paresEncontrados / totalPares) * 100;

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: `Memória · ${banco.trilha.nome}` }} />

      {/* fundo futurista: halos de luz que respiram atrás da grade */}
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
              {paresEncontrados}
              <Text className="text-muted text-lg font-bold">/{totalPares}</Text>
            </Text>
            <Text className="text-muted text-[11px] font-semibold tracking-widest uppercase">
              pares
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-ink text-base font-bold">{jogadas} jogadas</Text>
            <Text className="text-error text-xs font-semibold">{erros} erros</Text>
          </View>
        </View>

        {/* barra de progresso com brilho */}
        <View className="mt-3">
          <BarraNeon pct={progresso} />
        </View>

        {/* hero: núcleo de sinapses */}
        <View className="items-center mt-4">
          <NucleoSinapse total={totalPares} ativos={paresEncontrados} erros={erros} />
        </View>

        <Text className="text-muted text-xs mt-3">
          Vire duas cartas e case cada <Text className="text-primary font-bold">TERMO</Text> com a
          sua <Text className="text-accent font-bold">DEFINIÇÃO</Text>. O par certo trava em verde.
        </Text>

        {/* grade de cartas (2 colunas) com flip 3D */}
        <View className="flex-row flex-wrap justify-between mt-5">
          {cartas.map((carta, i) => (
            <CartaMemoria
              key={carta.id}
              carta={carta}
              index={i}
              virada={viradas.includes(carta.id) || casadas.has(carta.id)}
              casada={casadas.has(carta.id)}
              bloqueada={travado}
              onPress={() => virar(carta)}
            />
          ))}
        </View>
      </ScrollView>

      {/* par errado à mostra: toque em qualquer lugar para desvirar antes do tempo */}
      {aguardando && (
        <Pressable
          onPress={desvirar}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Toque para continuar"
        >
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 24, alignItems: "center" }}
          >
            <View className="bg-surface border border-white/10 rounded-full px-4 py-2">
              <Text className="text-inkSoft text-xs font-semibold">
                Toque em qualquer lugar para continuar
              </Text>
            </View>
          </View>
        </Pressable>
      )}

      {confeteKey > 0 && <Confete key={confeteKey} />}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  haloPrimary: {
    top: -80,
    left: -70,
    backgroundColor: colors.primary,
    opacity: 0.35,
  },
  haloAccent: {
    bottom: 40,
    right: -90,
    backgroundColor: colors.accent,
    opacity: 0.3,
  },
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
