import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { MotiView } from "moti";
import { SvgXml } from "react-native-svg";
import { Confete } from "@/components/Confete";
import { svgDaPeca } from "@/components/pranchas/Pecas";
import type { PecaCorpo, TabuleiroCorpo } from "@/data/schema";
import { nivelDoXp } from "@/games/gamificacao";
import {
  type NivelDica,
  type PecaResolvida,
  calcularPontosMontar,
  destinoMaisProximo,
  encaixou,
  montarBandeja,
  pontosDaPeca,
} from "@/games/montar";
import { carregarTabuleiro, listarTabuleiros } from "@/lib/loadMontar";
import { useFeedback } from "@/lib/useFeedback";
import { usePaddingRodape } from "@/lib/useRodape";
import { useProgresso } from "@/store/useProgresso";
import { colors } from "@/theme/tokens";

type Fase = "jogando" | "fim";

/** Lado do quadradinho de cada peça na bandeja. */
const CELULA = 78;

/**
 * Encaixa o tabuleiro na caixa disponível preservando a proporção.
 *
 * Aqui o limite quase sempre vem da ALTURA: uma perna inteira tem aspecto ~0.28
 * (1:3,6), então o tabuleiro fica alto e estreito, e a sobra horizontal é o que
 * dá lugar para a bandeja de peças ao lado.
 */
function encaixar(caixaW: number, caixaH: number, aspecto: number) {
  const altura = Math.min(caixaH, caixaW / aspecto);
  return { largura: altura * aspecto, altura };
}

