import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import SectionHeader from '@/components/ui/section-header';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { reviewInitial, type Review } from '@/features/reviews/reviews';
import { fetchReviews } from '@/features/reviews/reviews-api';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

export default function HomeTestimonials() {
  const { t, isRTL } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchReviews().then((result) => {
      if (!cancelled) setReviews(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (reviews.length === 0) return null;

  // Same proportion as the featured carousel, so the next card always peeks.
  const cardWidth = Math.min(Math.round(width * 0.8), 320);

  return (
    <View style={styles.section} testID="home-testimonials">
      <SectionHeader
        eyebrow={t('home.testimonialsEyebrow')}
        title={t('home.testimonialsTitle')}
        style={styles.header}
      />

      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        horizontal
        inverted={isRTL}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <TestimonialCard review={item} width={cardWidth} />}
      />
    </View>
  );
}

function TestimonialCard({ review, width }: { review: Review; width: number }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { row, textAlign } = useDirection();
  /** A broken avatar falls back to the initial rather than an empty circle. */
  const [avatarFailed, setAvatarFailed] = useState(false);
  const showAvatar = review.avatar !== '' && !avatarFailed;

  return (
    <View style={[styles.card, { width }]}>
      <View
        style={[styles.stars, { flexDirection: row }]}
        accessible
        accessibilityLabel={t('home.testimonialRatingA11y', { rating: String(review.rating) })}>
        {Array.from({ length: review.rating }, (_, index) => (
          <Ionicons key={index} name="star" size={13} color={theme.gold} />
        ))}
      </View>

      {/* Clamped so one long review cannot make the whole row tall. */}
      <Text style={[styles.quote, { textAlign }]} numberOfLines={6}>
        {review.text}
      </Text>

      <View style={[styles.author, { flexDirection: row }]}>
        {showAvatar ? (
          <Image
            source={{ uri: review.avatar }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
            onError={() => setAvatarFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.avatar, styles.initial]}>
            <Text style={styles.initialText}>{reviewInitial(review.name)}</Text>
          </View>
        )}
        <View style={styles.authorText}>
          <Text style={[styles.name, { textAlign }]} numberOfLines={1}>
            {review.name}
          </Text>
          {review.role ? (
            <Text style={[styles.role, { textAlign }]} numberOfLines={1}>
              {review.role}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  section: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },

  card: {
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  /** `flex: 1` pushes the author line to the bottom, so cards of a row align. */
  quote: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
    marginTop: Spacing.md,
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: theme.marble,
  },
  initial: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
  },
  initialText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.md,
    color: theme.primaryText,
  },
  authorText: { flex: 1 },
  name: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.sm,
    color: theme.text,
  },
  role: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
    marginTop: 2,
  },
});
