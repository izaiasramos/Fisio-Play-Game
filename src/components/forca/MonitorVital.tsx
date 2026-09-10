// Monitor de sinais vitais para a Forca.
// Uma onda de ECG neon sobre uma grade de osciloscópio: a cada erro os picos
// enfraquecem e o "bpm" cai; na derrota vira FLATLINE vermelho com bip contínuo.
// O traçado tem glow (traço largo translúcido por baixo + traço fino aceso por
// cima), o painel pulsa no ritmo do batimento e uma linha de varredura corre
// sem parar. Não-violento, e com a cara de Cardio/Saúde.
import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useAudioPlayer } from "expo-audio";
import { colors } from "@/theme/tokens";
import somFlatline from "../../../assets/sounds/flatline.wav";

const APath = Animated.createAnimatedComponent(Path);
const ALine = Animated.createAnimatedComponent(Line);

const W = 240;
const H = 96;
const MID = H / 2;

// grade de osciloscópio (pré-computada)
const PASSO_V = 20;
const PASSO_H = 16;
const VLINES: number[] = [];
for (let x = PASSO_V; x < W; x += PASSO_V) VLINES.push(x);
const HLINES: number[] = [];
for (let y = PASSO_H; y < H; y += PASSO_H) HLINES.push(y);

// Um batimento PQRST normalizado (fatores de -1..1) repetido ao longo da tela.
const BATIDA = [0, 0, 0.08, -0.12, 0, 1, -0.4, 0, 0.22, 0.08, 0, 0];
const FATORES = [...BATIDA, ...BATIDA, ...BATIDA];
const DX = W / (FATORES.length - 1);

// Cor do traçado conforme a saúde (1 = saudável, 0 = flatline).
// PRECISA do diretivo "worklet": é chamada de dentro de useAnimatedProps/
// useAnimatedStyle, que rodam na UI runtime. Sem ele, o Reanimated 4 a captura
// como Remote Function e a chamada síncrona derruba o app
// ("Tried to synchronously call a Remote Function"). No React Native Web o bug
// é invisível, porque lá não existe UI runtime separada.
function corSaude(v: number) {
  "worklet";
  return interpolateColor(v, [0, 0.5, 1], [colors.error, colors.warning, colors.accent]);
}

type Estado = "jogando" | "ganhou" | "perdeu";

type Props = {
  erros: number;
  maxErros: number;
  estado: Estado;
};

export function MonitorVital({ erros, maxErros, estado }: Props) {
  // 1 = saudável · 0 = flatline
  const saude = useSharedValue(1);
  const varredura = useSharedValue(0);
  const pulso = useSharedValue(0);

  const beep = useAudioPlayer(somFlatline);

  useEffect(() => {
    const alvo =
      estado === "perdeu" ? 0 : estado === "ganhou" ? 1 : 1 - Math.min(erros / maxErros, 1);
    saude.value = withTiming(alvo, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [erros, maxErros, estado, saude]);

  useEffect(() => {
    varredura.value = withRepeat(
      withTiming(W, { duration: 2200, easing: Easing.linear }),
      -1,
      false
    );
    pulso.value = withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [varredura, pulso]);

  // bip contínuo de flatline ao perder
  useEffect(() => {
    if (estado !== "perdeu") return;
    try {
      beep.seekTo(0);
      beep.play();
    } catch {
      // som é reforço, nunca deve quebrar o jogo
    }
  }, [estado, beep]);

  const ondaProps = useAnimatedProps(() => {
    const amp = interpolate(saude.value, [0, 1], [1.5, 34]);
    let d = `M0 ${MID}`;
    for (let i = 1; i < FATORES.length; i++) {
      const x = i * DX;
      const y = MID - FATORES[i] * amp;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return { d, stroke: corSaude(saude.value) };
  });

  const scanProps = useAnimatedProps(() => ({
    x1: varredura.value,
    x2: varredura.value,
    stroke: corSaude(saude.value),
  }));

  // halo do painel: pulsa no ritmo do batimento enquanto há vida; some ao flatline
  const estiloGlow = useAnimatedStyle(() => {
    const base = interpolate(saude.value, [0, 1], [0.06, 0.12]);
    const puls = interpolate(pulso.value, [0, 1], [0, 0.1]) * saude.value;
    return { backgroundColor: corSaude(saude.value), opacity: base + puls };
  });

  // bpm derivado (JS: erros já força re-render do componente)
  const frac = estado === "perdeu" ? 0 : estado === "ganhou" ? 1 : 1 - Math.min(erros / maxErros, 1);
  const bpm = Math.round(interpolate(frac, [0, 1], [0, 78]));
  const flat = estado === "perdeu" || bpm <= 0;
  const corTxt = flat ? colors.error : bpm < 45 ? colors.warning : colors.accent;

  return (
    <View style={{ width: W, alignItems: "center" }}>
      <View
        style={{
          width: "100%",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 12,
          paddingHorizontal: 4,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1 }}>SINAIS VITAIS</Text>
        <Text style={{ color: corTxt, fontSize: 15, fontWeight: "800" }}>
          {flat ? "— — —" : `♥ ${bpm} bpm`}
        </Text>
      </View>

      <View style={{ width: W, height: H }}>
        {/* halo pulsante atrás do painel */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: -4,
              left: -5,
              right: -5,
              bottom: -5,
              borderRadius: 20,
            },
            estiloGlow,
          ]}
        />
        <View
          style={{
            width: W,
            height: H,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.card,
            overflow: "hidden",
          }}
        >
          <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            {/* grade de osciloscópio */}
            {VLINES.map((x) => (
              <Line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} stroke={colors.accent} strokeWidth={1} opacity={0.07} />
            ))}
            {HLINES.map((y) => (
              <Line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke={colors.accent} strokeWidth={1} opacity={0.07} />
            ))}
            {/* linha de base */}
            <Line x1={0} y1={MID} x2={W} y2={MID} stroke={colors.accent} strokeWidth={1} opacity={0.18} />
            {/* varredura (glow + linha) */}
            <ALine y1={0} y2={H} strokeWidth={6} opacity={0.12} animatedProps={scanProps} />
            <ALine y1={0} y2={H} strokeWidth={2} opacity={0.4} animatedProps={scanProps} />
            {/* onda de ECG: glow largo por baixo + traço fino aceso por cima */}
            <APath
              fill="none"
              strokeWidth={9}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.28}
              animatedProps={ondaProps}
            />
            <APath
              fill="none"
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
              animatedProps={ondaProps}
            />
          </Svg>
        </View>
      </View>
    </View>
  );
}
