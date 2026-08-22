import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useFavourites } from '@/features/favourites/favourites-context';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import { ApiError } from '@/services/api-client';



type Props = {
  propertyId: string;
  /**
   * `overlay` — a filled circular chip, for sitting on top of a property photo
   *   where the background is an unknown colour.
   * `header`  — a bare icon for a header row that already has its own ground.
   */
  variant?: 'overlay' | 'header';
};

export default function FavouriteButton({ propertyId, variant = 'overlay' }: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isFavourite, isFavouriteBusy, toggleFavourite } = useFavourites();

  const isOverlay = variant === 'overlay';
  const favourited = isFavourite(propertyId);
  const busy = isFavouriteBusy(propertyId);

  const handlePress = async (event: GestureResponderEvent) => {
    
    event.stopPropagation();

    try {
      const outcome = await toggleFavourite(propertyId);

      if (outcome === 'unauthenticated') {
        router.push('/login');
      }

    } catch (error) {
      Alert.alert(
        t('favourites.actionFailed'),
        error instanceof ApiError ? error.message : t('common.somethingWentWrong')
      );
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      // Only THIS property's control locks while its own request runs. The busy
      // state is a per-id Set, so every other heart stays live.
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={favourited ? t('favourites.remove') : t('favourites.add')}
      // `selected` is what a screen reader announces as the on/off state, and
      // `busy` explains why the control is briefly inert.
      accessibilityState={{ selected: favourited, disabled: busy, busy }}
      // Widens the target beyond the small icon without changing the layout.
      hitSlop={10}
      style={({ pressed }) => [
        isOverlay ? styles.overlay : styles.header,
        pressed && styles.pressed,
        busy && styles.busy,
      ]}>
      <Ionicons
        name={favourited ? 'heart' : 'heart-outline'}
        size={isOverlay ? 20 : 22}
        /**
         * Filled hearts use the palette's `danger` red — the one warm accent
         * every theme defines, and the colour the website uses for the same
         * control. An unfilled heart takes the contrast colour of whatever it
         * sits on: light over an unknown photo, body text in a header.
         */
        color={favourited ? theme.danger : isOverlay ? theme.textOnDark : theme.text}
      />
    </Pressable>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  /**
   * A translucent dark disc. Property photos range from bright sky to near
   * black, so neither a light nor a dark icon is legible on its own — the chip
   * supplies a consistent ground the outline can always be read against.
   */
  overlay: {
    position: 'absolute',
    right: Spacing.sm,
    top: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,17,17,0.42)',
  },
  /** Bare icon; the header already provides its own background and padding. */
  header: {
    padding: Spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  /** Dimmed while its request is in flight, matching Button's blocked state. */
  busy: {
    opacity: 0.6,
  },
});
