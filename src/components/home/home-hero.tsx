import { useRouter } from 'expo-router';
import { ImageBackground, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import Button from '@/components/ui/button';
import { FontFamily, FontSizes, LetterSpacing, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';

/**
 * HOME HERO
 *
 * The Varlikent hero, adapted from the website for a phone.
 *
 * Kept from the website: the villa photograph, the dark overlay, the Cinzel
 * headline with its third line in brand green, the gold rule, and both CTAs.
 *
 * Deliberately NOT ported: the GSAP ScrollTrigger pin (which scrubs a timeline
 * over 200% of scroll), the fog radials, and the giant VARLIKENT reveal. The
 * pin is a desktop-scroll idiom that would hijack three screens of swiping on
 * a phone, and our BrandSplash already does the wordmark moment.
 *
 * Extracted into its own file because it is a self-contained ~120-line visual
 * block that will keep growing. The header stayed inline in index.tsx — at
 * four lines, splitting it would create a file for its own sake.
 */
export default function HomeHero() {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  /**
   * React Native has no `vh` unit, and a percentage height only resolves when
   * the parent has a fixed height — inside a ScrollView with `flexGrow: 1` the
   * parent is unbounded, so `height: '58%'` would silently collapse.
   *
   * `useWindowDimensions` is the hook form: it re-renders on rotation, split
   * screen and foldable unfolds, unlike `Dimensions.get('window')` which is a
   * one-time snapshot taken at module load.
   */
  const { height: windowHeight } = useWindowDimensions();

  /**
   * ~46% of the window, then clamped.
   *
   * Reduced from 58%: at that size the hero owned nearly the whole first
   * screen, so nothing below it was ever hinted at and Home read as a poster
   * rather than an app. 46% keeps the photograph editorial while letting the
   * discovery section peek above the fold, which is what invites the scroll.
   *
   * The clamp is what makes this work across devices rather than one phone:
   * on a very short screen the headline and CTA would crop, and on a tablet an
   * unclamped hero would swallow the screen and hide that anything follows.
   */
  const heroHeight = Math.min(Math.max(Math.round(windowHeight * 0.46), 340), 520);

  return (
    <ImageBackground
      source={require('../../../assets/home/hero-villa.jpg')}
      // `cover` fills the box and crops the overflow, preserving aspect ratio —
      // the same behaviour as CSS `object-fit: cover` on the website.
      resizeMode="cover"
      style={[styles.hero, { height: heroHeight }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('home.heroImageAlt')}>
      {/*
        Flat dark overlay for text contrast. The website layers four gradients
        here; a single rgba View is the honest simple version and needs no
        gradient dependency. The colour is the brand charcoal (30,30,28) — the
        same `--vk-dark-rgb` the website's gradients are built from.
      */}
      <View style={styles.overlay} />

      <View style={styles.content}>
        {/*
          Eyebrow sits ABOVE the headline here. The website places it below,
          which reads oddly once the composition is compressed to phone width.
        */}
        <Text style={styles.eyebrow}>Istanbul · Real Estate</Text>

        {/*
          Explicit line breaks reproduce the website's three-line composition.
          The nested <Text> inherits the parent's font and only overrides the
          colour — this is the one place React Native does inherit style, and
          it is why the green line can flow inside the same paragraph.
        */}
        <Text style={styles.heading}>
          We Design, Build{'\n'}
          &amp; Deliver Exceptional{'\n'}
          <Text style={styles.headingAccent}>{t('home.heroLine3')}</Text>
        </Text>

        {/* Gold is decorative here — never an action. */}
        <View style={styles.goldRule} />

        <View style={styles.actions}>
          {/*
            Opens Properties with NO params, so its segmented control lands on
            "All" — see the param handling in (tabs)/properties.tsx.
          */}
          <Button
            label="View Properties"
            variant="primary"
            onPress={() => router.push('/properties')}
          />
          {/*
            Restored now that /services exists.

            It was pulled in Phase 1 because it did nothing, and a dead control
            in the most prominent position is what made Home feel unfinished.
            That objection is gone: it navigates for real, and the headline
            directly above it — "We Design, Build & Deliver" — is a claim about
            services, so the hero was arguing for a destination it did not have.

            Costs back ~60dp of hero height; the 340dp floor still fits the
            eyebrow, three-line headline, rule and both buttons.
          */}
          <Button
            label="Our Services"
            variant="outlineLight"
            onPress={() => router.push('/services')}
          />
        </View>
      </View>
    </ImageBackground>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  hero: {
    width: '100%',
    justifyContent: 'center',
  },
  /**
   * absoluteFillObject = {position:'absolute', top/left/right/bottom: 0} —
   * the RN equivalent of `position:absolute; inset:0`.
   */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30,30,28,0.55)',
  },
  content: {
    alignItems: 'center',
    // Horizontal padding lives here, not on the image, so the photograph
    // bleeds to the screen edges while the text stays inset.
    paddingHorizontal: Spacing.lg,
  },
  eyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: theme.gold,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  heading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 26,
    // RN does not inherit line-height and its default is cramped for a serif
    // at display size, so it is set explicitly.
    lineHeight: 36,
    color: theme.textOnDark,
    textAlign: 'center',
  },
  /** The website renders this third line in brand green. */
  headingAccent: {
    color: theme.green,
  },
  goldRule: {
    width: 56,
    height: 1,
    backgroundColor: theme.gold,
    // Tightened from `lg` as part of the compaction — the shorter hero needs
    // the breathing room spent on the image, not the divider.
    marginVertical: Spacing.md,
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.sm,
  },
});
