import { useMemo, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MotiView } from "moti";
import { carregarTrilha, type BancoTrilha } from "@/lib/loadTrilha";
import { carregarCasos } from "@/lib/loadCasos";
import {
  CASOS_POR_RODADA,
  type CasoJogavel,
  acertouCaso,
  calcularPontosConduta,
  montarRodadaConduta,
} from "@/games/conduta";
import type { NivelEvidencia } from "@/data/schema";
import { nivelDoXp } from "@/games/gamificacao";
import { BarraNeon } from "@/components/BarraNeon";
import { PulsoClinico } from "@/components/conduta/PulsoClinico";
import { useProgresso } from "@/store/useProgresso";
import { useFeedback } from "@/lib/useFeedback";
import { Confete } from "@/components/Confete";
import { TextoAdaptativo } from "@/components/TextoAdaptativo";
import { usePaddingRodape } from "@/lib/useRodape";
import { colors } from "@/theme/tokens";

type Fase = "jogando" | "fim";

/** Rótulo + classe de cor por nível de evidência (badge das condutas). */
const NIVEL_META: Record<NivelEvidencia, { label: string; cls: string }> = {
  comprovado: { label: "Comprovado", cls: "text-success" },
  convencional: { label: "Convencional", cls: "text-primary" },
  nao_convencional_aceito: { label: "Aceito", cls: "text-accent" },
  controverso: { label: "Controverso", cls: "text-warning" },
  insuficiente: { label: "Evidência insuficiente", cls: "text-muted" },
};

