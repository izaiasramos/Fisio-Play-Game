import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { MotiView } from "moti";
import { SvgXml } from "react-native-svg";
import { BarraNeon } from "@/components/BarraNeon";
import { Confete } from "@/components/Confete";
import { svgDaPeca } from "@/components/pranchas/Pecas";
import type { PecaCorpo, TabuleiroCorpo } from "@/data/schema";
import { nivelDoXp } from "@/games/gamificacao";
import {
  type Lente,
  type NivelDica,
  type PecaResolvida,
  LENTE_NEUTRA,
  ZOOM_DUPLO_TOQUE,
  ZOOM_MAX,
  ZOOM_MIN,
  NOME_VISTA,
  ZOOM_PASSO,
  avaliarSolta,
  calcularPontosMontar,
  destinoMaisProximo,
  fracaoParaPonto,
  girarVista,
  lenteNoPonto,
  montarBandeja,
  pontoParaFracao,
  pontosDaPeca,
  precisaoMontar,
  proximaRegiao,
  regiaoDe,
  regiaoLiberada,
  regiaoVizinha,
  resumoDaRegiao,
  vistaDo,
  vistasDaRegiao,
} from "@/games/montar";
import { carregarTabuleiro, listarTabuleiros } from "@/lib/loadMontar";
import { useFeedback } from "@/lib/useFeedback";
import { usePaddingRodape } from "@/lib/useRodape";
import { useProgresso } from "@/store/useProgresso";
import { colors } from "@/theme/tokens";

type Fase = "jogando" | "fim";

/** Aviso curto que aparece embaixo do cabeçalho (não empurra o layout). */
type Aviso = { texto: string; tom: "erro" | "neutro"; key: number };

