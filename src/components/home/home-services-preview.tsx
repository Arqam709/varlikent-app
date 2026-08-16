import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { SERVICES, SERVICES_INTRO } from '@/features/services/services-data';

export default function HomeServicesPreview() {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>Our Expertise</Text>
      <Text style={styles.heading}>Beyond Real Estate</Text>
      <Text style={styles.intro}>{SERVICES_INTRO}</Text>

      <View style={styles.grid}>
        {SERVICES.map((service) => (
          <Pressable
            key={service.id}
            onPress={() =>
              router.push({ pathname: '/services/[service]', params: { service: service.id } })
            }
            accessibilityRole="button"
            accessibilityLabel={`${service.title}. ${service.short}`}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
            <Ionicons name={service.icon} size={22} color={Colors.brandGreen} />
            <Text style={styles.tileTitle}>{service.title}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => router.push('/services')}
        accessibilityRole="button"
        accessibilityLabel="View all services"
        style={({ pressed }) => [styles.viewAll, pressed && styles.viewAllPressed]}>
        <Text style={styles.viewAllText}>View All Services</Text>
        <Ionicons name="arrow-forward" size={16} color={Colors.brandGreen} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  eyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: Colors.brandGreen,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: Colors.charcoal,
    marginTop: Spacing.xs,
  },
  intro: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  /**
   * `48%` rather than a fixed width, so two tiles fit any phone with the gap
   * between them. flexWrap then breaks them into 2x2.
   */
  tile: {
    width: '48%',
    backgroundColor: Colors.marble,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    minHeight: 96,
    justifyContent: 'center',
  },
  /**
   * Tiles became pressable once each service gained its own route. In Phase 3A
   * they were inert on purpose — four tiles all leading to the same page would
   * have looked specific while being generic.
   */
  tilePressed: {
    borderColor: Colors.brandGreen,
    backgroundColor: Colors.cardBg,
  },
  tileTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.sm,
    color: Colors.charcoal,
  },

  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 48,
  },
  viewAllPressed: {
    borderColor: Colors.brandGreen,
    backgroundColor: Colors.marble,
  },
  viewAllText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: Colors.brandGreen,
  },
});
