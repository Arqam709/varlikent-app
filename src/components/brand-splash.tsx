import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';

import VarlikentIcon from '../../assets/brand/varlikent_icon_01.svg';
import { Colors, FontFamily } from '@/constants/theme';

/**
 * VARLIKENT BRAND SPLASH
 *
 * A full-screen overlay shown once at startup, after the native splash hides.
 * It owns its whole presentation — layout, animation and timing — and reports
 * upward exactly once, when the animation has finished.
 *
 * Presentation values were taken from the website's LoadingScreen.jsx so the
 * two feel like the same brand. The TIMING is deliberately different: the site
 * runs ~2.7s, which is far too long to make a mobile user wait. This runs in
 * roughly 1.05s.
 *
 * Note the mark keeps its original green and navy fills. On #080a0e the navy
 * is almost invisible by design — the website does exactly the same, so this
 * is intentional depth, not a contrast bug.
 */

type Props = {
  /** Called once, after the fade-out completes. */
  onFinish: () => void;
};

// ── Timing (ms) ──────────────────────────────────────────────────────────
const MARK_IN = 340;
const WORDMARK_DELAY = 180;
const WORDMARK_IN = 260;
const RULE_DELAY = 300;
const RULE_IN = 240;
/** Pause on the fully-composed logo before dismissing. */
const HOLD = 260;
const FADE_OUT = 260;
// Total ≈ 340 + 260 (hold) + 260 (fade) with the delayed pieces overlapping,
// landing near 1050ms end to end.

/** Matches the website: 0.35em at 16px. RN letterSpacing is absolute, not em. */
const WORDMARK_TRACKING = 5.6;

export default function BrandSplash({ onFinish }: Props) {
  /**
   * `useRef` keeps ONE Animated.Value alive for the component's whole life.
   * Writing `new Animated.Value(0)` directly in the body would build a fresh
   * one on every render and the animation would restart from zero each time.
   *
   * An Animated.Value is a mutable number living outside React state. Changing
   * it does NOT re-render — it drives the native view directly, which is what
   * makes 60fps possible.
   */
  const markOpacity = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(0.9)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const ruleOpacity = useRef(new Animated.Value(0)).current;
  const ruleScaleX = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  /**
   * Hold the newest `onFinish` in a ref so the effect below can run exactly
   * once (`[]` deps) without ever calling a stale version. If we listed
   * `onFinish` in the deps instead, a parent passing an inline arrow function
   * would give a new identity every render and restart the animation forever.
   */
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    let cancelled = false;

    // Respect the OS "reduce motion" setting. We keep the opacity fades —
    // those are not the kind of movement that causes discomfort — but drop
    // the scale, which is the only real motion here.
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) markScale.setValue(1);

        const fade = (value: Animated.Value, duration: number, delay = 0) =>
          Animated.timing(value, {
            toValue: 1,
            duration,
            delay,
            easing: Easing.out(Easing.cubic),
            // Run on the UI thread. Startup is exactly when the JS thread is
            // busiest, so this keeps the animation smooth regardless.
            useNativeDriver: true,
          });

        Animated.sequence([
          // `parallel` runs these together; each piece staggers itself via its
          // own `delay`, so the mark leads, the wordmark follows, then the rule.
          Animated.parallel([
            fade(markOpacity, MARK_IN),
            Animated.timing(markScale, {
              toValue: 1,
              duration: MARK_IN,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            fade(wordmarkOpacity, WORDMARK_IN, WORDMARK_DELAY),
            fade(ruleOpacity, RULE_IN, RULE_DELAY),
            fade(ruleScaleX, RULE_IN, RULE_DELAY),
          ]),
          Animated.delay(HOLD),
          Animated.timing(screenOpacity, {
            toValue: 0,
            duration: FADE_OUT,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          // `finished` is false if the animation was interrupted — only report
          // completion when it genuinely ran to the end.
          if (finished && !cancelled) onFinishRef.current();
        });
      });

    return () => {
      cancelled = true;
    };
    // Empty deps: this choreography must run exactly once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[styles.screen, { opacity: screenOpacity }]}>
      <Animated.View style={{ opacity: markOpacity, transform: [{ scale: markScale }] }}>
        <VarlikentIcon width={80} height={75} />
      </Animated.View>

      <Animated.Text style={[styles.wordmark, { opacity: wordmarkOpacity }]}>
        VARLIKENT
      </Animated.Text>

      <Animated.View
        style={[
          styles.rule,
          { opacity: ruleOpacity, transform: [{ scaleX: ruleScaleX }] },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /**
   * `absoluteFillObject` is `{position:'absolute', top:0, left:0, right:0,
   * bottom:0}` — the RN equivalent of `position:fixed; inset:0`. It covers the
   * app rendered underneath, and because it is a plain View it also swallows
   * touches, so nothing behind it can be tapped mid-animation.
   */
  screen: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.splashBlack,
    zIndex: 10,
  },
  wordmark: {
    // Website uses fontWeight 400 here — Cinzel Regular, not bold.
    fontFamily: FontFamily.heading,
    fontSize: 16,
    color: Colors.textOnDark,
    letterSpacing: WORDMARK_TRACKING,
    marginTop: 20,
    /**
     * React Native adds the letter-spacing AFTER the final character too, so a
     * centred wide-tracked string sits half a space left of true centre.
     * Nudging right by half the tracking cancels it. CSS does not have this
     * problem, which is why the website needs no equivalent.
     */
    marginLeft: WORDMARK_TRACKING / 2,
  },
  rule: {
    width: 100,
    height: 1,
    marginTop: 16,
    backgroundColor: Colors.goldWarm,
  },
});
