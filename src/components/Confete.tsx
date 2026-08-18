import { useMemo } from "react";
import { View } from "react-native";
import { MotiView } from "moti";
import { colors } from "@/theme/tokens";

const CORES = [colors.primary, colors.accent, colors.success, colors.warning, colors.ink];

/**
 * Explosão de confete de reforço ao acerto. Monte-o com uma `key` que muda a
 * cada acerto para reproduzir a animação. Não bloqueia toques (pointerEvents none).
 */
export function Confete({ quantidade = 20 }: { quantidade?: number }) {
  const particulas = useMemo(
    () =>
      Array.from({ length: quantidade }, (_, i) => ({
        id: i,
        cor: CORES[i % CORES.length],
        dx: (Math.random() - 0.5) * 280,
        dy: 140 + Math.random() * 280,
        rot: (Math.random() - 0.5) * 720,
        atraso: Math.random() * 90,
        tam: 6 + Math.random() * 9,
      })),
    [quantidade]
  );

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {particulas.map((p) => (
        <MotiView
          key={p.id}
          from={{ opacity: 1, translateX: 0, translateY: -10, rotate: "0deg", scale: 1 }}
          animate={{
            opacity: 0,
            translateX: p.dx,
            translateY: p.dy,
            rotate: `${p.rot}deg`,
            scale: 0.5,
          }}
          transition={{ type: "timing", duration: 950, delay: p.atraso }}
          style={{
            position: "absolute",
            alignSelf: "center",
            top: "32%",
            width: p.tam,
            height: p.tam,
            borderRadius: 2,
            backgroundColor: p.cor,
          }}
        />
      ))}
    </View>
  );
}
