// Hero reativo do "Qual a conduta?": pulso clínico.
// Um anel de confiança (verde) que enche com os acertos, batendo como um
// coração. Acerto dá um pop verde; erro dá flash vermelho. Centro mostra ♥ e
// acertos/total — na família visual do monitor de sinais vitais.
import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/theme/tokens";

const ACircle = Animated.createAnimatedComponent(Circle);

type Estado = "jogando" | "acerto" | "erro";
type Props = { acertos: number; total: number; estado: Estado; tamanho?: number };

export function PulsoClinico({ acertos, total, estado, tamanho = 120 }: Props) {
  const R = (tamanho - 16) / 2;
  const C = 2 * Math.PI * R;
  const cx = tamanho / 2;
  const cy = tamanho / 2;

  const frac = useSharedValue(0);
  const batida = useSharedValue(0);
  const pop = useSharedValue(0);
  const flash = useSharedValue(0);

  const alvo = Math.min(total > 0 ? acertos / total : 0, 1);

  useEffect(() => {
    frac.value = withTiming(alvo, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [alvo, frac]);

  useEffect(() => {
    // batida dupla de coração
    batida.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 140 }),
        withTiming(0.2, { duration: 160 }),
        withTiming(0.7, { duration: 140 }),
        withTiming(0, { duration: 620 })
      ),
      -1,
      false
    );
  }, [batida]);

  useEffect(() => {
    if (estado === "acerto") {
      pop.value = withSequence(withTiming(1, { duration: 150 }), withTiming(0, { duration: 260 }));
    } else if (estado === "erro") {
      flash.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 340 }));
    }
  }, [estado, pop, flash]);

  const arcoProps = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - frac.value),
    stroke: colors.success,
  }));

  const estiloPulso = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + batida.value * 0.05 + pop.value * 0.18 }],
  }));
  const estiloFlash = useAnimatedStyle(() => ({ opacity: flash.value * 0.5 }));

  return (
    <View style={{ width: tamanho, height: tamanho, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: colors.error },
          estiloFlash,
        ]}
      />
      <Animated.View style={estiloPulso}>
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
      </Animated.View>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ color: colors.error, fontSize: 20 }}>♥</Text>
        <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900", marginTop: -2 }}>
          {acertos}/{total}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 8, letterSpacing: 2 }}>CONFIANÇA</Text>
      </View>
    </View>
  );
}
