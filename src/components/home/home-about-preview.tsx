import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/button';
import SectionHeader from '@/components/ui/section-header';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { resolveAboutContent, selectAboutPreview } from '@/features/about/about-content';
import { useAboutContent } from '@/features/about/use-about-content';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * HOME → ABOUT VARLIKENT
 *
 * A short introduction to the company and the way into /about. The text,
 * image and figures are the website's About CMS content (GET /api/about); only
 * the eyebrow and the button are app interface strings.
 *
 * ── Never in the way ────────────────────────────────────────────────────
 * It renders at once from the bundled or cached content and refreshes itself
 * in the background, independently of the featured properties above it. If
 * there is nothing worth showing, it renders nothing — Home is never held up
 * or broken by About.
 *
 * Deliberately brief: one heading, one paragraph, the image and at most four
 * captioned figures. Everything else lives on /about.
 */
export default function HomeAboutPreview() {
  const { t, language } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { row, textAlign } = useDirection();
  const router = useRouter();
  const { content } = useAboutContent();

  const preview = useMemo(() => selectAboutPreview(resolveAboutContent(content, language)), [content, language]);

  /** The URL that failed to load, so a broken image collapses instead of leaving a grey box. */
  const [failedImage, setFailedImage] = useState<string | null>(null);

  if (!preview) return null;

  const showImage = preview.image !== '' && preview.image !== failedImage;

  return (
    <View style={styles.section} testID="home-about-preview">
      {preview.heading ? (
        <SectionHeader eyebrow={t('about.previewEyebrow')} title={preview.heading} />
      ) : (
        <SectionHeader title={t('about.title')} />
      )}

      {showImage ? (
        <Image
          source={{ uri: preview.image }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          accessibilityLabel={t('about.imageA11y')}
          onError={() => setFailedImage(preview.image)}
        />
      ) : null}

      {preview.body ? (
        <Text style={[styles.body, { textAlign }]} numberOfLines={4}>
          {preview.body}
        </Text>
      ) : null}

      {preview.stats.length > 0 ? (
        <View style={[styles.stats, { flexDirection: row }]}>
          {preview.stats.map((stat, index) => (
            // One focusable fact per figure, rather than a number and a caption read apart.
            <View
              key={`${index}-${stat.value}`}
              style={styles.stat}
              accessible
              accessibilityLabel={`${stat.value} ${stat.label}`}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel} numberOfLines={2}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Button
        label={t('about.learnMore')}
        variant="secondary"
        accessibilityHint={t('about.learnMoreA11y')}
        onPress={() => router.push('/about')}
        style={styles.cta}
      />
    </View>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    section: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.xl,
    },
    /** 16:10 keeps a landscape mission photo recognisable without dominating the scroll. */
    image: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: Radius.md,
      marginTop: Spacing.lg,
      backgroundColor: theme.marble,
    },
    body: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.sm,
      lineHeight: 22,
      color: theme.textMuted,
      marginTop: Spacing.md,
    },
    stats: {
      flexDirection: 'row',
      marginTop: Spacing.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      backgroundColor: theme.marble,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radius.md,
    },
    /** `flex: 1` divides the row evenly for however many figures there are. */
    stat: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: Spacing.xs,
    },
    statValue: {
      fontFamily: FontFamily.headingSemiBold,
      fontSize: FontSizes.lg,
      lineHeight: 26,
      color: theme.text,
    },
    statLabel: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 10,
      lineHeight: 14,
      letterSpacing: LetterSpacing.wide,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: theme.textMuted,
      marginTop: Spacing.xs,
    },
    cta: {
      marginTop: Spacing.lg,
    },
  });
