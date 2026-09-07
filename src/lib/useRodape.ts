import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Folga padrão depois do último elemento de uma tela rolável. */
export const ESPACO_RODAPE = 32;

/**
 * Padding inferior seguro para telas roláveis.
 *
 * No Android o app roda em edge-to-edge (SDK 54+), então a barra de navegação
 * fica POR CIMA do conteúdo. Só `insets.bottom` não basta: em aparelhos com
 * navegação por gestos ele é pequeno (~16dp) e, enquanto o provider não mede,
 * chega a vir 0. O piso de 16 garante que o último item nunca cole na barra.
 *
 * @param extra folga visual além da área da barra do sistema.
 */
export function usePaddingRodape(extra: number = ESPACO_RODAPE): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 16) + extra;
}
