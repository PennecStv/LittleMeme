import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/** Boucle d'animation 0 → 1 → 0. */
export function useLoop(duration: number, delay = 0) {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    // Pas d'animation si l'utilisateur a activé « Réduire les animations ».
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => !reduce && anim.start());
    return () => anim.stop();
  }, [value, duration, delay]);
  return value;
}
