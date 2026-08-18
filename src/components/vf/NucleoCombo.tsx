// Hero reativo do V/F: um núcleo de combo que "carrega".
// Um anel de células acende conforme a sequência de acertos cresce (quanto
// mais quente o combo, mais para o roxo/accent), o núcleo pulsa mais forte e
// mais rápido com a carga, dá um "pop" a cada acerto e um flash vermelho +
// esvazia quando erra. Centro mostra ×N.
import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/theme/tokens";

type Estado = "carregando" | "acerto" | "erro";

type Props = {
  sequencia: number;
  /** combo que enche o anel por completo */
  max?: number;
  estado: Estado;
  tamanho?: number;
};

// cor da célula pela "temperatura" do combo (posição relativa)
function corCelula(t: number): string {
  if (t < 0.34) return colors.warning;
  if (t < 0.67) return colors.accent;
  return colors.primary;
}

export function NucleoCombo({ sequencia, max = 8, estado, tamanho = 132 }: Props) {
  const cx = tamanho / 2;
  const cy = tamanho / 2;
  const rAnel = tamanho / 2 - 12;
  const rNucleo = tamanho * 0.26;

  const carga = useSharedValue(0);
  const pulso = useSharedValue(0);
  const pop = useSharedValue(0);
  const flash = useSharedValue(0);

  const cargaFrac = Math.min(sequencia / max, 1);
  const acesas = Math.min(sequencia, max);

  useEffect(() => {
    carga.value = withTiming(cargaFrac, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [cargaFrac, carga]);

  useEffect(() => {
    // pulso mais rápido quanto maior a carga
    const dur = 900 - cargaFrac * 520;
    pulso.value = withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [cargaFrac, pulso]);

  useEffect(() => {
    if (estado === "acerto") {
      pop.value = withSequence(withTiming(1, { duration: 130 }), withTiming(0, { duration: 240 }));
    } else if (estado === "erro") {
      flash.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 320 }));
    }
    // depende de sequencia p/ disparar a cada resposta, mesmo repetindo o estado
  }, [estado, sequencia, pop, flash]);

  const estiloNucleo = useAnimatedStyle(() => {
    const escala = 1 + carga.value * 0.12 + pulso.value * (0.05 + carga.value * 0.08) + pop.value * 0.22;
    const op = 0.5 + carga.value * 0.4 + pulso.value * 0.1;
    return { transform: [{ scale: escala }], opacity: op };
  });

  const estiloFlash = useAnimatedStyle(() => ({ opacity: flash.value * 0.55 }));

  const corNucleo = acesas === 0 ? colors.muted : corCelula(cargaFrac);

  return (
    <View style={{ width: tamanho, height: tamanho, alignItems: "center", justifyContent: "center" }}>
      {/* glow/núcleo pulsante (atrás do svg) */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: rNucleo * 2,
            height: rNucleo * 2,
            borderRadius: rNucleo,
            backgroundColor: corNucleo,
          },
          estiloNucleo,
        ]}
      />
      {/* flash vermelho ao errar */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: tamanho,
            height: tamanho,
            borderRadius: tamanho / 2,
            backgroundColor: colors.error,
          },
          estiloFlash,
        ]}
      />

      <Svg width={tamanho} height={tamanho}>
        {Array.from({ length: max }).map((_, i) => {
          const ang = (-90 + i * (360 / max)) * (Math.PI / 180);
          const x = cx + rAnel * Math.cos(ang);
          const y = cy + rAnel * Math.sin(ang);
          const ligada = i < acesas;
          return (
            <Circle
              key={i}
              cx={x}
              cy={y}
              r={ligada ? 5.5 : 3.5}
              fill={ligada ? corCelula(i / max) : colors.card}
              opacity={ligada ? 1 : 0.7}
            />
          );
        })}
      </Svg>

      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ color: colors.ink, fontSize: 30, fontWeight: "900" }}>×{sequencia}</Text>
        <Text style={{ color: colors.muted, fontSize: 10, letterSpacing: 3, marginTop: -3 }}>COMBO</Text>
      </View>
    </View>
  );
}
