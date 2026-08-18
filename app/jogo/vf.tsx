import { useEffect, useMemo, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { carregarTrilha, type BancoTrilha } from "@/lib/loadTrilha";
import {
  AFIRMACOES_POR_RODADA,
  SEGUNDOS_POR_AFIRMACAO,
  type AfirmacaoVF,
  acertouVF,
  montarRodadaVF,
  pontosAfirmacao,
} from "@/games/vf";
import { nivelDoXp } from "@/games/gamificacao";
import { BarraNeon } from "@/components/BarraNeon";
import { NucleoCombo } from "@/components/vf/NucleoCombo";
import { useProgresso } from "@/store/useProgresso";
import { useFeedback } from "@/lib/useFeedback";
import { Confete } from "@/components/Confete";
import { colors } from "@/theme/tokens";

type Fase = "jogando" | "fim";

export default function VerdadeiroFalsoScreen() {
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

  const [afirmacoes, setAfirmacoes] = useState<AfirmacaoVF[]>(() => {
    try {
      return montarRodadaVF(carregarTrilha(trilhaId).itens, AFIRMACOES_POR_RODADA);
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
  const [resposta, setResposta] = useState<boolean | null>(null);
  const [respondido, setRespondido] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [fase, setFase] = useState<Fase>("jogando");
  const [pontos, setPontos] = useState(0);
  const [segundos, setSegundos] = useState(SEGUNDOS_POR_AFIRMACAO);
  const [sequencia, setSequencia] = useState(0);
  const [melhorSequencia, setMelhorSequencia] = useState(0);
  const [confeteKey, setConfeteKey] = useState(0);

  const atual = afirmacoes[idx];
  const total = afirmacoes.length;
  const acertou = respondido && resposta !== null && acertouVF(atual, resposta);

  // Timer regressivo por afirmação. Ao zerar, conta como erro (timeout).
  useEffect(() => {
    if (fase !== "jogando" || respondido) return;
    if (segundos <= 0) {
      responder(null);
      return;
    }
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segundos, fase, respondido, idx]);

  function responder(r: boolean | null) {
    if (respondido || !atual) return;
    setResposta(r);
    setRespondido(true);
    const ok = r !== null && acertouVF(atual, r);
    if (ok) {
      const novaSeq = sequencia + 1;
      setSequencia(novaSeq);
      setMelhorSequencia((m) => Math.max(m, novaSeq));
      setAcertos((a) => a + 1);
      setPontos((p) => p + pontosAfirmacao(true, segundos, novaSeq));
      setConfeteKey((k) => k + 1);
      feedback.acerto();
    } else {
      setSequencia(0);
      feedback.erro();
    }
  }

  function avancar() {
    if (idx < total - 1) {
      setIdx((n) => n + 1);
      setResposta(null);
      setRespondido(false);
      setSegundos(SEGUNDOS_POR_AFIRMACAO);
    } else {
      if (pontos > 0) addPontos(trilhaId, pontos);
      registrarJogo();
      setFase("fim");
    }
  }

  function jogarNovamente() {
    try {
      setAfirmacoes(montarRodadaVF(carregarTrilha(trilhaId).itens, AFIRMACOES_POR_RODADA));
    } catch {
      setAfirmacoes([]);
    }
    setIdx(0);
    setResposta(null);
    setRespondido(false);
    setAcertos(0);
    setPontos(0);
    setSegundos(SEGUNDOS_POR_AFIRMACAO);
    setSequencia(0);
    setMelhorSequencia(0);
    setFase("jogando");
  }

  // --- sem conteúdo ---
  if (!banco || total === 0) {
    return (
      <View className="flex-1 bg-bg px-6 pt-8">
        <Stack.Screen options={{ title: "Verdadeiro ou Falso" }} />
        <Text className="text-ink text-lg font-bold">Sem afirmações disponíveis</Text>
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
        contentContainerClassName="px-6 pt-8"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <Stack.Screen options={{ title: "Resultado" }} />
        <Text className="text-3xl font-extrabold text-ink text-center">
          {acertos === total ? "Olho clínico afiado! ⚖️✨" : "Rodada concluída! 🎉"}
        </Text>

        <View className="bg-card rounded-3xl p-6 mt-6 items-center">
          <Text className="text-muted">Acertos</Text>
          <Text className="text-4xl font-extrabold text-accent mt-1">{acertos}/{total}</Text>
          <Text className="text-muted mt-4">Pontos ganhos</Text>
          <Text className="text-3xl font-extrabold text-ink mt-1">+{pontos}</Text>
          {melhorSequencia >= 2 && (
            <Text className="text-warning text-sm font-bold mt-3">
              🔥 Melhor sequência: {melhorSequencia}
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

  // --- afirmação em andamento ---
  const tempoPct = (segundos / SEGUNDOS_POR_AFIRMACAO) * 100;

  const corBotao = (valor: boolean): object => {
    if (!respondido) {
      return valor ? styles.btnV : styles.btnF;
    }
    // após responder: destaca a resposta certa; marca em vermelho a escolha errada
    if (valor === atual.verdadeiro) return styles.btnCerto;
    if (valor === resposta) return styles.btnErrado;
    return styles.btnApagado;
  };

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: `V ou F · ${banco.trilha.nome}` }} />

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
        contentContainerClassName="px-6 pt-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* HUD */}
        <View className="flex-row justify-between items-center">
          <Text className="text-accent text-3xl font-black">
            {idx + 1}
            <Text className="text-muted text-lg font-bold">/{total}</Text>
          </Text>
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Text className="text-success text-xs font-semibold">{acertos} acertos</Text>
            <Text className={`text-sm font-black ${segundos <= 5 ? "text-error" : "text-muted"}`}>
              {segundos}s
            </Text>
          </View>
        </View>
        <View className="mt-3">
          <BarraNeon pct={tempoPct} critico={segundos <= 5} />
        </View>

        {/* hero: núcleo de combo */}
        <View className="items-center mt-4">
          <NucleoCombo
            sequencia={sequencia}
            max={AFIRMACOES_POR_RODADA}
            estado={!respondido ? "carregando" : acertou ? "acerto" : "erro"}
          />
        </View>

        {/* afirmação */}
        <MotiView
          key={atual.id}
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300 }}
        >
          <View className="bg-card rounded-3xl p-5 mt-5">
            <Text className="text-accent text-[10px] uppercase tracking-widest font-bold">
              Verdadeiro ou falso?
            </Text>
            <Text className="text-ink mt-3 text-xl font-bold leading-7">{atual.termo}</Text>
            <Text className="text-muted text-xs mt-1 mb-2">é definido como:</Text>
            <Text className="text-inkSoft text-base leading-6">{atual.definicao}</Text>
          </View>
        </MotiView>

        {/* botões V / F */}
        <View className="flex-row mt-6" style={{ gap: 12 }}>
          <Pressable
            onPress={() => responder(true)}
            disabled={respondido}
            accessibilityRole="button"
            accessibilityLabel="Verdadeiro"
            style={corBotao(true)}
            className="flex-1 rounded-2xl py-6 items-center active:opacity-80"
          >
            <Text className="text-2xl">✓</Text>
            <Text className="text-ink font-bold mt-1">Verdadeiro</Text>
          </Pressable>
          <Pressable
            onPress={() => responder(false)}
            disabled={respondido}
            accessibilityRole="button"
            accessibilityLabel="Falso"
            style={corBotao(false)}
            className="flex-1 rounded-2xl py-6 items-center active:opacity-80"
          >
            <Text className="text-2xl">✕</Text>
            <Text className="text-ink font-bold mt-1">Falso</Text>
          </Pressable>
        </View>

        {/* feedback + fonte */}
        {respondido && (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 280 }}
          >
            <View className="bg-surface rounded-2xl p-4 mt-6">
              <Text className={`font-bold ${acertou ? "text-success" : "text-error"}`}>
                {acertou ? "Correto!" : atual.verdadeiro ? "Era verdadeiro" : "Era falso"}
              </Text>
              {!atual.verdadeiro && (
                <Text className="text-muted text-sm mt-1 leading-5">
                  {atual.termo} é, na verdade: {atual.definicaoCorreta}
                </Text>
              )}
              <Pressable
                onPress={() => Linking.openURL(atual.urlFonte).catch(() => {})}
                className="mt-3 active:opacity-60"
              >
                <Text className="text-primary text-sm font-semibold">Ver fonte ↗</Text>
              </Pressable>
            </View>

            <Pressable onPress={avancar} className="mt-5 bg-primary rounded-2xl py-4 items-center active:opacity-80">
              <Text className="text-white text-lg font-bold">
                {idx < total - 1 ? "Próxima" : "Ver resultado"}
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
  comboChip: {
    backgroundColor: "rgba(251,191,36,0.15)",
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
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
  btnV: {
    backgroundColor: "rgba(34,197,94,0.14)",
    borderWidth: 1.5,
    borderColor: colors.success,
  },
  btnF: {
    backgroundColor: "rgba(255,90,95,0.14)",
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  btnCerto: {
    backgroundColor: "rgba(34,197,94,0.2)",
    borderWidth: 1.5,
    borderColor: colors.success,
  },
  btnErrado: {
    backgroundColor: "rgba(255,90,95,0.2)",
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  btnApagado: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    opacity: 0.6,
  },
});