/** Largura da célula de cada peça na bandeja. */
const CELULA = 76;
/** Altura reservada ao nome do osso dentro da célula. */
const FAIXA_NOME = 20;
/** Quanto tempo o nome do osso fica flutuando no tabuleiro após o acerto. */
const MS_ETIQUETA = 1500;
/** Faixa dos controles de zoom, embaixo do tabuleiro. */
const ALTURA_CONTROLES = 34;

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

  const addPontos = useProgresso((s) => s.addPontos);
  const registrarJogo = useProgresso((s) => s.registrarJogo);
  const concluirMontar = useProgresso((s) => s.concluirMontar);
  const pontosTrilha = useProgresso((s) => s.pontosPorTrilha[trilhaId] ?? 0);
  const xp = useProgresso((s) => s.xp);
  const streak = useProgresso((s) => s.streakDias);
  // seleciona o registro inteiro (referência estável); derivar o Set aqui evita
  // devolver um array novo a cada render para o zustand comparar.
  const mapaConcluidas = useProgresso((s) => s.montarConcluidas);
  const concluidas = useMemo(
    () => new Set(mapaConcluidas?.[trilhaId] ?? []),
    [mapaConcluidas, trilhaId]
  );

  /**
   * Abre na região que o jogador deve jogar agora — a primeira pendente — e não
   * sempre na primeira do banco. Um param `regiao` só é respeitado se ela já
   * estiver liberada, senão a progressão sequencial não valeria nada.
   */
  const [indice, setIndice] = useState(() => {
    if (regiao) {
      const i = regioes.findIndex((t) => t.id === regiao);
      if (i >= 0 && regiaoLiberada(regioes, regiao, concluidas)) return i;
    }
    const prox = proximaRegiao(regioes, concluidas);
    if (prox) {
      const i = regioes.findIndex((t) => t.id === prox.id);
      return i >= 0 ? i : 0;
    }
    return 0;
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
  /** peça que errou agora — dispara o tremor na miniatura */
  const [sinalErro, setSinalErro] = useState<{ id: string; key: number } | null>(null);
  /** nome do osso que acabou de entrar, flutuando no lugar dele */
  const [etiqueta, setEtiqueta] = useState<{
    nome: string;
    pontos: number;
    y: number;
    key: number;
  } | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

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
    setSinalErro(null);
    setEtiqueta(null);
    setAviso(null);
    setFase("jogando");
    aplicarLente(LENTE_NEUTRA, false); // região nova sempre começa inteira à vista
  }, [tabuleiro]);

  // a etiqueta do nome se apaga sozinha; o aviso também
  useEffect(() => {
    if (!etiqueta) return;
    const t = setTimeout(() => setEtiqueta(null), MS_ETIQUETA);
    return () => clearTimeout(t);
  }, [etiqueta]);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2200);
    return () => clearTimeout(t);
  }, [aviso]);

  const [caixa, setCaixa] = useState({ w: 0, h: 0 });
  const { largura: boardW, altura: boardH } = tabuleiro
    ? encaixar(caixa.w, Math.max(0, caixa.h - ALTURA_CONTROLES), tabuleiro.aspecto)
    : { largura: 0, altura: 0 };

  // --- lente (zoom + deslocamento) ---
  // A transformação visual mora em shared values (roda na UI thread, sem jank);
  // o espelho em `lenteRef` é o que a matemática do encaixe consulta, e ele só
  // precisa ser atualizado quando um gesto TERMINA, porque não se solta peça no
  // meio de uma pinça.
  const esc = useSharedValue(1);
  const desX = useSharedValue(0);
  const desY = useSharedValue(0);
  const escInicial = useSharedValue(1);
  const desInicial = useSharedValue({ x: 0, y: 0 });
  /** 1 = o arraste move a lente; 0 = o arraste é candidato a swipe de vista. */
  const modoLente = useSharedValue(0);
  /** 1 = o gesto teve dois dedos em algum momento (então não é swipe). */
  const multiToque = useSharedValue(0);
  const lenteRef = useRef<Lente>(LENTE_NEUTRA);
  const [lenteVisivel, setLenteVisivel] = useState<Lente>(LENTE_NEUTRA);

  function sincronizarLente(escala: number, dx: number, dy: number) {
    const l = { escala, dx, dy };
    lenteRef.current = l;
    setLenteVisivel(l);
  }

  /** Aplica uma lente já validada, animando a transformação. */
  function aplicarLente(l: Lente, animar = true) {
    if (animar) {
      esc.value = withTiming(l.escala, { duration: 180 });
      desX.value = withTiming(l.dx, { duration: 180 });
      desY.value = withTiming(l.dy, { duration: 180 });
    } else {
      esc.value = l.escala;
      desX.value = l.dx;
      desY.value = l.dy;
    }
    sincronizarLente(l.escala, l.dx, l.dy);
  }

  function zoomPorBotao(delta: number) {
    if (boardW <= 0) return;
    const alvo = lenteRef.current.escala + delta;
    aplicarLente(lenteNoPonto(boardW / 2, boardH / 2, boardW, boardH, alvo, lenteRef.current));
  }

  function reporLente() {
    aplicarLente(LENTE_NEUTRA);
  }

  /** Duplo-toque: aproxima no ponto tocado, ou volta ao tabuleiro inteiro. */
  function alternarZoom(vpx: number, vpy: number) {
    if (boardW <= 0) return;
    if (lenteRef.current.escala > ZOOM_MIN + 0.01) {
      aplicarLente(LENTE_NEUTRA);
      return;
    }
    aplicarLente(
      lenteNoPonto(vpx, vpy, boardW, boardH, ZOOM_DUPLO_TOQUE, lenteRef.current)
    );
  }

  const vistasDaAtual = useMemo(
    () => (tabuleiro ? vistasDaRegiao(regioes, regiaoDe(tabuleiro)) : []),
    [regioes, tabuleiro]
  );
  const temMaisDeUmaVista = vistasDaAtual.length > 1;

  const estiloConteudo = useAnimatedStyle(() => ({
    // ordem importa: escala em torno do centro e DEPOIS translação — é a mesma
    // convenção que `pontoParaFracao` desfaz.
    transform: [{ translateX: desX.value }, { translateY: desY.value }, { scale: esc.value }],
  }));

  /**
   * Ponte estável para os gestos da moldura.
   *
   * Esta tela re-renderiza a cada frame enquanto uma peça é arrastada (o alvo
   * aceso muda). Se os gestos fossem recriados junto, o gesture-handler
   * reanexaria handlers 60×/s; e memoizá-los sem esta ponte congelaria a peça
   * selecionada no valor que ela tinha na primeira montagem.
   */
  const acoesRef = useRef({ tocar: aoTocarTabuleiro, zoom: alternarZoom, girar });
  acoesRef.current = { tocar: aoTocarTabuleiro, zoom: alternarZoom, girar };
  const tocarEstavel = useCallback((x: number, y: number) => acoesRef.current.tocar(x, y), []);
  const zoomEstavel = useCallback((x: number, y: number) => acoesRef.current.zoom(x, y), []);
  const girarEstavel = useCallback((passo: number) => acoesRef.current.girar(passo), []);
  const sincronizarEstavel = useCallback(
    (escala: number, dx: number, dy: number) => sincronizarLente(escala, dx, dy),
    []
  );

  // Pinça e arraste de DOIS dedos convivem; um dedo é toque (colocar peça) e
  // dois toques é zoom — assim nenhum gesto rouba o outro.
  const gestosTabuleiro = useMemo(() => {
    const pinca = Gesture.Pinch()
      .onStart(() => {
        escInicial.value = esc.value;
      })
      .onUpdate((e) => {
        const s = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, escInicial.value * e.scale));
        const lx = Math.max(0, (boardW * (s - 1)) / 2);
        const ly = Math.max(0, (boardH * (s - 1)) / 2);
        esc.value = s;
        desX.value = Math.min(lx, Math.max(-lx, desX.value));
        desY.value = Math.min(ly, Math.max(-ly, desY.value));
      })
      .onEnd(() => {
        runOnJS(sincronizarEstavel)(esc.value, desX.value, desY.value);
      });

    // Um único Pan cobre os dois casos, e o critério é o que o dedo pode querer:
    // ampliado (ou com dois dedos) só se passeia pela lente; no tabuleiro
    // inteiro, arrastar de lado gira a vista. Sem essa separação, arrastar no
    // zoom ficaria ambíguo entre "mover" e "girar".
    const arrastarTabuleiro = Gesture.Pan()
      .onStart(() => {
        desInicial.value = { x: desX.value, y: desY.value };
        modoLente.value = esc.value > ZOOM_MIN + 0.01 ? 1 : 0;
        multiToque.value = 0;
      })
      .onUpdate((e) => {
        if (e.numberOfPointers >= 2) multiToque.value = 1;
        if (modoLente.value === 0 && multiToque.value === 0) return; // só mede o swipe
        const lx = Math.max(0, (boardW * (esc.value - 1)) / 2);
        const ly = Math.max(0, (boardH * (esc.value - 1)) / 2);
        desX.value = Math.min(lx, Math.max(-lx, desInicial.value.x + e.translationX));
        desY.value = Math.min(ly, Math.max(-ly, desInicial.value.y + e.translationY));
      })
      .onEnd((e) => {
        if (modoLente.value === 1 || multiToque.value === 1) {
          runOnJS(sincronizarEstavel)(esc.value, desX.value, desY.value);
          return;
        }
        // swipe horizontal decidido: exige intenção lateral clara
        if (Math.abs(e.translationX) > 48 && Math.abs(e.translationY) < 70) {
          runOnJS(girarEstavel)(e.translationX < 0 ? 1 : -1);
        }
      });

    const duploToque = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((e, ok) => {
        if (ok) runOnJS(zoomEstavel)(e.x, e.y);
      });

    const toqueSimples = Gesture.Tap().onEnd((e, ok) => {
      if (ok) runOnJS(tocarEstavel)(e.x, e.y);
    });

    return Gesture.Race(
      Gesture.Simultaneous(pinca, arrastarTabuleiro),
      Gesture.Exclusive(duploToque, toqueSimples)
    );
  }, [
    boardW,
    boardH,
    esc,
    desX,
    desY,
    escInicial,
    desInicial,
    modoLente,
    multiToque,
    tocarEstavel,
    zoomEstavel,
    girarEstavel,
    sincronizarEstavel,
  ]);

  const total = tabuleiro ? tabuleiro.pecas.length : 0;
  const idsResolvidas = new Set(resolvidas.map((r) => r.id));

  function avisar(texto: string, tom: Aviso["tom"] = "neutro") {
    setAviso({ texto, tom, key: Date.now() });
  }

  function finalizar(finais: PecaResolvida[], errosFinais: number) {
    const ganhos = calcularPontosMontar(finais, total, errosFinais);
    setPontos(ganhos);
    if (ganhos > 0) addPontos(trilhaId, ganhos);
    if (tabuleiro) concluirMontar(trilhaId, tabuleiro.id);
    registrarJogo();
    setFase("fim");
  }

  function registrarAcerto(pecaId: string) {
    if (!tabuleiro) return;
    const dica = dicasRef.current[pecaId] ?? 0;
    const novas = [...resolvidasRef.current, { id: pecaId, dica }];
    const peca = tabuleiro.pecas.find((p) => p.id === pecaId);
    setResolvidas(novas);
    setSelecionada(null);
    setAlvoAtivo(null);
    setSinalErro(null);
    setConfeteKey((k) => k + 1);
    // o nome aparece NO LUGAR onde a peça entrou: é esse par (nome, posição)
    // que precisa ficar na memória, não o número de pontos.
    if (peca) {
      setEtiqueta({
        nome: peca.nome,
        pontos: pontosDaPeca(dica),
        y: peca.destino.y,
        key: Date.now(),
      });
    }
    feedback.acerto();
    if (novas.length === total) finalizar(novas, errosRef.current);
  }

  /** Erro: conta, treme a peça e diz o que houve (trocou de lugar × soltou longe). */
  function registrarErro(pecaId: string, motivo: "trocado" | "longe") {
    setErros((e) => e + 1);
    setSinalErro({ id: pecaId, key: Date.now() });
    avisar(
      motivo === "trocado"
        ? "Quase! Esse lugar é de outro osso."
        : "Solte sobre o corpo, mais perto do lugar.",
      "erro"
    );
    feedback.erro();
  }

  /** Ponto de entrada único das tentativas — vale para o arraste e para o toque. */
  function tentarEncaixe(pecaId: string, x: number, y: number) {
    if (!tabuleiro) return;
    const r = avaliarSolta(tabuleiro, pecaId, x, y);
    if (r.tipo === "acerto") registrarAcerto(pecaId);
    else registrarErro(pecaId, r.tipo);
  }

  /**
   * Converte um ponto da janela em coordenadas normalizadas do tabuleiro.
   *
   * Mede a MOLDURA (que nunca é transformada, então `measureInWindow` é
   * confiável) e desfaz a lente por conta própria — medir a través de um
   * `transform` dá resultado diferente em cada plataforma.
   */
  function comPontoNoTabuleiro(
    centroX: number,
    centroY: number,
    fn: (x: number, y: number, dentro: boolean) => void
  ) {
    const node = boardRef.current;
    if (!node) return;
    node.measureInWindow((bx, by, bw, bh) => {
      if (bw <= 0 || bh <= 0) return;
      const { x, y } = pontoParaFracao(centroX - bx, centroY - by, bw, bh, lenteRef.current);
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
      // longe do tabuleiro é desistência, não tentativa: soltar a peça de volta
      // na bandeja não deveria custar um erro no placar.
      if (!dentro) return;
      tentarEncaixe(pecaId, x, y);
    });
  }

  /**
   * Toque no tabuleiro coloca a peça selecionada.
   *
   * Existe porque arrastar 20 cm de tela com o dedo em cima da própria peça é a
   * parte mais difícil do jogo — e ela não tem nada a ver com anatomia. Aqui
   * `locationX/Y` já vem em coordenadas do tabuleiro, sem medir nada.
   */
  /**
   * Toque na moldura coloca a peça selecionada. `vpx/vpy` já vêm em pixels da
   * moldura (o gesture-handler reporta relativo à view do detector, que não é
   * transformada), então basta desfazer a lente.
   */
  function aoTocarTabuleiro(vpx: number, vpy: number) {
    if (!tabuleiro || boardW <= 0) return;
    if (selecionada === null || idsResolvidas.has(selecionada)) {
      avisar("Escolha um osso na bandeja primeiro.");
      return;
    }
    const { x, y } = pontoParaFracao(vpx, vpy, boardW, boardH, lenteRef.current);
    tentarEncaixe(selecionada, x, y);
  }

  function usarDica(nivel: NivelDica) {
    if (!tabuleiro || selecionada === null) return;
    const atual = dicas[selecionada] ?? 0;
    if (nivel <= atual) return; // nunca "desce" de dica
    setDicas((d) => ({ ...d, [selecionada]: nivel }));
    if (nivel === 2) {
      // encaixa sozinha: precisa gravar a dica antes de contar o acerto
      dicasRef.current = { ...dicasRef.current, [selecionada]: 2 };
      registrarAcerto(selecionada);
    } else {
      avisar("O lugar acendeu no tabuleiro.");
    }
  }

  /**
   * Setinhas e swipe giram a MESMA região: anterior → lateral → posterior →
   * medial → anterior. Nada mais.
   *
   * A primeira versão caía para "trocar de região" quando a região tinha uma
   * vista só, e isso foi um erro de projeto: o gesto de girar passou a trocar de
   * perna, que é o oposto do que ele promete. Trocar de região é outra intenção
   * e agora tem controle próprio (`irParaVizinha`). Enquanto não existir a
   * segunda ilustração, girar avisa que a região tem uma vista só — o que é a
   * verdade, e não um pulo para outro lugar.
   */
  function girar(passo: number) {
    if (!tabuleiro) return;
    const destino = girarVista(regioes, tabuleiro.id, passo);
    if (!destino) {
      avisar("Esta região só tem a vista de frente — outros ângulos vêm depois.");
      return;
    }
    const i = regioes.findIndex((t) => t.id === destino.id);
    if (i >= 0) setIndice(i);
  }

  /** Troca de região (intenção diferente de girar), respeitando o desbloqueio. */
  function irParaVizinha(passo: number) {
    if (!tabuleiro) return;
    const destino = regiaoVizinha(regioes, tabuleiro.id, passo, concluidas);
    if (!destino) {
      avisar("Termine esta região para liberar a próxima.");
      return;
    }
    const i = regioes.findIndex((t) => t.id === destino.id);
    if (i >= 0) setIndice(i);
  }

  function proxima() {
    setConfeteKey(0);
    const prox = proximaRegiao(regioes, concluidas);
    if (prox) {
      const i = regioes.findIndex((t) => t.id === prox.id);
      if (i >= 0) {
        setIndice(i);
        return;
      }
    }
    // tudo concluído: vira revisão, seguindo na ordem
    setIndice(indice + 1 < regioes.length ? indice + 1 : 0);
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
    const resumo = resumoDaRegiao(tabuleiro, resolvidas);
    // peça resolvida pela dica "Encaixar" não foi tentativa do jogador: contá-la
    // como acerto inflaria a precisão justamente de quem pediu a resposta.
    const acertos = resolvidas.filter((r) => r.dica < 2).length;
    const pct = precisaoMontar(acertos, erros);
    const pendente = proximaRegiao(regioes, concluidas);
    return (
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: paddingRodape,
        }}
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
              {pct}% de acerto · {erros} erro(s){semDica ? "" : " · usou dica"}
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

        {/* revisão: o nome de cada osso, de cima para baixo — é o resumo de estudo */}
        <Text className="text-muted text-[11px] font-bold tracking-wider uppercase mt-6 mb-2">
          De cima para baixo
        </Text>
        <View className="bg-card rounded-2xl px-4 py-2">
          {resumo.map((l, i) => (
            <View
              key={l.id}
              className="flex-row items-center justify-between py-2"
              style={i > 0 ? styles.linhaResumo : undefined}
            >
              <Text className="text-ink text-sm font-semibold">
                {i + 1}. {l.nome}
              </Text>
              <Text className={`text-xs font-bold ${l.dica === 0 ? "text-success" : "text-muted"}`}>
                {l.dica === 0 ? "de cabeça" : l.dica === 1 ? "com dica" : "encaixada"} · {l.pontos}{" "}
                pt
              </Text>
            </View>
          ))}
        </View>

        {/* mapa das regiões: mostra que a progressão é sequencial e onde ele está */}
        <View className="flex-row flex-wrap mt-4" style={{ gap: 6 }}>
          {regioes.map((r) => {
            const feita = concluidas.has(r.id);
            const trancada = !feita && !regiaoLiberada(regioes, r.id, concluidas);
            return (
              <View
                key={r.id}
                style={[styles.chipRegiao, feita && styles.chipFeita, trancada && styles.chipTrancada]}
              >
                <Text
                  className={`text-[10px] font-bold ${feita ? "text-success" : "text-muted"}`}
                  numberOfLines={1}
                >
                  {feita ? "✓ " : trancada ? "🔒 " : "▶ "}
                  {r.titulo}
                </Text>
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={proxima}
          className="mt-8 bg-primary rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-white text-lg font-bold">
            {pendente
              ? `Montar ${pendente.titulo.toLowerCase()} →`
              : "Tudo montado — revisar de novo"}
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
  const ampliado = lenteVisivel.escala > ZOOM_MIN + 0.01;
  const pendentes = bandeja.filter((p) => !idsResolvidas.has(p.id));
  const dicaAtual: NivelDica = selecionada ? (dicas[selecionada] ?? 0) : 0;
  const pecaSelecionada = selecionada
    ? tabuleiro.pecas.find((p) => p.id === selecionada)
    : undefined;
  const postas = tabuleiro.pecas.filter((p) => idsResolvidas.has(p.id));

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
        {/* trocar de região é intenção separada de girar a vista */}
        <Pressable
          onPress={() => irParaVizinha(1)}
          accessibilityRole="button"
          accessibilityLabel="Ir para a próxima região liberada"
          hitSlop={8}
          className="active:opacity-60"
        >
          <Text className="text-muted text-[11px] font-semibold">
            região {indice + 1} de {regioes.length}
            {regioes.length > 1 ? " ⇄" : ""}
          </Text>
        </Pressable>
        <Text className={`text-xs font-semibold ${erros > 0 ? "text-error" : "text-muted"}`}>
          {erros} erro{erros === 1 ? "" : "s"}
        </Text>
      </View>
      <View className="mt-1.5">
        <BarraNeon pct={total > 0 ? (resolvidas.length / total) * 100 : 0} tom="accent" altura={8} />
      </View>

      {/* girar: vista quando a região tem várias, região quando não tem */}
      <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
        <BotaoGirar
          rotulo="◀"
          rotuloAcessivel="Girar para o ângulo anterior"
          inativo={!temMaisDeUmaVista}
          onPress={() => girar(-1)}
        />
        <View className="flex-1">
          <Text className="text-ink text-base font-bold" numberOfLines={1}>
            {tabuleiro.titulo}
          </Text>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Text className="text-accent text-[10px] font-bold">
              {NOME_VISTA[vistaDo(tabuleiro)]}
            </Text>
            <Text className="text-muted text-[10px]">
              {temMaisDeUmaVista
                ? `· ângulo ${vistasDaAtual.findIndex((t) => t.id === tabuleiro.id) + 1} de ${vistasDaAtual.length}`
                : "· único ângulo desta região"}
            </Text>
          </View>
        </View>
        <BotaoGirar
          rotulo="▶"
          rotuloAcessivel="Girar para o próximo ângulo"
          inativo={!temMaisDeUmaVista}
          onPress={() => girar(1)}
        />
      </View>
      {/* linha de altura fixa: o aviso não pode empurrar o tabuleiro, senão as
          coordenadas medidas do gesto saem do lugar no meio da jogada */}
      <View style={styles.linhaAviso}>
        {aviso ? (
          <MotiView
            key={aviso.key}
            from={{ opacity: 0, translateY: -4 }}
            animate={{ opacity: 1, translateY: 0 }}
          >
            <Text
              className={`text-xs font-semibold ${aviso.tom === "erro" ? "text-error" : "text-muted"}`}
              numberOfLines={1}
            >
              {aviso.texto}
            </Text>
          </MotiView>
        ) : (
          <Text className="text-muted text-xs" numberOfLines={1}>
            {tabuleiro.subtitulo}
          </Text>
        )}
      </View>

      {/* tabuleiro (alto e estreito) + bandeja ao lado */}
      <View
        className="flex-1 flex-row mt-2"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setCaixa((c) => (c.w === width && c.h === height ? c : { w: width, h: height }));
        }}
      >
        {/* o tabuleiro leva a altura toda; a bandeja fica com a sobra horizontal */}
        <View style={{ width: boardW }} className="items-center">
          {/* moldura: recorta o conteúdo ampliado e serve de régua para os gestos */}
          <View ref={boardRef} style={[styles.board, { width: boardW, height: boardH }]}>
            <Animated.View
              pointerEvents="none"
              style={[{ width: boardW, height: boardH }, estiloConteudo]}
            >
              {boardW > 0 &&
                tabuleiro.pecas.map((p) => {
                  const posta = idsResolvidas.has(p.id);
                  const acesa =
                    alvoAtivo === p.id || (selecionada === p.id && (dicas[p.id] ?? 0) >= 1);
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
            </Animated.View>

            {/* A etiqueta fica FORA da transformação: dentro dela o texto seria
                ampliado junto e viraria um letreiro. A posição vem da fração do
                osso passada pela lente. */}
            {etiqueta && boardW > 0 && (
              <MotiView
                key={etiqueta.key}
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: -6 }}
                transition={{ type: "timing", duration: 420 }}
                pointerEvents="none"
                style={[
                  styles.etiqueta,
                  {
                    top: Math.max(
                      2,
                      Math.min(
                        boardH - 22,
                        fracaoParaPonto(0.5, etiqueta.y, boardW, boardH, lenteVisivel).y - 11
                      )
                    ),
                  },
                ]}
              >
                <Text className="text-ink text-[11px] font-bold" numberOfLines={1}>
                  {etiqueta.nome} +{etiqueta.pontos}
                </Text>
              </MotiView>
            )}

            {/* camada de gestos: toque coloca a peça, 2 toques dão zoom,
                pinça/2 dedos navegam. Fica por cima porque as peças são
                `pointerEvents: none`. */}
            {boardW > 0 && (
              <GestureDetector gesture={gestosTabuleiro}>
                <View
                  style={StyleSheet.absoluteFill}
                  accessibilityRole="button"
                  accessibilityLabel={
                    pecaSelecionada
                      ? `Tocar no lugar de ${pecaSelecionada.nome}`
                      : "Tabuleiro do corpo — toque duplo aproxima"
                  }
                />
              </GestureDetector>
            )}
          </View>

          {/* controles de zoom: pinça é ótima, mas não pode ser o único caminho */}
          {boardW > 0 && (
            <View style={[styles.controles, { width: boardW }]}>
              <BotaoZoom
                rotulo="−"
                rotuloAcessivel="Afastar"
                desabilitado={lenteVisivel.escala <= ZOOM_MIN + 0.01}
                onPress={() => zoomPorBotao(-ZOOM_PASSO)}
              />
              <Text
                className={`text-[10px] font-bold ${ampliado ? "text-accent" : "text-muted"}`}
                style={{ minWidth: 34, textAlign: "center" }}
              >
                {lenteVisivel.escala.toFixed(1)}×
              </Text>
              <BotaoZoom
                rotulo="+"
                rotuloAcessivel="Aproximar"
                desabilitado={lenteVisivel.escala >= ZOOM_MAX - 0.01}
                onPress={() => zoomPorBotao(ZOOM_PASSO)}
              />
              <BotaoZoom
                rotulo="⟲"
                rotuloAcessivel="Ver o tabuleiro inteiro"
                desabilitado={!ampliado}
                onPress={reporLente}
              />
            </View>
          )}
        </View>

        {/* bandeja */}
        <View className="flex-1 pl-3">
          <Text className="text-muted text-[10px] font-bold tracking-wider uppercase mb-1">
            Ossos
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
                      selecionada={selecionada === p.id}
                      erroKey={sinalErro?.id === p.id ? sinalErro.key : 0}
                      onSelecionar={() => setSelecionada(p.id)}
                      onArrastar={aoArrastar}
                      onSoltar={aoSoltar}
                    />
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* já montados: mantém o par nome↔lugar à vista durante a rodada */}
          {postas.length > 0 && (
            <View className="mt-2">
              <Text className="text-muted text-[10px] font-bold tracking-wider uppercase mb-0.5">
                No lugar
              </Text>
              {postas.map((p) => (
                <Text key={p.id} className="text-success text-[11px] font-semibold" numberOfLines={1}>
                  ✓ {p.nome}
                </Text>
              ))}
            </View>
          )}

          {/* dicas — agem sobre a peça selecionada */}
          <View className="mt-2">
            {pecaSelecionada ? (
              <>
                <Text className="text-accent text-[11px] font-bold mb-1" numberOfLines={1}>
                  {pecaSelecionada.nome}
                  <Text className="text-muted text-[10px] font-semibold">
                    {" "}
                    · vale {pontosDaPeca(dicaAtual)} pt
                  </Text>
                </Text>
                <View className="flex-row" style={{ gap: 6 }}>
                  <BotaoDica rotulo="Onde?" ativo={dicaAtual >= 1} onPress={() => usarDica(1)} />
                  <BotaoDica rotulo="Encaixar" ativo={dicaAtual >= 2} onPress={() => usarDica(2)} />
                </View>
              </>
            ) : (
              <Text className="text-muted text-[10px]">
                Toque no osso e depois no lugar dele — ou arraste até lá. Dois toques
                aproximam, dois dedos passeiam
                {temMaisDeUmaVista ? ", e arrastar de lado gira o ângulo (◀ ▶)" : ""}.
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
    <MotiView
      pointerEvents="none"
      animate={{ opacity: posta ? 1 : acesa ? 0.45 : 0.1 }}
      transition={{ type: "timing", duration: 200 }}
      style={{ position: "absolute", left, top, width: w, height: h }}
    >
      {/* O fantasma mostra a SILHUETA da região inteira: ajuda a se orientar sem
          entregar qual osso é qual, porque todos aparecem igual. */}
      {posta ? (
        // remonta ao encaixar, então nasce grande e assenta: sem esse "pop" a
        // peça só desaparece da bandeja e o olho não registra o que aconteceu.
        <MotiView
          from={{ scale: 1.35, opacity: 0.3 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 13, stiffness: 190 }}
          style={{ width: w, height: h }}
        >
          <SvgXml xml={svg} width={w} height={h} />
        </MotiView>
      ) : (
        <SvgXml xml={svg} width={w} height={h} />
      )}
    </MotiView>
  );
}

/**
 * Peça na bandeja: nome à vista + forma, arrastável ou selecionável por toque.
 */
function PecaArrastavel({
  peca,
  modulo,
  selecionada,
  erroKey,
  onSelecionar,
  onArrastar,
  onSoltar,
}: {
  peca: PecaCorpo;
  modulo: string;
  selecionada: boolean;
  /** muda de valor a cada erro desta peça, disparando o tremor */
  erroKey: number;
  onSelecionar: () => void;
  onArrastar: (cx: number, cy: number) => void;
  onSoltar: (pecaId: string, cx: number, cy: number) => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const arrastando = useSharedValue(0);
  const scx = useSharedValue(0);
  const scy = useSharedValue(0);
  const shake = useSharedValue(0);
  const ref = useRef<any>(null);

  const svg = svgDaPeca(modulo, peca.id);

  // a miniatura preserva a proporção da peça dentro da célula
  const razao = peca.tamanho.w / peca.tamanho.h;
  const alvo = CELULA - FAIXA_NOME - 12;
  const miniW = razao >= 1 ? alvo : alvo * razao;
  const miniH = razao >= 1 ? alvo / razao : alvo;

  // tremor curto no erro — o mesmo vocabulário visual do quiz e da forca
  useEffect(() => {
    if (erroKey === 0) return;
    shake.value = withSequence(
      withTiming(-7, { duration: 55 }),
      withTiming(7, { duration: 55 }),
      withTiming(-5, { duration: 45 }),
      withTiming(0, { duration: 45 })
    );
  }, [erroKey, shake]);

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
      { translateX: tx.value + shake.value },
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
        accessibilityRole="button"
        accessibilityLabel={`${peca.nome} — toque para escolher, depois toque no lugar no tabuleiro`}
        style={[
          styles.celula,
          { width: CELULA, height: CELULA },
          selecionada && styles.celulaAtiva,
          estilo,
        ]}
      >
        <View style={styles.miniatura}>
          {svg && <SvgXml xml={svg} width={miniW} height={miniH} />}
        </View>
        {/* nome sempre visível: o desafio é o LUGAR, não decorar a forma */}
        <Text
          className={`text-[10px] font-bold ${selecionada ? "text-accent" : "text-inkSoft"}`}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {peca.nome}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

/** Setinha que gira a vista (ou troca de região, quando a região é de vista única). */
function BotaoGirar({
  rotulo,
  rotuloAcessivel,
  inativo,
  onPress,
}: {
  rotulo: string;
  rotuloAcessivel: string;
  /** sem outro ângulo disponível: fica apagado, mas ainda explica o porquê ao toque */
  inativo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel}
      accessibilityState={{ disabled: inativo }}
      hitSlop={8}
      style={[styles.botaoGirar, inativo && styles.botaoGirarInativo]}
      className="active:opacity-60"
    >
      <Text className={`text-[13px] font-black ${inativo ? "text-muted" : "text-ink"}`}>
        {rotulo}
      </Text>
    </Pressable>
  );
}

/** Botão quadrado dos controles de zoom. */
function BotaoZoom({
  rotulo,
  rotuloAcessivel,
  desabilitado,
  onPress,
}: {
  rotulo: string;
  rotuloAcessivel: string;
  desabilitado: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel}
      style={[styles.botaoZoom, desabilitado && styles.botaoZoomInativo]}
      className="active:opacity-70"
    >
      <Text className={`text-[13px] font-black ${desabilitado ? "text-muted" : "text-ink"}`}>
        {rotulo}
      </Text>
    </Pressable>
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
  linhaAviso: { height: 18, justifyContent: "center" },
  board: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(108,92,231,0.35)",
    overflow: "hidden",
  },
  etiqueta: {
    position: "absolute",
    left: 2,
    right: 2,
    alignItems: "center",
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(11,16,32,0.86)",
    borderWidth: 1,
    borderColor: "rgba(0,210,168,0.5)",
  },
  controles: {
    height: ALTURA_CONTROLES,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  botaoZoom: {
    width: 28,
    height: 24,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(108,92,231,0.5)",
  },
  botaoZoomInativo: { opacity: 0.4, borderColor: "rgba(255,255,255,0.12)" },
  botaoGirar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(108,92,231,0.5)",
  },
  botaoGirarInativo: { opacity: 0.4, borderColor: "rgba(255,255,255,0.12)" },
  celula: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: "rgba(108,92,231,0.6)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  miniatura: {
    height: CELULA - FAIXA_NOME - 8,
    alignItems: "center",
    justifyContent: "center",
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
  linhaResumo: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  chipRegiao: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(108,92,231,0.5)",
  },
  chipFeita: { borderColor: "rgba(34,197,94,0.6)" },
  chipTrancada: { opacity: 0.45, borderColor: "rgba(255,255,255,0.12)" },
});
