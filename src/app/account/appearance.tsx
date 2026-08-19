import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountHeader, ScreenIntro, SelectionIndicator } from '@/components/account/settings-ui';
import { FontFamily, FontSizes, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import { THEME_IDS, THEME_META, type ThemeId } from '@/features/theme/themes';


export default function AppearanceScreen() {
  const router = useRouter();
  const { theme, themeId, setTheme } = useTheme();
  const { t, isRTL } = useLanguage();

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  };

  const handleSelect = (next: ThemeId) => {
    if (next === themeId) return;
    
    void setTheme(next);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <AccountHeader title={t('appearance.title')} onBack={handleBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenIntro text={t('appearance.subtitle')} />

        <View style={styles.list}>
          {THEME_IDS.map((id) => {
            const selected = id === themeId;
            const meta = THEME_META[id];

            return (
              <Pressable
                key={id}
                onPress={() => handleSelect(id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${t(`appearance.themes.${id}.label`)}. ${t(
                  `appearance.themes.${id}.description`
                )}`}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: theme.surface,
                    borderColor: selected ? theme.primaryInk : theme.border,
                    borderWidth: selected ? 2 : 1,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                  },
                  pressed && { backgroundColor: theme.marble },
                ]}>
                <View style={styles.swatch}>
                  {meta.swatch.map((color, index) => (
                    <View
                      key={color + index}
                      style={[
                        styles.swatchBand,
                        { backgroundColor: color },
                        index === 0 && styles.swatchTop,
                        index === meta.swatch.length - 1 && styles.swatchBottom,
                      ]}
                    />
                  ))}
                </View>

                <View style={styles.cardText}>
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: theme.text, textAlign: isRTL ? 'right' : 'left' },
                    ]}>
                    {t(`appearance.themes.${id}.label`)}
                  </Text>
                  <Text
                    style={[
                      styles.cardDescription,
                      { color: theme.textMuted, textAlign: isRTL ? 'right' : 'left' },
                    ]}>
                    {t(`appearance.themes.${id}.description`)}
                  </Text>
                </View>

                <SelectionIndicator selected={selected} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  list: { gap: Spacing.sm },

  card: {
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },

  swatch: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  swatchBand: { flex: 1 },
  swatchTop: {},
  swatchBottom: {},

  cardText: { flex: 1, gap: 2 },
  cardTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.sm,
  },
  cardDescription: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    lineHeight: 18,
  },
});
