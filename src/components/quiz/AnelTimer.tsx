// Hero reativo do Quiz: um anel de energia que drena com o tempo.
// Cor migra accent → âmbar → vermelho conforme esvazia, com glow (arco largo
// translúcido por baixo). ≤5s pulsa. Ao responder, congela e pinta de verde
// (certo) ou vermelho (errado), mostrando ✓/✕ no centro.
import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/theme/tokens";

const ACircle = Animated.createAnimatedComponent(Circle);

type Estado = "correndo" | "certo" | "errado";

type Props = {
  segundos: number;
  total: number;
  estado: Estado;
  tamanho?: number;
};

export function AnelTimer({ segundos, total, estado, tamanho = 128 }: Props) {
  const R = (tamanho - 18) / 2;
  const C = 2 * Math.PI * R;
  const cx = tamanho / 2;
  const cy = tamanho / 2;

  const frac = useSharedValue(1);
  const pulso = useSharedValue(0);
  const critico = estado === "correndo" && segundos <= 5;

  useEffect(() => {
    const alvo = Math.max(0, Math.min(1, total > 0 ? segundos / total : 0));
    frac.value = withTiming(alvo, { duration: 950, easing: Easing.linear });
  }, [segundos, total, frac]);

  useEffect(() => {
    pulso.value = withRepeat(
      withTiming(1, { duration: 480, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulso]);

  const arcoProps = useAnimatedProps(() => {
    const stroke =
      estado === "certo"
        ? colors.success
        : estado === "errado"
          ? colors.error
          : interpolateColor(
              frac.value,
              [0, 0.25, 0.6, 1],
              [colors.error, colors.warning, colors.accent, colors.accent]
            );
    return { strokeDashoffset: C * (1 - frac.value), stroke };
  });

  const estiloPulso = useAnimatedStyle(() => ({
    transform: [{ scale: critico ? 1 + pulso.value * 0.06 : 1 }],
  }));

  const centro = estado === "certo" ? "✓" : estado === "errado" ? "✕" : `${segundos}`;
  const corCentro =
    estado === "certo"
      ? colors.success
      : estado === "errado"
        ? colors.error
        : critico
          ? colors.error
          : colors.ink;

  return (
    <Animated.View
      style={[
        { width: tamanho, height: tamanho, alignItems: "center", justifyContent: "center" },
        estiloPulso,
      ]}
    >
      <Svg width={tamanho} height={tamanho}>
        {/* trilho */}
        <Circle cx={cx} cy={cy} r={R} stroke={colors.surface} strokeWidth={9} fill="none" />
        {/* glow do arco */}
        <ACircle
          cx={cx}
          cy={cy}
          r={R}
          strokeWidth={14}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          opacity={0.28}
          transform={`rotate(-90 ${cx} ${cy})`}
          animatedProps={arcoProps}
        />
        {/* arco */}
        <ACircle
          cx={cx}
          cy={cy}
          r={R}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          transform={`rotate(-90 ${cx} ${cy})`}
          animatedProps={arcoProps}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ color: corCentro, fontSize: estado === "correndo" ? 36 : 44, fontWeight: "900" }}>
          {centro}
        </Text>
        {estado === "correndo" && (
          <Text style={{ color: colors.muted, fontSize: 10, letterSpacing: 3, marginTop: -4 }}>
            SEG
          </Text>
        )}
      </View>
    </Animated.View>
  );
}