export default function MontarScreen() {
  const router = useRouter();
  const paddingRodape = usePaddingRodape();
  const { trilha, regiao } = useLocalSearchParams<{ trilha?: string; regiao?: string }>();
  const trilhaId = trilha ?? "anatomia";
  const feedback = useFeedback();

  const regioes = useMemo<TabuleiroCorpo[]>(() => {
    try {
      return listarTabuleiros(trilhaId);
    } catch {
      return [];
    }
  }, [trilhaId]);

  const [indice, setIndice] = useState(() => {
    if (!regiao) return 0;
    const i = regioes.findIndex((t) => t.id === regiao);
    return i >= 0 ? i : 0;
  });

  const tabuleiro = useMemo<TabuleiroCorpo | null>(() => {
    if (regioes.length === 0) return null;
    const alvo = regioes[Math.min(indice, regioes.length - 1)];
    try {
      return carregarTabuleiro(alvo.id);
    } catch {
      return null;
    }
  }, [regioes, indice]);

  const addPontos = useProgresso((s) => s.addPontos);
  const registrarJogo = useProgresso((s) => s.registrarJogo);
  const pontosTrilha = useProgresso((s) => s.pontosPorTrilha[trilhaId] ?? 0);
  const xp = useProgresso((s) => s.xp);
  const streak = useProgresso((s) => s.streakDias);

  const [bandeja, setBandeja] = useState<{ id: string; nome: string }[]>([]);
  const [resolvidas, setResolvidas] = useState<PecaResolvida[]>([]);
  const [erros, setErros] = useState(0);
  const [fase, setFase] = useState<Fase>("jogando");
  const [pontos, setPontos] = useState(0);
  const [confeteKey, setConfeteKey] = useState(0);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [dicas, setDicas] = useState<Record<string, NivelDica>>({});
  /** slot que "acenderia" agora, para o jogador ver onde vai cair antes de soltar */
  const [alvoAtivo, setAlvoAtivo] = useState<string | null>(null);

  const boardRef = useRef<View>(null);
  const resolvidasRef = useRef<PecaResolvida[]>([]);
  resolvidasRef.current = resolvidas;
  const errosRef = useRef(0);
  errosRef.current = erros;
  const dicasRef = useRef<Record<string, NivelDica>>({});
  dicasRef.current = dicas;

  useEffect(() => {
    if (tabuleiro) setBandeja(montarBandeja(tabuleiro));
    setResolvidas([]);
    setErros(0);
    setPontos(0);
    setDicas({});
    setSelecionada(null);
    setAlvoAtivo(null);
    setFase("jogando");
  }, [tabuleiro]);

  const [caixa, setCaixa] = useState({ w: 0, h: 0 });
  const { largura: boardW, altura: boardH } = tabuleiro
    ? encaixar(caixa.w, caixa.h, tabuleiro.aspecto)
    : { largura: 0, altura: 0 };

  const total = tabuleiro ? tabuleiro.pecas.length : 0;
  const idsResolvidas = new Set(resolvidas.map((r) => r.id));

  function finalizar(finais: PecaResolvida[], errosFinais: number) {
    const ganhos = calcularPontosMontar(finais, total, errosFinais);
    setPontos(ganhos);
    if (ganhos > 0) addPontos(trilhaId, ganhos);
    registrarJogo();
    setFase("fim");
  }

  function registrarAcerto(pecaId: string) {
    const dica = dicasRef.current[pecaId] ?? 0;
    const novas = [...resolvidasRef.current, { id: pecaId, dica }];
    setResolvidas(novas);
    setSelecionada(null);
    setAlvoAtivo(null);
    setConfeteKey((k) => k + 1);
    feedback.acerto();
    if (novas.length === total) finalizar(novas, errosRef.current);
  }

  /** Converte um ponto da janela em coordenadas normalizadas do tabuleiro. */
  function comPontoNoTabuleiro(
    centroX: number,
    centroY: number,
    fn: (x: number, y: number, dentro: boolean) => void
  ) {
    const node = boardRef.current;
    if (!node) return;
    node.measureInWindow((bx, by, bw, bh) => {
      if (bw <= 0 || bh <= 0) return;
      const x = (centroX - bx) / bw;
      const y = (centroY - by) / bh;
      // uma folga fora da borda ainda conta: o dedo raramente para dentro
      const dentro = x >= -0.25 && x <= 1.25 && y >= -0.15 && y <= 1.15;
      fn(x, y, dentro);
    });
  }

  function aoArrastar(centroX: number, centroY: number) {
    if (!tabuleiro) return;
    comPontoNoTabuleiro(centroX, centroY, (x, y, dentro) => {
      setAlvoAtivo(dentro ? destinoMaisProximo(tabuleiro, x, y) : null);
    });
  }

  function aoSoltar(pecaId: string, centroX: number, centroY: number) {
    if (!tabuleiro) return;
    comPontoNoTabuleiro(centroX, centroY, (x, y, dentro) => {
      setAlvoAtivo(null);
      if (dentro && encaixou(tabuleiro, pecaId, x, y)) {
        registrarAcerto(pecaId);
      } else {
        setErros((e) => e + 1);
        feedback.erro();
      }
    });
  }

  function usarDica(nivel: NivelDica) {
    if (!tabuleiro || selecionada === null) return;
    const atual = dicas[selecionada] ?? 0;
    if (nivel <= atual) return; // nunca "desce" de dica
    setDicas((d) => ({ ...d, [selecionada]: nivel }));
    if (nivel === 3) {
      // encaixa sozinha: precisa gravar a dica antes de contar o acerto
      dicasRef.current = { ...dicasRef.current, [selecionada]: 3 };
      registrarAcerto(selecionada);
    }
  }

  function proxima() {
    setConfeteKey(0);
    if (indice + 1 < regioes.length) setIndice((i) => i + 1);
    else setIndice(0);
  }

  // --- sem tabuleiro ---
  if (!tabuleiro) {
    return (
      <View className="flex-1 bg-bg px-6 pt-8">
        <Stack.Screen options={{ title: "Montar o corpo" }} />
        <Text className="text-ink text-lg font-bold">Sem região disponível</Text>
        <Text className="text-muted mt-1">
          A trilha "{trilhaId}" ainda não tem regiões para montar.
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
    const semDica = resolvidas.every((r) => r.dica === 0);
    const temProxima = indice + 1 < regioes.length;
    return (
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: paddingRodape }}
      >
        <Stack.Screen options={{ title: "Resultado" }} />
        <Text className="text-3xl font-extrabold text-ink text-center">
          {erros === 0 && semDica ? "Montou de cabeça! 🦴✨" : `${tabuleiro.titulo} montada! 🎉`}
        </Text>

        <View className="bg-card rounded-3xl p-6 mt-6 items-center">
          <Text className="text-muted">Peças no lugar</Text>
          <Text className="text-4xl font-extrabold text-accent mt-1">
            {resolvidas.length}/{total}
          </Text>
          <Text className="text-muted mt-4">Pontos ganhos</Text>
          <Text className="text-3xl font-extrabold text-ink mt-1">+{pontos}</Text>
          {erros === 0 && semDica ? (
            <Text className="text-success text-sm font-bold mt-3">
              Sem erro e sem dica — bônus aplicado! 🎯
            </Text>
          ) : (
            <Text className="text-muted text-sm mt-3">
              {erros} erro(s){semDica ? "" : " · usou dica"}
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
              <Text className="text-muted text-xs">na anatomia</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={proxima}
          className="mt-8 bg-primary rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-white text-lg font-bold">
            {temProxima ? `Montar ${regioes[indice + 1].titulo.toLowerCase()} →` : "Começar de novo"}
          </Text>
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

  // --- jogando ---
  const pendentes = bandeja.filter((p) => !idsResolvidas.has(p.id));
  const dicaAtual: NivelDica = selecionada ? (dicas[selecionada] ?? 0) : 0;
  const pecaSelecionada = selecionada
    ? tabuleiro.pecas.find((p) => p.id === selecionada)
    : undefined;

  return (
    // Não rola de propósito: o tabuleiro precisa ficar parado para o gesto casar
    // com as coordenadas medidas.
    <View
      className="flex-1 bg-bg px-4"
      style={{ paddingTop: 12, paddingBottom: paddingRodape - 16 }}
    >
      <Stack.Screen options={{ title: `Montar · ${tabuleiro.titulo}` }} />

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
          {resolvidas.length}
          <Text className="text-muted text-base font-bold">/{total}</Text>
          <Text className="text-muted text-xs font-semibold"> peças</Text>
        </Text>
        <Text className="text-muted text-[11px] font-semibold">
          região {indice + 1} de {regioes.length}
        </Text>
        <Text className={`text-xs font-semibold ${erros > 0 ? "text-error" : "text-muted"}`}>
          {erros} erro{erros === 1 ? "" : "s"}
        </Text>
      </View>

      <Text className="text-ink text-base font-bold mt-2">{tabuleiro.titulo}</Text>
      <Text className="text-muted text-xs">{tabuleiro.subtitulo}</Text>

      {/* tabuleiro (alto e estreito) + bandeja ao lado */}
      <View
        className="flex-1 flex-row mt-3"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setCaixa((c) => (c.w === width && c.h === height ? c : { w: width, h: height }));
        }}
      >
        {/* o tabuleiro leva a altura toda; a bandeja fica com a sobra horizontal */}
        <View style={{ width: boardW, height: boardH }} className="items-center justify-center">
          <View ref={boardRef} style={[styles.board, { width: boardW, height: boardH }]}>
            {boardW > 0 &&
              tabuleiro.pecas.map((p) => {
                const posta = idsResolvidas.has(p.id);
                const acesa =
                  alvoAtivo === p.id ||
                  (selecionada === p.id && (dicas[p.id] ?? 0) >= 1);
                return (
                  <PecaNoTabuleiro
                    key={p.id}
                    peca={p}
                    modulo={tabuleiro.modulo}
                    boardW={boardW}
                    boardH={boardH}
                    posta={posta}
                    acesa={acesa}
                  />
                );
              })}
          </View>
        </View>

        {/* bandeja */}
        <View className="flex-1 pl-3">
          <Text className="text-muted text-[10px] font-bold tracking-wider uppercase mb-1">
            Peças
          </Text>
          {pendentes.length === 0 ? (
            <Text className="text-success text-xs font-bold">Tudo no lugar! 🎉</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {pendentes.map((p) => {
                  const peca = tabuleiro.pecas.find((x) => x.id === p.id);
                  if (!peca) return null;
                  return (
                    <PecaArrastavel
                      key={p.id}
                      peca={peca}
                      modulo={tabuleiro.modulo}
                      nomeVisivel={(dicas[p.id] ?? 0) >= 2}
                      selecionada={selecionada === p.id}
                      onSelecionar={() => setSelecionada(p.id)}
                      onArrastar={aoArrastar}
                      onSoltar={aoSoltar}
                    />
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* dicas — agem sobre a peça selecionada */}
          <View className="mt-2">
            {pecaSelecionada ? (
              <>
                <Text className="text-muted text-[10px] mb-1" numberOfLines={1}>
                  {dicaAtual >= 2 ? pecaSelecionada.nome : "peça selecionada"} · vale{" "}
                  {pontosDaPeca(dicaAtual)} pt
                </Text>
                <View className="flex-row" style={{ gap: 6 }}>
                  <BotaoDica rotulo="Onde?" ativo={dicaAtual >= 1} onPress={() => usarDica(1)} />
                  <BotaoDica rotulo="Nome" ativo={dicaAtual >= 2} onPress={() => usarDica(2)} />
                  <BotaoDica rotulo="Encaixar" ativo={dicaAtual >= 3} onPress={() => usarDica(3)} />
                </View>
              </>
            ) : (
              <Text className="text-muted text-[10px]">
                Toque numa peça para pedir dica, ou arraste até o lugar dela.
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* crédito da ilustração */}
      <Pressable
        onPress={() => {
          if (tabuleiro.urlFonte) Linking.openURL(tabuleiro.urlFonte).catch(() => {});
        }}
        className="mt-1 self-center active:opacity-60"
      >
        <Text className="text-muted text-[10px]">
          Imagem: {tabuleiro.imagemCredito ?? tabuleiro.fonte} ↗
        </Text>
      </Pressable>

      {confeteKey > 0 && <Confete key={confeteKey} />}
    </View>
  );
}

/** Peça desenhada no tabuleiro: fantasma, slot aceso ou peça já encaixada. */
function PecaNoTabuleiro({
  peca,
  modulo,
  boardW,
  boardH,
  posta,
  acesa,
}: {
  peca: PecaCorpo;
  modulo: string;
  boardW: number;
  boardH: number;
  posta: boolean;
  acesa: boolean;
}) {
  const svg = svgDaPeca(modulo, peca.id);
  if (!svg) return null;

  const w = peca.tamanho.w * boardW;
  const h = peca.tamanho.h * boardH;
  const left = peca.destino.x * boardW - w / 2;
  const top = peca.destino.y * boardH - h / 2;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        // O fantasma mostra a SILHUETA da região inteira: ajuda a se orientar sem
        // entregar qual osso é qual, porque todos aparecem igual.
        opacity: posta ? 1 : acesa ? 0.45 : 0.1,
      }}
    >
      <SvgXml xml={svg} width={w} height={h} />
    </View>
  );
}

/** Peça na bandeja: arrastável, mostrada só pela forma (o nome é dica paga). */
function PecaArrastavel({
  peca,
  modulo,
  nomeVisivel,
  selecionada,
  onSelecionar,
  onArrastar,
  onSoltar,
}: {
  peca: PecaCorpo;
  modulo: string;
  nomeVisivel: boolean;
  selecionada: boolean;
  onSelecionar: () => void;
  onArrastar: (cx: number, cy: number) => void;
  onSoltar: (pecaId: string, cx: number, cy: number) => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const arrastando = useSharedValue(0);
  const scx = useSharedValue(0);
  const scy = useSharedValue(0);
  const ref = useRef<any>(null);

  const svg = svgDaPeca(modulo, peca.id);

  // a miniatura preserva a proporção da peça dentro da célula
  const razao = peca.tamanho.w / peca.tamanho.h;
  const alvo = CELULA - 16;
  const miniW = razao >= 1 ? alvo : alvo * razao;
  const miniH = razao >= 1 ? alvo / razao : alvo;

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
      runOnJS(onSelecionar)();
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
      runOnJS(onArrastar)(scx.value + e.translationX, scy.value + e.translationY);
    })
    .onEnd((e) => {
      runOnJS(onSoltar)(peca.id, scx.value + e.translationX, scy.value + e.translationY);
      tx.value = withSpring(0);
      ty.value = withSpring(0);
      arrastando.value = 0;
    });

  const toque = Gesture.Tap().onEnd(() => {
    runOnJS(onSelecionar)();
  });

  const estilo = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: arrastando.value ? 1.12 : 1 },
    ],
    zIndex: arrastando.value ? 50 : 1,
    elevation: arrastando.value ? 50 : 1,
  }));

  return (
    <GestureDetector gesture={Gesture.Race(pan, toque)}>
      <Animated.View
        ref={ref}
        style={[
          styles.celula,
          { width: CELULA, height: CELULA },
          selecionada && styles.celulaAtiva,
          estilo,
        ]}
      >
        {svg && <SvgXml xml={svg} width={miniW} height={miniH} />}
        {nomeVisivel && (
          <Text className="text-ink text-[9px] font-bold absolute bottom-0.5" numberOfLines={1}>
            {peca.nome}
          </Text>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

function BotaoDica({
  rotulo,
  ativo,
  onPress,
}: {
  rotulo: string;
  ativo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={ativo}
      accessibilityRole="button"
      style={[styles.botaoDica, ativo && styles.botaoDicaUsado]}
      className="active:opacity-70"
    >
      <Text
        className={`text-[10px] font-bold ${ativo ? "text-muted" : "text-ink"}`}
        numberOfLines={1}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  halo: { position: "absolute", width: 340, height: 340, borderRadius: 170 },
  haloPrimary: { top: -90, left: -80, backgroundColor: colors.primary, opacity: 0.3 },
  board: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(108,92,231,0.35)",
    overflow: "hidden",
  },
  celula: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: "rgba(108,92,231,0.6)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  celulaAtiva: { borderColor: colors.accent, borderWidth: 2 },
  botaoDica: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(108,92,231,0.5)",
  },
  botaoDicaUsado: { opacity: 0.45, borderColor: "rgba(255,255,255,0.15)" },
});
