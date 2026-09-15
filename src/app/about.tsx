import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import ScreenHeader from '@/components/ui/screen-header';
import SectionHeader from '@/components/ui/section-header';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { hasAboutScreenContent, resolveAboutContent } from '@/features/about/about-content';
import { useAboutContent } from '@/features/about/use-about-content';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * ABOUT VARLIKENT — the full screen behind Home's "Learn More".
 *
 * Content is the website's About CMS document (GET /api/about), read through
 * the same shared source as the Home preview, so arriving here from Home shows
 * the same content instantly. The layout is the app's own: one readable column
 * rather than the website's alternating bands.
 *
 * Shown, where the document has them: hero label/heading/subtext, mission
 * image, mission label/heading/paragraphs, captioned figures, content blocks.
 * Not shown: Team — see features/about/about-content.ts for why.
 *
 * ── States ──────────────────────────────────────────────────────────────
 * Something is on screen from the first frame (session, cached or bundled
 * content). A retry is offered only when all there is to show is the bundled
 * baseline AND the server could not be reached; the full "unavailable" state
 * exists for a document with nothing renderable at all.
 */
export default function AboutScreen() {
  const { t, language } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { row, textAlign } = useDirection();
  const router = useRouter();
  const { content, origin, status, retry } = useAboutContent();

  const about = useMemo(() => resolveAboutContent(content, language), [content, language]);
  const [failedImages, setFailedImages] = useState<readonly string[]>([]);

  const handleBack = () => {
    // Same fallback as the other standalone screens opened from Home.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const canShowImage = (uri: string) => uri !== '' && !failedImages.includes(uri);
  const markImageFailed = (uri: string) =>
    setFailedImages((prev) => (prev.includes(uri) ? prev : [...prev, uri]));

  const hasContent = hasAboutScreenContent(about);
  const showRefreshNotice = origin === 'fallback' && status === 'error';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('about.title')} onBack={handleBack} />

      {!hasContent ? (
        <View style={styles.centered}>
          {status === 'loading' ? (
            <ActivityIndicator color={theme.primaryInk} />
          ) : (
            <>
              <Text style={styles.unavailableTitle}>{t('about.unavailableTitle')}</Text>
              <Text style={styles.unavailableBody}>{t('about.unavailableBody')}</Text>
              <Button label={t('common.retry')} onPress={retry} style={styles.retryButton} />
            </>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {showRefreshNotice ? (
            <View style={[styles.notice, { flexDirection: row }]}>
              <Text style={[styles.noticeText, { textAlign }]} accessibilityRole="alert">
                {t('about.refreshFailed')}
              </Text>
              <Pressable onPress={retry} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.noticeAction}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* ── Hero ────────────────────────────────────────────── */}
          {about.heroHeading || about.heroSubtext ? (
            <View style={styles.block}>
              {about.heroHeading ? (
                <SectionHeader eyebrow={about.heroLabel || undefined} title={about.heroHeading} size="lg" rule />
              ) : null}
              {about.heroSubtext ? (
                <Text style={[styles.lead, { textAlign }]}>{about.heroSubtext}</Text>
              ) : null}
            </View>
          ) : null}

          {/* ── Mission ─────────────────────────────────────────── */}
          {canShowImage(about.missionImage) ? (
            <Image
              source={{ uri: about.missionImage }}
              style={styles.image}
              contentFit="cover"
              transition={200}
              accessibilityLabel={about.missionHeading || t('about.imageA11y')}
              onError={() => markImageFailed(about.missionImage)}
            />
          ) : null}

          {about.missionHeading || about.missionParagraphs.length > 0 ? (
            <View style={styles.block}>
              {about.missionHeading ? (
                <SectionHeader eyebrow={about.missionLabel || undefined} title={about.missionHeading} />
              ) : null}
              {about.missionParagraphs.map((paragraph, index) => (
                <Text key={index} style={[styles.paragraph, { textAlign }]}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ) : null}

          {/* ── Figures (captioned only) ────────────────────────── */}
          {about.stats.length > 0 ? (
            <View style={[styles.stats, { flexDirection: row }]}>
              {about.stats.map((stat, index) => (
                <View
                  key={`${index}-${stat.value}`}
                  style={styles.stat}
                  accessible
                  accessibilityLabel={`${stat.value} ${stat.label}`}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* ── Content blocks: heading, image, paragraphs — stacked on a phone ── */}
          {about.contentBlocks.map((block, index) => (
            <View key={index} style={styles.block}>
              {block.heading ? <SectionHeader title={block.heading} /> : null}
              {canShowImage(block.image) ? (
                <Image
                  source={{ uri: block.image }}
                  style={[styles.image, styles.blockImage]}
                  contentFit="cover"
                  transition={200}
                  accessibilityLabel={block.heading || t('about.imageA11y')}
                  onError={() => markImageFailed(block.image)}
                />
              ) : null}
              {block.paragraphs.map((paragraph, paragraphIndex) => (
                <Text key={paragraphIndex} style={[styles.paragraph, { textAlign }]}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (theme: ThemePalette) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.softWhite,
    },
    scroll: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xxl,
      gap: Spacing.xl,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      gap: Spacing.sm,
    },
    unavailableTitle: {
      fontFamily: FontFamily.headingSemiBold,
      fontSize: FontSizes.lg,
      color: theme.text,
      textAlign: 'center',
    },
    unavailableBody: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.sm,
      color: theme.textMuted,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: Spacing.md,
      alignSelf: 'stretch',
    },
    notice: {
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.marble,
    },
    noticeText: {
      flex: 1,
      fontFamily: FontFamily.body,
      fontSize: FontSizes.xs,
      lineHeight: 18,
      color: theme.textMuted,
    },
    noticeAction: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: FontSizes.xs,
      letterSpacing: LetterSpacing.wide,
      textTransform: 'uppercase',
      color: theme.primaryInk,
    },
    block: {
      gap: Spacing.sm,
    },
    lead: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.md,
      lineHeight: 26,
      color: theme.textMuted,
    },
    paragraph: {
      fontFamily: FontFamily.body,
      fontSize: FontSizes.sm,
      lineHeight: 23,
      color: theme.text,
      marginTop: Spacing.xs,
    },
    /** 4:3, the ratio the website frames About images in. */
    image: {
      width: '100%',
      aspectRatio: 4 / 3,
      borderRadius: Radius.md,
      backgroundColor: theme.marble,
    },
    blockImage: {
      marginTop: Spacing.sm,
    },
    stats: {
      flexWrap: 'wrap',
      rowGap: Spacing.md,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.marble,
    },
    /** Two per row: long localized captions need more room than a four-up strip gives. */
    stat: {
      width: '50%',
      alignItems: 'center',
      paddingHorizontal: Spacing.xs,
    },
    statValue: {
      fontFamily: FontFamily.headingSemiBold,
      fontSize: FontSizes.xl,
      lineHeight: 34,
      color: theme.accentText,
    },
    statLabel: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: FontSizes.xs,
      lineHeight: 16,
      letterSpacing: LetterSpacing.wide,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: theme.textMuted,
      marginTop: Spacing.xs,
    },
  });
