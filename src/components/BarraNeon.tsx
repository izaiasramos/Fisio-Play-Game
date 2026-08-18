// Barra neon reutilizável (progresso/timer) na mesma linguagem do MonitorVital:
// trilho escuro com grade sutil, preenchimento com glow, um brilho que "corre"
// pela barra e pulso vermelho quando em estado crítico (timer acabando, última
// vida). Drop-in para os HUDs dos jogos.
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/theme/tokens";

type Tom = "accent" | "warning" | "primary" | "error";

type Props = {
  /** 0..100 */
  pct: number;
  tom?: Tom;
  /** vermelho + pulso (ex.: timer ≤ 5s, última vida) */
  critico?: boolean;
  altura?: number;
  duracaoMs?: number;
};

const TOM: Record<Tom, string> = {
  accent: colors.accent,
  warning: colors.warning,
  primary: colors.primary,
  error: colors.error,
};

const NTICKS = 12;

export function BarraNeon({
  pct,
  tom = "accent",
  critico = false,
  altura = 10,
  duracaoMs = 350,
}: Props) {
  const w = useSharedValue(Math.max(0, Math.min(100, pct)));
  const brilho = useSharedValue(0);
  const corre = useSharedValue(0);
  const [larg, setLarg] = useState(0);

  const corFill = critico ? colors.error : TOM[tom];

  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(100, pct)), {
      duration: duracaoMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, duracaoMs, w]);

  useEffect(() => {
    brilho.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    corre.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.linear }), -1, false);
  }, [brilho, corre]);

  const estiloFill = useAnimatedStyle(() => {
    const pulso = critico ? 0.55 + brilho.value * 0.45 : 1;
    return {
      width: `${w.value}%`,
      backgroundColor: corFill,
      shadowColor: corFill,
      shadowOpacity: (critico ? 0.95 : 0.7) * pulso,
      shadowRadius: critico ? 9 : 6,
      shadowOffset: { width: 0, height: 0 },
    };
  });

  const estiloBrilho = useAnimatedStyle(() => ({
    transform: [{ translateX: -larg * 0.35 + corre.value * (larg * 1.35) }],
  }));

  return (
    <View
      onLayout={(e) => setLarg(e.nativeEvent.layout.width)}
      style={{
        height: altura,
        borderRadius: altura,
        backgroundColor: colors.surface,
        overflow: "hidden",
        justifyContent: "center",
      }}
    >
      {/* grade: ticks sutis */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 3,
        }}
      >
        {Array.from({ length: NTICKS }).map((_, i) => (
          <View key={i} style={{ width: 1, backgroundColor: colors.card, opacity: 0.6 }} />
        ))}
      </View>

      {/* preenchimento com glow */}
      <Animated.View
        style={[
          { height: "100%", borderRadius: altura, overflow: "hidden" },
          estiloFill,
        ]}
      >
        {/* brilho que corre */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              width: 40,
              backgroundColor: "rgba(255,255,255,0.4)",
            },
            estiloBrilho,
          ]}
        />
      </Animated.View>
    </View>
  );
}
