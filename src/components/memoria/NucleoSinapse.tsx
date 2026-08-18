// Hero reativo da Memória: núcleo de sinapses.
// Nós ao redor de um núcleo acendem e se conectam ao centro conforme os pares
// são encontrados; o núcleo pulsa e cresce com o progresso, dá um "pop" a cada
// par novo e um flash vermelho quando erra. Centro mostra pares/total.
import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/theme/tokens";

type Props = { total: number; ativos: number; erros?: number; tamanho?: number };

export function NucleoSinapse({ total, ativos, erros = 0, tamanho = 128 }: Props) {
  const cx = tamanho / 2;
  const cy = tamanho / 2;
  const rAnel = tamanho / 2 - 14;
  const rNucleo = tamanho * 0.2;

  const pulso = useSharedValue(0);
  const pop = useSharedValue(0);
  const flash = useSharedValue(0);
  const prevAtivos = useRef(ativos);
  const prevErros = useRef(erros);

  const frac = Math.min(total > 0 ? ativos / total : 0, 1);

  useEffect(() => {
    pulso.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulso]);

  useEffect(() => {
    if (ativos > prevAtivos.current) {
      pop.value = withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 260 }));
    }
    prevAtivos.current = ativos;
  }, [ativos, pop]);

  useEffect(() => {
    if (erros > prevErros.current) {
      flash.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 320 }));
    }
    prevErros.current = erros;
  }, [erros, flash]);

  const estiloNucleo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + frac * 0.15 + pulso.value * 0.08 + pop.value * 0.25 }],
    opacity: 0.5 + frac * 0.4,
  }));
  const estiloFlash = useAnimatedStyle(() => ({ opacity: flash.value * 0.5 }));

  const nos = Array.from({ length: Math.max(total, 1) }).map((_, i) => {
    const ang = (-90 + i * (360 / Math.max(total, 1))) * (Math.PI / 180);
    return {
      x: cx + rAnel * Math.cos(ang),
      y: cy + rAnel * Math.sin(ang),
      on: i < ativos,
    };
  });

  return (
    <View style={{ width: tamanho, height: tamanho, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", width: rNucleo * 2, height: rNucleo * 2, borderRadius: rNucleo, backgroundColor: colors.accent },
          estiloNucleo,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: colors.error },
          estiloFlash,
        ]}
      />
      <Svg width={tamanho} height={tamanho}>
        {nos.map((n, i) =>
          n.on ? (
            <Line key={`l${i}`} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={colors.accent} strokeWidth={2} opacity={0.5} />
          ) : null
        )}
        {nos.map((n, i) => (
          <Circle
            key={`n${i}`}
            cx={n.x}
            cy={n.y}
            r={n.on ? 6 : 3.5}
            fill={n.on ? colors.accent : colors.card}
            opacity={n.on ? 1 : 0.7}
          />
        ))}
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>
          {ativos}/{total}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 9, letterSpacing: 2, marginTop: -2 }}>SINAPSES</Text>
      </View>
    </View>
  );
}