export default function CondutaScreen() {
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

  const [casos, setCasos] = useState<CasoJogavel[]>(() => {
    try {
      return montarRodadaConduta(carregarCasos(trilhaId), CASOS_POR_RODADA);
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
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [respondido, setRespondido] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [fase, setFase] = useState<Fase>("jogando");
  const [pontos, setPontos] = useState(0);
  const [confeteKey, setConfeteKey] = useState(0);

  const atual = casos[idx];
  const total = casos.length;

  function finalizar(sel: number[]) {
    if (!atual) return;
    setRespondido(true);
    if (acertouCaso(atual, sel)) {
      setAcertos((a) => a + 1);
      setConfeteKey((k) => k + 1);
      feedback.acerto();
    } else {
      feedback.erro();
    }
  }

  function tocarOpcao(i: number) {
    if (respondido || !atual) return;
    if (atual.modo === "single") {
      // conduta única: seleciona e responde imediatamente
      setSelecionadas([i]);
      finalizar([i]);
    } else {
      // multi-conduta: alterna a seleção; confirma depois
      setSelecionadas((cur) =>
        cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]
      );
    }
  }

  function confirmarMulti() {
    if (respondido || !atual || selecionadas.length === 0) return;
    finalizar(selecionadas);
  }

  function avancar() {
    if (idx < total - 1) {
      setIdx((n) => n + 1);
      setSelecionadas([]);
      setRespondido(false);
    } else {
      const acertosFinais = acertos; // já contabilizado no responder
      const ganhos = calcularPontosConduta(acertosFinais);
      setPontos(ganhos);
      if (ganhos > 0) addPontos(trilhaId, ganhos);
      registrarJogo();
      setFase("fim");
    }
  }

  function jogarNovamente() {
    try {
      setCasos(montarRodadaConduta(carregarCasos(trilhaId), CASOS_POR_RODADA));
    } catch {
      setCasos([]);
    }
    setIdx(0);
    setSelecionadas([]);
    setRespondido(false);
    setAcertos(0);
    setPontos(0);
    setFase("jogando");
  }

  // --- sem casos / trilha inexistente ---
  if (!banco || total === 0) {
    return (
      <View className="flex-1 bg-bg px-6 pt-8">
        <Stack.Screen options={{ title: "Qual a conduta?" }} />
        <Text className="text-ink text-lg font-bold">Sem casos disponíveis</Text>
        <Text className="text-muted mt-1">
          A trilha "{trilhaId}" ainda não tem mini-casos clínicos.
        </Text>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          className="mt-6 rounded-2xl py-4 items-center active:opacity-60"
        >
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
          {acertos === total ? "Raciocínio clínico afiado! 🩺✨" : "Rodada concluída! 🎉"}
        </Text>

        <View className="bg-card rounded-3xl p-6 mt-6 items-center">
          <Text className="text-muted">Condutas corretas</Text>
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

  // --- caso em andamento ---
  const progresso = ((idx + (respondido ? 1 : 0)) / total) * 100;
  const acertouAtual = respondido && acertouCaso(atual, selecionadas);

  const corOpcao = (i: number): string => {
    const sel = selecionadas.includes(i);
    if (!respondido) {
      return sel
        ? "bg-primary/15 border border-primary"
        : "bg-card border border-white/5";
    }
    if (atual.opcoes[i].correta) return "bg-success/20 border border-success";
    if (sel) return "bg-error/20 border border-error";
    return "bg-card border border-white/5 opacity-60";
  };

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: `Conduta · ${banco.trilha.nome}` }} />

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

        {/* hero: pulso clínico */}
        <View className="items-center mt-4">
          <PulsoClinico
            acertos={acertos}
            total={total}
            estado={respondido ? (acertouCaso(atual, selecionadas) ? "acerto" : "erro") : "jogando"}
          />
        </View>

        {/* enunciado do caso */}
        <MotiView
          key={atual.id}
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300 }}
        >
          <View className="bg-card rounded-3xl p-5 mt-5">
            <Text className="text-accent text-[10px] uppercase tracking-widest font-bold">
              Caso clínico
            </Text>
            <Text className="text-ink mt-2 text-base leading-6">{atual.caso}</Text>
            {atual.modo === "multi" && (
              <Text className="text-primary text-xs font-semibold mt-3">
                ✓ Marque TODAS as condutas adequadas
              </Text>
            )}
          </View>
        </MotiView>

        {/* opções */}
        <View className="mt-4" style={{ gap: 10 }}>
          {atual.opcoes.map((op, i) => {
            const sel = selecionadas.includes(i);
            const meta = op.nivelEvidencia ? NIVEL_META[op.nivelEvidencia] : null;
            return (
              <Pressable
                key={i}
                onPress={() => tocarOpcao(i)}
                disabled={respondido}
                accessibilityRole="button"
                accessibilityState={{ checked: sel, disabled: respondido }}
                className={`rounded-2xl px-4 py-4 ${corOpcao(i)}`}
              >
                <View className="flex-row items-start">
                  {atual.modo === "multi" && (
                    <View
                      className={`w-5 h-5 rounded-md mr-3 mt-0.5 items-center justify-center border ${
                        sel ? "bg-primary border-primary" : "border-white/25"
                      }`}
                    >
                      {sel && <Text className="text-white text-xs font-bold">✓</Text>}
                    </View>
                  )}
                  <View className="flex-1">
                    <TextoAdaptativo lhPx={20} className="text-ink text-[14px] leading-5">
                      {atual.modo === "single" && (
                        <Text className="text-muted font-bold">
                          {String.fromCharCode(65 + i)}.{" "}
                        </Text>
                      )}
                      {op.texto}
                    </TextoAdaptativo>
                    {respondido && op.correta && meta && (
                      <Text className={`text-[11px] font-semibold mt-1.5 ${meta.cls}`}>
                        ● {meta.label}
                        {op.indicadoQuando ? ` · indicado quando ${op.indicadoQuando}` : ""}
                      </Text>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* confirmar (multi-conduta) */}
        {atual.modo === "multi" && !respondido && (
          <Pressable
            onPress={confirmarMulti}
            disabled={selecionadas.length === 0}
            accessibilityRole="button"
            className={`mt-4 rounded-2xl py-4 items-center ${
              selecionadas.length === 0
                ? "bg-surface opacity-50"
                : "bg-primary active:opacity-80"
            }`}
          >
            <Text className="text-white text-base font-bold">
              Confirmar{selecionadas.length > 0 ? ` (${selecionadas.length})` : ""}
            </Text>
          </Pressable>
        )}

        {/* feedback + fonte */}
        {respondido && (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 280 }}
          >
            <View className="bg-surface rounded-2xl p-4 mt-4">
              <Text
                className={`font-bold ${acertouAtual ? "text-success" : "text-error"}`}
              >
                {acertouAtual
                  ? "Correto!"
                  : atual.modo === "multi"
                    ? "Veja as condutas adequadas em destaque"
                    : "Resposta correta em destaque"}
              </Text>
              <Text className="text-muted text-sm mt-1 leading-5">{atual.explicacao}</Text>
              <Pressable
                onPress={() => Linking.openURL(atual.urlFonte).catch(() => {})}
                className="mt-3 active:opacity-60"
              >
                <Text className="text-primary text-sm font-semibold">Ver fonte ↗</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={avancar}
              className="mt-5 bg-primary rounded-2xl py-4 items-center active:opacity-80"
            >
              <Text className="text-white text-lg font-bold">
                {idx < total - 1 ? "Próximo caso" : "Ver resultado"}
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
});
