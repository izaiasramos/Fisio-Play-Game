import { StyleSheet, View } from "react-native";
import { MotiView } from "moti";
import { colors } from "@/theme/tokens";

/**
 * Fundo futurista compartilhado: halos de luz que "respiram" atrás do conteúdo.
 * Renderize como primeiro filho de um container flex-1; fica atrás e não
 * intercepta toques (pointerEvents none).
 */
export function FundoHalos() {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <MotiView
        from={{ opacity: 0.05, scale: 1 }}
        animate={{ opacity: 0.1, scale: 1.15 }}
        transition={{ loop: true, type: "timing", duration: 4600 }}
        style={[styles.halo, styles.primario]}
      />
      <MotiView
        from={{ opacity: 0.04, scale: 1.12 }}
        animate={{ opacity: 0.09, scale: 1 }}
        transition={{ loop: true, type: "timing", duration: 5600 }}
        style={[styles.halo, styles.accent]}
      />
      <MotiView
        from={{ opacity: 0.03, scale: 1 }}
        animate={{ opacity: 0.08, scale: 1.2 }}
        transition={{ loop: true, type: "timing", duration: 6400 }}
        style={[styles.halo, styles.baixo]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { position: "absolute", width: 460, height: 460, borderRadius: 230 },
  primario: { top: -280, left: -260, backgroundColor: colors.primary },
  accent: { top: 120, right: -300, backgroundColor: colors.accent },
  baixo: { bottom: -300, left: -220, backgroundColor: colors.primaryDark },
});
