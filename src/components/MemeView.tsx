import { Ref, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, type HostInstance, Image, StyleSheet, Text, View } from 'react-native';
import { GameClient } from '../net/GameClient';
import { MemeTemplate, TextZone } from '../shared/types';
import { fonts } from './theme';

// Rendu d'un meme : l'image, puis le texte dans chaque zone.
// Tout est proportionnel à la largeur, donc le même meme s'affiche pareil sur tous les écrans.

type Props = {
  template: MemeTemplate;
  captions: string[];
  width: number;
  /** data URI ou fichier local ; undefined = en cours de chargement, null = indisponible. */
  imageUri?: string | null;
  /** Affiche "Texte 1", "Texte 2"... dans les zones vides (écran d'écriture). */
  placeholders?: boolean;
  highlightZone?: number | null;
  /** Permet de capturer le meme en image. */
  ref?: Ref<HostInstance>;
};

export function MemeView({ template, captions, width, imageUri, placeholders, highlightZone, ref }: Props) {
  const height = width / template.aspect;
  return (
    <View ref={ref} collapsable={false} style={{ width, height, backgroundColor: '#000', overflow: 'hidden' }}>
      {template.hasImage &&
        (imageUri ? (
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            {imageUri === undefined ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff' }}>Image indisponible</Text>
            )}
          </View>
        ))}
      {template.zones.map((zone, i) => {
        const text = captions[i] ?? '';
        const showPlaceholder = placeholders && !text.trim();
        return (
          <View
            key={i}
            style={[
              styles.zone,
              { left: zone.x * width, top: zone.y * height, width: zone.w * width, height: zone.h * height },
              placeholders && styles.zoneEditing,
              highlightZone === i && styles.zoneActive,
            ]}
          >
            <MemeText
              text={showPlaceholder ? `Texte ${i + 1}` : text}
              zone={zone}
              widthPx={zone.w * width}
              heightPx={zone.h * height}
              faded={showPlaceholder}
            />
          </View>
        );
      })}
    </View>
  );
}

/** Estime le nombre de lignes d'un texte pour une taille donnée (Anton est une police étroite). */
function estimateLines(text: string, fontSize: number, widthPx: number) {
  const charsPerLine = Math.max(1, Math.floor(widthPx / (fontSize * 0.5)));
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    let current = 0;
    lines += 1;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const len = word.length;
      if (current === 0) {
        lines += Math.floor(Math.max(0, len - 1) / charsPerLine);
        current = len % charsPerLine || charsPerLine;
      } else if (current + 1 + len <= charsPerLine) {
        current += 1 + len;
      } else {
        lines += 1 + Math.floor(Math.max(0, len - 1) / charsPerLine);
        current = len % charsPerLine || charsPerLine;
      }
    }
  }
  return lines;
}

export function fitFontSize(text: string, widthPx: number, heightPx: number) {
  let size = Math.min(heightPx * 0.8, widthPx * 0.16);
  const minSize = Math.max(8, widthPx * 0.035);
  while (size > minSize && estimateLines(text, size, widthPx) * size * 1.18 > heightPx) size *= 0.92;
  return Math.max(minSize, size);
}

function MemeText({
  text,
  zone,
  widthPx,
  heightPx,
  faded,
}: {
  text: string;
  zone: TextZone;
  widthPx: number;
  heightPx: number;
  faded?: boolean;
}) {
  if (!text) return null;
  const display = zone.style === 'plain' ? text : text.toUpperCase();
  const fontSize = fitFontSize(display, widthPx, heightPx);
  const base = { fontFamily: fonts.meme, fontSize, lineHeight: fontSize * 1.18, textAlign: 'center' as const };

  if (zone.style === 'plain') {
    return (
      <Text allowFontScaling={false} style={[base, { color: '#111', opacity: faded ? 0.3 : 1 }]}>
        {display}
      </Text>
    );
  }
  // Contour noir : React Native ne sait pas faire de "stroke" sur du texte,
  // on superpose donc le texte décalé en noir dans 8 directions sous le texte blanc.
  const stroke = Math.max(1, fontSize * 0.07);
  const offsets = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => [dx, dy])).filter(([dx, dy]) => dx || dy);
  return (
    <View style={{ opacity: faded ? 0.35 : 1, width: '100%' }}>
      {offsets.map(([dx, dy], i) => (
        <Text
          key={i}
          allowFontScaling={false}
          style={[
            base,
            styles.strokeLayer,
            { color: '#000', transform: [{ translateX: dx * stroke }, { translateY: dy * stroke }] },
          ]}
        >
          {display}
        </Text>
      ))}
      <Text allowFontScaling={false} style={[base, { color: '#fff' }]}>
        {display}
      </Text>
    </View>
  );
}

/** Récupère une image (template, photo de profil) auprès de l'hôte, avec cache. */
export function useAsset(client: GameClient | null | undefined, id: string | null): string | null | undefined {
  const subscribe = (cb: () => void) => (client ? client.subscribeAssets(cb) : () => {});
  const value = useSyncExternalStore(subscribe, () => (client && id ? client.getAsset(id) : null));
  return id ? value : null;
}

export function useTemplateImage(client: GameClient | null | undefined, template: MemeTemplate): string | null | undefined {
  return useAsset(client, template.hasImage ? template.id : null);
}

/** Mesure la largeur disponible pour afficher un meme. */
export function useWidth(initial = 0) {
  const [width, setWidth] = useState(initial);
  return [
    width,
    (e: { nativeEvent: { layout: { width: number } } }) => setWidth(Math.floor(e.nativeEvent.layout.width)),
  ] as const;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  zone: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  zoneEditing: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderStyle: 'dashed', borderRadius: 4 },
  zoneActive: { borderColor: '#ffd23f', borderWidth: 2 },
  strokeLayer: { position: 'absolute', left: 0, right: 0, top: 0 },
});
