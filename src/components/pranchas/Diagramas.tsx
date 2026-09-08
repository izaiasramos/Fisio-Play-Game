// Pranchas do jogo "Arrastar na anatomia" — todas SEM rótulos, com cada
// estrutura numa posição conhecida que casa com os alvos de anatomia-arrastar.json.
//
// Dois tipos convivem aqui:
//
//  1. `prancha-*` — ilustração anatômica real de domínio público (Wikimedia
//     Commons), com rótulos e linhas-guia removidos por scripts/gerar_pranchas.py.
//     É o caminho preferido: forma realista de verdade. Os SVGs ficam em ./svg/.
//
//  2. `diag-*` — diagramas esquemáticos autorais, herdados. Ossos longos são
//     desenhados como cápsula (linha grossa + epífises), o que lê como "bastão"
//     e não como osso. Vão sendo substituídos pelos `prancha-*`.

import type { FC } from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Polygon,
  Rect,
  Stop,
  SvgXml,
} from "react-native-svg";
import { colors } from "@/theme/tokens";
import { SVG_PRANCHA_MMII } from "./svg/prancha-mmii";

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

/** Osso longo = cápsula (linha grossa com pontas arredondadas) + epífises. */
function Capsula({
  x1,
  y1,
  x2,
  y2,
  w,
  knob = 0.72,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  knob?: number;
}) {
  return (
    <G>
      {/* glow neon */}
      <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.accent} strokeOpacity={0.22} strokeWidth={w + 3.5} strokeLinecap="round" />
      {/* contorno */}
      <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={OSSO_OUTLINE} strokeWidth={w} strokeLinecap="round" />
      {/* corpo */}
      <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#osso)" strokeWidth={w - 1.4} strokeLinecap="round" />
      <Circle cx={x1} cy={y1} r={w * knob} fill="url(#osso)" stroke={OSSO_OUTLINE} strokeWidth={0.6} />
      <Circle cx={x2} cy={y2} r={w * knob} fill="url(#osso)" stroke={OSSO_OUTLINE} strokeWidth={0.6} />
    </G>
  );
}

/** MMII — fêmur, patela, tíbia, fíbula. */
function DiagramaMMII({ width, height }: DiagProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 150">
      <DefsOsso />
      {/* Fêmur */}
      <Capsula x1={54} y1={8} x2={50} y2={62} w={9} />
      {/* Patela */}
      <G>
        <Ellipse cx={50} cy={70} rx={5.5} ry={6.5} fill={colors.accent} opacity={0.18} />
        <Ellipse cx={50} cy={70} rx={4.6} ry={5.6} fill="url(#osso)" stroke={OSSO_OUTLINE} strokeWidth={0.7} />
      </G>
      {/* Tíbia */}
      <Capsula x1={47} y1={80} x2={46} y2={136} w={8} />
      {/* Fíbula */}
      <Capsula x1={58} y1={82} x2={59} y2={133} w={4} knob={0.9} />
    </Svg>
  );
}

/** MMSS — escápula, úmero, rádio, ulna. */
function DiagramaMMSS({ width, height }: DiagProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 150">
      <DefsOsso />
      {/* Escápula (triângulo) */}
      <G>
        <Polygon points="58,8 76,12 66,30" fill={colors.accent} opacity={0.16} />
        <Polygon points="59,10 74,13 66,28" fill="url(#osso)" stroke={OSSO_OUTLINE} strokeWidth={0.7} />
      </G>
      {/* Úmero */}
      <Capsula x1={50} y1={16} x2={49} y2={62} w={8} />
      {/* Ulna (medial, com olécrano) */}
      <Capsula x1={44} y1={66} x2={43} y2={124} w={6} knob={0.95} />
      {/* Rádio (lateral) */}
      <Capsula x1={57} y1={68} x2={58} y2={122} w={5} />
    </Svg>
  );
}

/** Joelho — fêmur (côndilos), patela, tíbia, fíbula. */
function DiagramaJoelho({ width, height }: DiagProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 150">
      <DefsOsso />
      {/* Fêmur: haste + côndilos */}
      <Capsula x1={49} y1={6} x2={50} y2={24} w={10} />
      <Capsula x1={41} y1={28} x2={59} y2={28} w={13} knob={0.9} />
      {/* Patela */}
      <G>
        <Ellipse cx={50} cy={46} rx={7.5} ry={8.5} fill={colors.accent} opacity={0.18} />
        <Ellipse cx={50} cy={46} rx={6.4} ry={7.4} fill="url(#osso)" stroke={OSSO_OUTLINE} strokeWidth={0.8} />
      </G>
      {/* Tíbia: platô + haste */}
      <Capsula x1={40} y1={60} x2={56} y2={60} w={9} knob={0.7} />
      <Capsula x1={47} y1={62} x2={46} y2={132} w={11} />
      {/* Fíbula (lateral) */}
      <Capsula x1={66} y1={62} x2={67} y2={128} w={5} knob={1.1} />
    </Svg>
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
  // pranchas realistas (domínio público, geradas por script)
  "prancha-mmii": daString(SVG_PRANCHA_MMII),
  // esquemáticos autorais (legado, em substituição)
  "diag-mmii": DiagramaMMII,
  "diag-mmss": DiagramaMMSS,
  "diag-joelho": DiagramaJoelho,
  "diag-coluna": DiagramaColuna,
};
