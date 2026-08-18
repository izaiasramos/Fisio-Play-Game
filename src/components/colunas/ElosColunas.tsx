// Hero reativo das Colunas A-B: elos que se ligam.
// Duas colunas de nós (termos à esquerda, definições à direita). A cada
// associação certa, um elo brilhante conecta o par; erro dá flash vermelho.
// Mostra visualmente o "linkar" que é a mecânica do jogo.
import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, G, Line } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/theme/tokens";

type Props = { total: number; ativos: number; erros?: number };

const W = 180;
const PAD = 16;

export function ElosColunas({ total, ativos, erros = 0 }: Props) {
  const n = Math.max(total, 1);
  const H = 28 + n * 22;
  const leftX = 26;
  const rightX = W - 26;
  const y = (i: number) => PAD + i * 22 + 6;

  const flash = useSharedValue(0);
  const prevErros = useRef(erros);

  useEffect(() => {
    if (erros > prevErros.current) {
      flash.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 320 }));
    }
    prevErros.current = erros;
  }, [erros, flash]);

  const estiloFlash = useAnimatedStyle(() => ({ opacity: flash.value * 0.4 }));

  return (
    <View style={{ width: W, alignItems: "center" }}>
      <View style={{ width: W, height: H }}>
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16, backgroundColor: colors.error },
            estiloFlash,
          ]}
        />
        <Svg width={W} height={H}>
          {Array.from({ length: n }).map((_, i) => {
            const on = i < ativos;
            return on ? (
              <Line
                key={`e${i}`}
                x1={leftX}
                y1={y(i)}
                x2={rightX}
                y2={y(i)}
                stroke={colors.warning}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.85}
              />
            ) : (
              <Line
                key={`e${i}`}
                x1={leftX}
                y1={y(i)}
                x2={rightX}
                y2={y(i)}
                stroke={colors.card}
                strokeWidth={1}
                strokeDasharray="3 5"
                opacity={0.6}
              />
            );
          })}
          {Array.from({ length: n }).map((_, i) => {
            const on = i < ativos;
            return (
              <G key={`p${i}`}>
                <Circle cx={leftX} cy={y(i)} r={on ? 6 : 4} fill={on ? colors.primary : colors.card} />
                <Circle cx={rightX} cy={y(i)} r={on ? 6 : 4} fill={on ? colors.accent : colors.card} />
              </G>
            );
          })}
        </Svg>
      </View>
      <Text style={{ color: colors.muted, fontSize: 9, letterSpacing: 2, marginTop: 2 }}>
        {ativos}/{total} ELOS
      </Text>
    </View>
  );
}
