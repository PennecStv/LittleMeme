import { ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, space, themed } from './theme';

export function Screen({
  children,
  scroll = false,
  style,
  transparent,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Pas de fond : l'écran dessine le sien derrière (accueil). */
  transparent?: boolean;
}) {
  return (
    <SafeAreaView style={[styles.screen, transparent && { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, style]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children, size = 34, style }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, { fontSize: size, lineHeight: size * 1.2 }, style]}>{children}</Text>;
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, muted && { color: colors.muted }, style]}>{children}</Text>;
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, style, small }: ButtonProps) {
  const palette = {
    primary: { bg: colors.accent, fg: colors.accentText, border: colors.accent },
    secondary: { bg: colors.surfaceAlt, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.border },
    danger: { bg: 'transparent', fg: colors.danger, border: colors.danger },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: palette.bg, borderColor: palette.border },
        (disabled || loading) && { opacity: 0.45 },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.buttonText, small && { fontSize: 15 }, { color: palette.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Stepper({
  label,
  value,
  min,
  max,
  step,
  format = (v) => String(v),
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.stepper}>
        {!disabled && (
          <Pressable
            hitSlop={8}
            onPress={() => onChange(Math.max(min, value - step))}
            style={styles.stepBtn}
            disabled={value <= min}
          >
            <Text style={[styles.stepBtnText, value <= min && { opacity: 0.3 }]}>−</Text>
          </Pressable>
        )}
        <Text style={styles.stepValue}>{format(value)}</Text>
        {!disabled && (
          <Pressable
            hitSlop={8}
            onPress={() => onChange(Math.min(max, value + step))}
            style={styles.stepBtn}
            disabled={value >= max}
          >
            <Text style={[styles.stepBtnText, value >= max && { opacity: 0.3 }]}>+</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function ToggleRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

export function formatSeconds(s: number) {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r}` : `${m} min`;
}

/** Compte à rebours basé sur l'échéance locale calculée par le client. */
export function Countdown({ deadline, total }: { deadline: number | null; total: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  if (deadline === null || !total) return null;
  const remaining = Math.max(0, deadline - now);
  const secs = Math.ceil(remaining / 1000);
  const ratio = Math.min(1, remaining / total);
  const urgent = secs <= 5;
  return (
    <View style={styles.countdown}>
      <View style={styles.countdownTrack}>
        <View
          style={[styles.countdownFill, { width: `${ratio * 100}%`, backgroundColor: urgent ? colors.danger : colors.accent }]}
        />
      </View>
      <Text style={[styles.countdownText, urgent && { color: colors.danger }]}>{secs}</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: space.md, gap: space.md },
    title: { fontFamily: fonts.display, color: colors.text, letterSpacing: -0.5 },
    label: { color: colors.muted, fontSize: 12, fontFamily: fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2 },
    body: { color: colors.text, fontSize: 15, lineHeight: 22, fontFamily: fonts.body },
    button: {
      minHeight: 54,
      borderRadius: radius.md,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.md,
    },
    buttonSmall: { minHeight: 40, borderRadius: radius.sm, paddingHorizontal: space.sm + 4 },
    buttonText: { fontSize: 16, fontFamily: fonts.heavy, letterSpacing: 0.3 },
    card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
    rowLabel: { color: colors.text, fontSize: 15, flex: 1, fontFamily: fonts.semibold },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: { color: colors.text, fontSize: 22, fontFamily: fonts.bold, marginTop: -2 },
    stepValue: { color: colors.accent, fontSize: 15, fontFamily: fonts.heavy, minWidth: 64, textAlign: 'center' },
    countdown: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    countdownTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
    countdownFill: { height: '100%', borderRadius: 5 },
    countdownText: { color: colors.accent, fontFamily: fonts.display, fontSize: 24, minWidth: 40, textAlign: 'right' },
  }),
);
