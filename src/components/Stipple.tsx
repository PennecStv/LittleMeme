import { memo, useId, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Mask, Pattern, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from './theme';

// Style « stipple » : les dégradés et les ombres sont faits de points, comme une trame de BD.

type Direction = 'bottom' | 'top' | 'right' | 'bottomRight';
const DIRECTIONS: Record<Direction, [string, string, string, string]> = {
  bottom: ['0', '1', '0', '0'],
  top: ['0', '0', '0', '1'],
  right: ['1', '0', '0', '0'],
  bottomRight: ['1', '1', '0', '0'],
};

/** Ids SVG uniques par instance : plusieurs dégradés sur un même écran ne doivent pas se mélanger. */
function useSvgId() {
  return useId().replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Ombrage en points qui s'estompe dans une direction (opaque du côté `from`).
 * Se met en fond absolu d'un élément : aucune mesure nécessaire.
 */
export const StippleShade = memo(function StippleShade({
  color,
  from = 'bottom',
  opacity = 0.35,
  spacing = 6,
  dot = 1.3,
  reach = 1,
}: {
  color: string;
  from?: Direction;
  opacity?: number;
  spacing?: number;
  dot?: number;
  /** Part de l'élément couverte par le dégradé (0..1). */
  reach?: number;
}) {
  const id = useSvgId();
  const [x1, y1, x2, y2] = DIRECTIONS[from];
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id={`p${id}`} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
          <Circle cx={spacing / 2} cy={spacing / 2} r={dot} fill={color} />
        </Pattern>
        <LinearGradient id={`g${id}`} x1={x1} y1={y1} x2={x2} y2={y2}>
          <Stop offset="0" stopColor="#fff" stopOpacity={1} />
          <Stop offset={String(reach)} stopColor="#fff" stopOpacity={0} />
        </LinearGradient>
        <Mask id={`m${id}`}>
          <Rect width="100%" height="100%" fill={`url(#g${id})`} />
        </Mask>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#p${id})`} mask={`url(#m${id})`} opacity={opacity} />
    </Svg>
  );
});

/**
 * Fond plein écran en demi-teinte : la taille des points suit deux dégradés radiaux
 * (accent en bas à gauche, accent2 en haut à droite).
 */
export const HalftoneBackground = memo(function HalftoneBackground({ accent, accent2 }: { accent: string; accent2: string }) {
  const { width, height } = useWindowDimensions();
  const dots = useMemo(() => {
    const spacing = 15;
    const maxR = spacing * 0.38;
    const sources = [
      { x: 0, y: height, radius: Math.max(width, height) * 0.75, color: 0 },
      { x: width, y: 0, radius: Math.max(width, height) * 0.45, color: 1 },
    ];
    const out: { x: number; y: number; r: number; c: number }[] = [];
    for (let row = 0, y = 0; y <= height + spacing; row++, y += spacing * 0.87) {
      // Une rangée sur deux est décalée : trame en quinconce, comme une vraie demi-teinte.
      for (let x = row % 2 ? spacing / 2 : 0; x <= width + spacing; x += spacing) {
        for (const s of sources) {
          const t = 1 - Math.hypot(x - s.x, y - s.y) / s.radius;
          if (t > 0.04) out.push({ x, y, r: maxR * Math.pow(t, 1.4), c: s.color });
        }
      }
    }
    return out;
  }, [width, height]);
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none" opacity={0.2}>
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c ? accent2 : accent} />
      ))}
    </Svg>
  );
});

// Bandes d'ombrage du titre, en fraction de la taille de police au-dessus de la ligne de base.
const SHADE_BANDS = [
  { top: 0.17, bottom: 0, r: 1.7 },
  { top: 0.3, bottom: 0.17, r: 1.15 },
  { top: 0.42, bottom: 0.3, r: 0.6 },
];

/** Titre en Montserrat Black avec ombre portée en points et lettres ombrées en points vers le bas. */
export function StippleTitle({ text, fontSize, width }: { text: string; fontSize: number; width: number }) {
  const id = useSvgId();
  const height = fontSize * 1.15;
  const baseline = fontSize * 0.9;
  const shadow = Math.round(fontSize * 0.08);
  const common = {
    x: width / 2,
    y: baseline,
    fontSize,
    fontFamily: fonts.display,
    textAnchor: 'middle' as const,
    letterSpacing: -fontSize * 0.03,
  };
  return (
    <Svg width={width} height={height + shadow}>
      <Defs>
        <Pattern id={`a${id}`} width={6} height={6} patternUnits="userSpaceOnUse">
          <Circle cx={3} cy={3} r={1.9} fill={colors.accent} />
        </Pattern>
        {SHADE_BANDS.map((b, i) => (
          <Pattern key={i} id={`d${i}${id}`} width={5} height={5} patternUnits="userSpaceOnUse">
            <Circle cx={2.5} cy={2.5} r={b.r} fill={colors.bg} />
          </Pattern>
        ))}
        <ClipPath id={`c${id}`}>
          <SvgText {...common}>{text}</SvgText>
        </ClipPath>
      </Defs>
      <SvgText {...common} x={width / 2 + shadow} y={baseline + shadow} fill={`url(#a${id})`}>
        {text}
      </SvgText>
      <SvgText {...common} fill={colors.text}>
        {text}
      </SvgText>
      {/* Ombrage des lettres : bandes de points de plus en plus gros vers le bas, découpées à la forme du texte. */}
      <G clipPath={`url(#c${id})`} opacity={0.5}>
        {SHADE_BANDS.map((b, i) => (
          <Rect key={i} x={0} y={baseline - b.top * fontSize} width={width} height={(b.top - b.bottom) * fontSize} fill={`url(#d${i}${id})`} />
        ))}
      </G>
    </Svg>
  );
}
