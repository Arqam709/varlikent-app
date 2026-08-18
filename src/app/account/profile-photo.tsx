import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountHeader, ScreenIntro, StatusMessage } from '@/components/account/settings-ui';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { initialsOf, uploadAvatar } from '@/features/account/account-api';
import { useAuth } from '@/features/auth/auth-context';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import { ApiError } from '@/services/api-client';

/**
 * PROFILE PHOTO.
 *
 * ── The backend already owns the upload ─────────────────────────────────
 * `PUT /users/me/avatar` takes a multipart file, hands it to Cloudinary
 * server-side and stores the resulting URL on the User. So there is no
 * Cloudinary SDK, no upload preset and no API key anywhere in the app — the
 * device sends bytes to Varlikent's own backend and nothing else. That also
 * means the photo set here is the photo the website shows.
 *
 * Gallery only: no camera, so the app never asks for camera permission it does
 * not need.
 */
export default function ProfilePhotoScreen() {
  const router = useRouter();
  const { user, token, applyUser } = useAuth();
  const { theme } = useTheme();
  const { t, isRTL } = useLanguage();

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  };

  const handlePick = async () => {
    if (!token || uploading) return;

    setError(null);
    setDone(false);

    // Asking only when the customer taps — never at launch — so the permission
    // prompt arrives with obvious context.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('profilePhoto.permissionBody'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      // Square, because every surface renders the avatar in a circle.
      aspect: [1, 1],
      // Recompressed on device: an untouched 12MP photo is several megabytes of
      // mobile data for something displayed at 60pt.
      quality: 0.8,
    });

    // Cancelling is a normal outcome, not an error.
    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setUploading(true);
    try {
      const updated = await uploadAvatar(token, {
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      applyUser(updated);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('profilePhoto.failed'));
    } finally {
      setUploading(false);
    }
  };

  const avatar = user?.avatar;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <AccountHeader title={t('profilePhoto.title')} onBack={handleBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenIntro text={t('profilePhoto.subtitle')} />

        <View style={styles.preview}>
          <View style={[styles.avatar, { backgroundColor: theme.primary, borderColor: theme.border }]}>
            {avatar ? (
              <Image
                source={{ uri: avatar }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
                accessibilityLabel={t('profilePhoto.title')}
              />
            ) : (
              <Text style={[styles.initials, { color: theme.primaryText }]}>
                {initialsOf(user?.name ?? '', user?.email ?? '')}
              </Text>
            )}

            {uploading ? (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#ffffff" />
              </View>
            ) : null}
          </View>

          {!avatar ? (
            <Text style={[styles.note, { color: theme.textMuted }]}>
              {t('profilePhoto.initialsNote')}
            </Text>
          ) : null}
        </View>

        {error ? <StatusMessage tone="error" text={error} /> : null}
        {done ? <StatusMessage tone="success" text={t('profilePhoto.updated')} /> : null}

        <Pressable
          onPress={handlePick}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel={avatar ? t('profilePhoto.change') : t('profilePhoto.choose')}
          accessibilityState={{ disabled: uploading, busy: uploading }}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary },
            uploading && styles.buttonDisabled,
            pressed && !uploading && { backgroundColor: theme.primaryPressed },
          ]}>
          <Text style={[styles.buttonText, { color: theme.primaryText }]}>
            {uploading
              ? t('profilePhoto.uploading')
              : avatar
                ? t('profilePhoto.change')
                : t('profilePhoto.choose')}
          </Text>
        </Pressable>

        <Text
          style={[
            styles.footnote,
            { color: theme.textMuted, textAlign: isRTL ? 'right' : 'left' },
          ]}>
          {t('profilePhoto.subtitle')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  preview: { alignItems: 'center', gap: Spacing.md, marginVertical: Spacing.lg },
  avatar: {
    width: 132,
    height: 132,
    borderRadius: Radius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarImage: { width: '100%', height: '100%' },
  initials: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 44,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  note: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    textAlign: 'center',
  },

  button: {
    marginTop: Spacing.md,
    minHeight: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    letterSpacing: LetterSpacing.wide,
  },

  footnote: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    marginTop: Spacing.lg,
  },
});
