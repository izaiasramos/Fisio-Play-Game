// Pranchas do jogo "Arrastar na anatomia" — todas SEM rótulos, com cada
// estrutura numa posição conhecida que casa com os alvos de anatomia-arrastar.json.
//
// Dois tipos convivem aqui:
//
//  1. `prancha-*` — ilustração anatômica real de domínio público (Wikimedia
//     Commons), com rótulos e linhas-guia removidos por scripts/gerar_pranchas.py.
//     É o caminho preferido: forma realista de verdade. Os SVGs ficam em ./svg/.
//
//  2. `diag-*` — esquemático autoral, herdado. Só a coluna ainda usa: a prancha
//     equivalente do Commons é um PNG de 1,26 MB embutido em base64, que não
//     compensa no bundle (ver a nota no fim de scripts/gerar_pranchas.py).
//     Os de membro inferior, superior e joelho foram removidos — desenhavam osso
//     longo como cápsula (linha grossa + epífises), que lia como "bastão".

import type { FC } from "react";
import Svg, { Defs, G, LinearGradient, Rect, Stop, SvgXml } from "react-native-svg";
import { colors } from "@/theme/tokens";
import { SVG_PRANCHA_JOELHO } from "./svg/prancha-joelho";
import { SVG_PRANCHA_JOELHO_LIGAMENTOS } from "./svg/prancha-joelho-ligamentos";
import { SVG_PRANCHA_MAO } from "./svg/prancha-mao";
import { SVG_PRANCHA_MMII } from "./svg/prancha-mmii";
import { SVG_PRANCHA_MMSS } from "./svg/prancha-mmss";

const OSSO_OUTLINE = "#C9B27A";

type DiagProps = { width: number; height: number };

/** Gradiente de osso (definir uma vez por Svg). */
function DefsOsso() {
  return (
    <Defs>
      <LinearGradient id="osso" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FBF3DC" />
        <Stop offset="1" stopColor="#E4CE97" />
      </LinearGradient>
    </Defs>
  );
}

/** Coluna — cervical, torácica, lombar, sacro (pilha em S, tingida por região). */
function DiagramaColuna({ width, height }: DiagProps) {
  const N = 17;
  const tintRegiao = (t: number): string => {
    if (t < 0.2) return "#C4B5FD"; // cervical
    if (t < 0.62) return "#FBF3DC"; // torácica
    if (t < 0.84) return "#FDE68A"; // lombar
    return colors.accent; // sacro
  };
  const verts = Array.from({ length: N }, (_, i) => {
    const t = i / (N - 1);
    const y = 10 + t * 122;
    const x = 50 + 9 * Math.sin(t * Math.PI * 1.9 - 0.5);
    const w = 11 + t * 5; // vértebras crescem para baixo
    return { x, y, w, tint: tintRegiao(t), t };
  });
  return (
    <Svg width={width} height={height} viewBox="0 0 100 150">
      <DefsOsso />
      {verts.map((v, i) => (
        <G key={i}>
          <Rect
            x={v.x - v.w / 2 - 1}
            y={v.y - 3.6}
            width={v.w + 2}
            height={7.2}
            rx={2.4}
            fill={v.tint}
            opacity={v.t < 0.62 && v.t >= 0.2 ? 0.9 : 0.35}
          />
          <Rect
            x={v.x - v.w / 2}
            y={v.y - 3}
            width={v.w}
            height={6}
            rx={2}
            fill="url(#osso)"
            stroke={OSSO_OUTLINE}
            strokeWidth={0.6}
          />
        </G>
      ))}
    </Svg>
  );
}

/**
 * Embrulha um SVG gerado (string) num componente de prancha. O viewBox já vem
 * recortado no desenho, então basta mandar a caixa que a tela reservou.
 */
function daString(xml: string): FC<DiagProps> {
  return function PranchaGerada({ width, height }: DiagProps) {
    return <SvgXml xml={xml} width={width} height={height} />;
  };
}

/** Registro de diagramas por chave (usado pela tela do jogo e pela prancha.diagrama). */
export const DIAGRAMAS: Record<string, FC<DiagProps>> = {
  // pranchas realistas (domínio público, geradas por scripts/gerar_pranchas.py)
  "prancha-mmii": daString(SVG_PRANCHA_MMII),
  "prancha-mmss": daString(SVG_PRANCHA_MMSS),
  "prancha-mao": daString(SVG_PRANCHA_MAO),
  "prancha-joelho": daString(SVG_PRANCHA_JOELHO),
  "prancha-joelho-ligamentos": daString(SVG_PRANCHA_JOELHO_LIGAMENTOS),
  // esquemático autoral: só a coluna ainda usa (ver nota em gerar_pranchas.py
  // sobre a prancha de coluna do Commons ser um PNG de 1,26 MB embutido)
  "diag-coluna": DiagramaColuna,
};
