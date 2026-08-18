// Hero reativo do Completar: anel de maestria que enche por palavra concluída.
// O arco cresce a cada palavra completada (accent → roxo conforme enche), com
// um "pop"/faísca a cada acerto. Centro mostra palavras/total.
import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/theme/tokens";

const ACircle = Animated.createAnimatedComponent(Circle);

type Props = { total: number; ativos: number; tamanho?: number };

export function AnelProgresso({ total, ativos, tamanho = 116 }: Props) {
  const R = (tamanho - 16) / 2;
  const C = 2 * Math.PI * R;
  const cx = tamanho / 2;
  const cy = tamanho / 2;

  const frac = useSharedValue(0);
  const pop = useSharedValue(0);
  const prev = useRef(ativos);
  const alvo = Math.min(total > 0 ? ativos / total : 0, 1);

  useEffect(() => {
    frac.value = withTiming(alvo, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [alvo, frac]);

  useEffect(() => {
    if (ativos > prev.current) {
      pop.value = withSequence(withTiming(1, { duration: 150 }), withTiming(0, { duration: 260 }));
    }
    prev.current = ativos;
  }, [ativos, pop]);

  const arcoProps = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - frac.value),
    stroke: interpolateColor(frac.value, [0, 0.5, 1], [colors.accent, colors.accent, colors.primary]),
  }));

  const estiloPop = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pop.value * 0.12 }] }));

  return (
    <Animated.View
      style={[{ width: tamanho, height: tamanho, alignItems: "center", justifyContent: "center" }, estiloPop]}
    >
      <Svg width={tamanho} height={tamanho}>
        <Circle cx={cx} cy={cy} r={R} stroke={colors.surface} strokeWidth={9} fill="none" />
        <ACircle
          cx={cx}
          cy={cy}
          r={R}
          strokeWidth={13}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          opacity={0.28}
          transform={`rotate(-90 ${cx} ${cy})`}
          animatedProps={arcoProps}
        />
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
        <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>
          {ativos}/{total}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 9, letterSpacing: 2, marginTop: -2 }}>PALAVRAS</Text>
      </View>
    </Animated.View>
  );
}
