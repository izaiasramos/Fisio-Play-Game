import { useState, type ReactNode } from "react";
import { Text, type TextProps } from "react-native";

type Props = {
  children: ReactNode;
  /**
   * lineHeight em px do texto — precisa casar com a classe/estilo aplicado.
   * Usado só no fallback web (medição por altura).
   */
  lhPx: number;
  /** classes NativeWind base (sem text-center/text-left). */
  className?: string;
  /** até quantas linhas o texto fica centralizado (default 2). */
  maxCentralizado?: number;
} & Omit<TextProps, "children" | "className" | "onLayout" | "onTextLayout" | "style">;

/**
 * Texto com alinhamento condicional cross-platform:
 *  - ≤ maxCentralizado linhas  → text-center
 *  - >  maxCentralizado linhas → text-left
 *
 * Como o número de linhas é medido de forma diferente por plataforma:
 *  - nativo (iOS/Android): onTextLayout entrega o nº EXATO de linhas
 *    (imune à escala de fonte de acessibilidade);
 *  - web (react-native-web NÃO popula .lines): usamos a altura via onLayout
 *    comparada com a altura de N linhas (lhPx * N + tolerância).
 */
export function TextoAdaptativo({
  children,
  lhPx,
  className = "",
  maxCentralizado = 2,
  ...rest
}: Props) {
  const [linhas, setLinhas] = useState<number | null>(null);
  const [altura, setAltura] = useState<number | null>(null);

  const centraliza =
    linhas != null
      ? linhas <= maxCentralizado
      : altura != null
        ? altura <= lhPx * maxCentralizado + 4
        : true; // default até medir

  return (
    <Text
      onTextLayout={(e) => {
        const n = e.nativeEvent.lines.length;
        if (n > 0) setLinhas(n);
      }}
      onLayout={(e) => setAltura(e.nativeEvent.layout.height)}
      className={`${className} ${centraliza ? "text-center" : "text-left"}`}
      {...rest}
    >
      {children}
    </Text>
  );
}
