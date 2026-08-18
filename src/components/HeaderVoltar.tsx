import { Pressable, Text } from "react-native";
import { router } from "expo-router";
import { colors } from "@/theme/tokens";

/**
 * Botão de voltar SEMPRE presente no header (não depende de histórico, ao
 * contrário do back nativo do navegador/Stack). Volta no histórico quando há;
 * senão cai para a Home (caso de deep link / refresh direto num jogo).
 */
export function HeaderVoltar() {
  const voltar = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  return (
    <Pressable
      onPress={voltar}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      hitSlop={12}
      style={{ flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 12, paddingVertical: 4 }}
    >
      <Text style={{ color: colors.ink, fontSize: 24, marginRight: 2, lineHeight: 24 }}>‹</Text>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>Voltar</Text>
    </Pressable>
  );
}
