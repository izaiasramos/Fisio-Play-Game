import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MotiView } from "moti";
import type { Carta } from "@/games/memoria";
import { colors } from "@/theme/tokens";

type Props = {
  carta: Carta;
  virada: boolean;
  casada: boolean;
  bloqueada: boolean;
  /** posição na grade — usada para escalonar a entrada. */
  index: number;
  onPress: () => void;
};

/** Altura fixa da carta (as duas faces são absolutas e empilhadas). */
export const ALTURA_CARTA = 166;

/**
 * Carta do Jogo da Memória. A virada é simulada por duas faces empilhadas que
 * fazem crossfade + giro em Y DENTRO de ±90° (passar de 90° espelharia o texto,
 * que era o bug do flip com backfaceVisibility no RN Web). Brilho neon reativo,
 * verso com anéis e núcleo pulsante, entrada escalonada por `index`.
 */
export const CartaMemoria = memo(function CartaMemoria({
  carta,
  virada,
  casada,
  bloqueada,
  index,
  onPress,
}: Props) {
  const ehTermo = carta.lado === "termo";
  const glow = casada ? colors.success : ehTermo ? colors.primary : colors.accent;

  // Alinhamento condicional da DEFINIÇÃO (≤2 linhas centraliza, >2 alinha à
  // esquerda). Nativo usa nº de linhas (onTextLayout); web usa altura (onLayout).
  const [defLinhas, setDefLinhas] = useState<number | null>(null);
  const [defAltura, setDefAltura] = useState<number | null>(null);
  const defCentraliza =
    defLinhas != null
      ? defLinhas <= 2
      : defAltura != null
        ? defAltura <= 18 * 2 + 4
        : true;

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.5, translateY: 28 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 360, delay: index * 55 }}
      style={styles.slot}
    >
      <Pressable
        disabled={virada || bloqueada}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ disabled: virada || bloqueada }}
        accessibilityLabel={
          virada
            ? `${ehTermo ? "Termo" : "Definição"}: ${carta.texto}`
            : "Carta virada para baixo"
        }
      >
        <View style={styles.perspectiva}>
          <View style={styles.pilha}>
            {/* VERSO — gira para fora e some ao virar */}
            <MotiView
              animate={{ rotateY: virada ? "90deg" : "0deg", opacity: virada ? 0 : 1 }}
              transition={{ type: "timing", duration: 240 }}
              style={[styles.face, styles.verso]}
              pointerEvents="none"
            >
              <View style={styles.anelExterno}>
                <View style={styles.anelInterno}>
                  <MotiView
                    from={{ scale: 0.65, opacity: 0.35 }}
                    animate={{ scale: 1.2, opacity: 0.95 }}
                    transition={{ loop: true, type: "timing", duration: 1100 }}
                    style={styles.nucleo}
                  />
                </View>
              </View>
              <Text style={styles.marca}>FISIOPLAY</Text>
            </MotiView>

            {/* FRENTE — entra girando de -90° a 0° */}
            <MotiView
              animate={{
                rotateY: virada ? "0deg" : "-90deg",
                opacity: virada ? 1 : 0,
                scale: casada ? 0.955 : 1,
              }}
              transition={{ type: "spring", damping: 15, stiffness: 170 }}
              style={[
                styles.face,
                styles.frente,
                ehTermo ? styles.faceTermo : styles.faceDef,
                casada && styles.faceCasada,
                { borderColor: glow, shadowColor: glow },
              ]}
              pointerEvents="none"
            >
              <Text
                style={[
                  styles.tag,
                  {
                    color: casada
                      ? "rgba(255,255,255,0.92)"
                      : ehTermo
                      ? "rgba(255,255,255,0.72)"
                      : colors.accent,
                  },
                ]}
              >
                {casada ? "✓ PAR" : ehTermo ? "TERMO" : "DEFINIÇÃO"}
              </Text>
              <Text
                numberOfLines={ehTermo ? 3 : 6}
                onTextLayout={
                  ehTermo
                    ? undefined
                    : (e) => {
                        const n = e.nativeEvent.lines.length;
                        if (n > 0) setDefLinhas(n);
                      }
                }
                onLayout={ehTermo ? undefined : (e) => setDefAltura(e.nativeEvent.layout.height)}
                style={
                  ehTermo
                    ? styles.textoTermo
                    : [
                        styles.textoDef,
                        casada && styles.textoDefCasada,
                        !defCentraliza && styles.textoDefEsq,
                      ]
                }
              >
                {carta.texto}
              </Text>
            </MotiView>
          </View>
        </View>
      </Pressable>
    </MotiView>
  );
});

const styles = StyleSheet.create({
  slot: { width: "48%", marginBottom: 12 },
  perspectiva: { transform: [{ perspective: 900 }] },
  pilha: { height: ALTURA_CARTA },
  face: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    padding: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  frente: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowOpacity: 0.85,
    shadowRadius: 16,
    elevation: 8,
  },
  faceTermo: { backgroundColor: colors.primary },
  faceDef: { backgroundColor: "#10182E" },
  faceCasada: { backgroundColor: colors.successDeep },
  verso: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: "rgba(108,92,231,0.45)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 9,
    elevation: 4,
  },
  anelExterno: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: "rgba(0,210,168,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  anelInterno: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: "rgba(108,92,231,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  nucleo: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent },
  marca: {
    color: "rgba(138,147,173,0.7)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3,
    marginTop: 10,
  },
  tag: { fontSize: 10, fontWeight: "700", letterSpacing: 2, textAlign: "center", marginBottom: 8 },
  textoTermo: { color: "#fff", fontSize: 19, fontWeight: "800", textAlign: "center" },
  textoDef: { color: colors.ink, fontSize: 13, lineHeight: 18, textAlign: "center" },
  textoDefEsq: { textAlign: "left" },
  textoDefCasada: { color: "#fff" },
});
