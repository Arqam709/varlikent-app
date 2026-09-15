import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ContactAction from '@/components/contact/contact-action';
import Button from '@/components/ui/button';
import ScreenHeader from '@/components/ui/screen-header';
import SectionHeader from '@/components/ui/section-header';
import TextField from '@/components/ui/text-field';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { sendContactEnquiry } from '@/features/contact/contact-api';
import {
  FALLBACK_CONTACT_INTERESTS,
  contactInterestLabel,
  requestedContactInterestKey,
  resolveContactInterest,
  type ContactInterest,
} from '@/features/contact/contact-interests';
import { refreshContactInterests } from '@/features/contact/contact-interests-cache';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import { getSiteSettings } from '@/features/settings/settings-api';
import { useTheme } from '@/features/theme/theme-context';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import { ApiError } from '@/services/api-client';
import type { SiteSettings } from '@/types/settings';
import {
  buildMailtoUrl,
  buildMapsUrl,
  buildTelUrl,
  buildWhatsAppUrls,
} from '@/utils/contact-links';
import { openFirstAvailable } from '@/utils/open-external-url';


type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export default function ContactScreen() {
  const { t, language } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { textAlign } = useDirection();
  const router = useRouter();
  const { user } = useAuth();

  const { interestType: interestTypeParam } = useLocalSearchParams<{ interestType?: string }>();

  const handleBack = () => {
    // Matches the other standalone screens: fall back to Home when opened
    // without history, e.g. from a notification or a deep link.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  /* ── Company details ──────────────────────────────────────────────── */

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [settingsState, setSettingsState] = useState<'loading' | 'success' | 'error'>('loading');

  const loadSettings = useCallback(async () => {
    setSettingsState('loading');
    try {
      setSettings(await getSiteSettings());
      setSettingsState('success');
    } catch {
      setSettingsState('error');
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  /* ── Form ─────────────────────────────────────────────────────────── */

  const [name, setName] = useState(() => user?.name ?? '');
  const [email, setEmail] = useState(() => user?.email ?? '');
  const [phone, setPhone] = useState('');

  /**
   * The interest options, never blocking the form:
   *
   *   1. the bundled built-in nine, on the very first render
   *   2. the last list the server sent, if one is cached on this device
   *   3. the server's current list, when GET /api/contact/interests answers
   *
   * Admins can add, reorder and disable interests at any time, so step 2 lets
   * a slow or offline start show recent options instead of the baseline. A
   * failure at any step leaves the previous list in place.
   */
  const [interests, setInterests] = useState<readonly ContactInterest[]>(FALLBACK_CONTACT_INTERESTS);

  /**
   * True once the server's contract has loaded — which also tells us the
   * backend is new enough to store `source: 'mobile'`. The interests endpoint
   * and that source value ship in the SAME backend deploy, so an older backend
   * 404s this request, this stays false, and the enquiry is sent exactly as it
   * always was. (The older route would reject an unrecognised source.)
   */
  const [interestsFromServer, setInterestsFromServer] = useState(false);

  useEffect(
    () =>
      refreshContactInterests((next, origin) => {
        setInterests(next);
        // Only a LIVE response proves the current backend stores
        // source: 'mobile'. A cached list could outlive a backend rollback.
        if (origin === 'server') setInterestsFromServer(true);
      }),
    []
  );

  /**
   * The chosen interest, as a KEY resolved against whichever list is current.
   *
   * It starts as the route's `interestType` — a stable id (service links) or a
   * legacy value (older links and shared URLs) — left unresolved, so an
   * admin-created interest this build has never seen is selected as soon as
   * the server list offers it. A chip press stores that chip's id.
   *
   * Resolving on every render also covers disabling: a key the current list no
   * longer offers selects General, so the form never submits a hidden option.
   */
  const [reasonKey, setReasonKey] = useState(() => requestedContactInterestKey(interestTypeParam));
  const selectedInterest = resolveContactInterest(interests, reasonKey);
  const [message, setMessage] = useState('');

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  /** Shown when the OS could not open a tel:/mailto:/wa.me link. */
  const [linkError, setLinkError] = useState('');

  const submitting = submitState === 'submitting';

  const handleSubmit = async () => {
    if (submitting) return;

    setErrorMessage('');

    const trimmed = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: message.trim(),
    };

    if (!trimmed.name || !trimmed.email || !trimmed.phone || !trimmed.message) {
      setSubmitState('error');
      setErrorMessage(t('contact.missingFields'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.email)) {
      setSubmitState('error');
      setErrorMessage(t('contact.invalidEmail'));
      return;
    }

    setSubmitState('submitting');
    try {
      await sendContactEnquiry({
        ...trimmed,
        // The entry's LEGACY value ('Interior Design') — never its id and never
        // the translated chip label. That literal is what POST /api/contact
        // validates, and what installed builds have always sent.
        interestType: selectedInterest.value,
        source: interestsFromServer ? 'mobile' : undefined,
      });
      setSubmitState('success');
    } catch (error) {
      /*
       * The typed message is deliberately NOT cleared. A failure here is most
       * often a flaky connection, and discarding what someone wrote is the
       * fastest way to lose the enquiry entirely.
       */
      setSubmitState('error');
      setErrorMessage(error instanceof ApiError ? error.message : t('contact.sendFailed'));
    }
  };

  /** Returns to an empty form after a success, for a second enquiry. */
  const handleSendAnother = () => {
    setMessage('');
    setPhone('');
    setReasonKey(requestedContactInterestKey(interestTypeParam));
    setSubmitState('idle');
    setErrorMessage('');
  };

  /* ── Derived links ────────────────────────────────────────────────── */

  const telUrl = buildTelUrl(settings?.phone);
  /*
   * Two candidates: the native `whatsapp://` deep link, then the `wa.me` web
   * link. ContactAction attempts them in order, so a phone WITH WhatsApp opens
   * straight into the chat and a phone without it lands on the install page.
   */
  const whatsappUrls = buildWhatsAppUrls(settings?.whatsapp);
  const mailtoUrl = buildMailtoUrl(settings?.email);
  const mapsUrl = buildMapsUrl(settings?.mapsUrl, settings?.address);
  const address = settings?.address?.trim() ?? '';

  /** Reports a link the OS refused, naming the value so it stays reachable. */
  const reportUnavailable = (value: string) =>
    setLinkError(t('contact.linkFailed', { value }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('contact.title')} onBack={handleBack} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* ── Intro ─────────────────────────────────────────────── */}
          <View style={styles.block}>
            <SectionHeader
              eyebrow={t('contact.eyebrow')}
              title={t('contact.heading')}
              size="lg"
              rule
            />
            <Text style={[styles.body, { textAlign }]}>{t('contact.intro')}</Text>
          </View>

          {/* ── Direct channels ───────────────────────────────────── */}
          <View style={styles.block}>
            <SectionHeader
              eyebrow={t('contact.reachUsEyebrow')}
              title={t('contact.reachUsHeading')}
              style={styles.blockHeader}
            />

            {settingsState === 'loading' ? (
              <View style={styles.inlineState}>
                <ActivityIndicator color={theme.primaryInk} />
              </View>
            ) : settingsState === 'error' ? (
              <View style={styles.inlineState}>
                <Text style={[styles.muted, { textAlign }]}>
                  {t('contact.detailsUnavailable')}
                </Text>
                <Pressable onPress={loadSettings} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.retry}>{t('common.retry')}</Text>
                </Pressable>
              </View>
            ) : (

              <View style={styles.actions}>
                {telUrl && settings?.phone ? (
                  <ContactAction
                    icon="call-outline"
                    label={t('contact.callLabel')}
                    value={settings.phone}
                    url={telUrl}
                    accessibilityLabel={t('contact.callA11y', { value: settings.phone })}
                    onUnavailable={() => reportUnavailable(settings.phone ?? '')}
                  />
                ) : null}

                {whatsappUrls.length > 0 && settings?.whatsapp ? (
                  <ContactAction
                    icon="logo-whatsapp"
                    label={t('contact.whatsappLabel')}
                    value={settings.whatsapp}
                    url={whatsappUrls}
                    accessibilityLabel={t('contact.whatsappA11y', { value: settings.whatsapp })}
                    onUnavailable={() => reportUnavailable(settings.whatsapp ?? '')}
                  />
                ) : null}

                {mailtoUrl && settings?.email ? (
                  <ContactAction
                    icon="mail-outline"
                    label={t('contact.emailLabel')}
                    value={settings.email}
                    url={mailtoUrl}
                    accessibilityLabel={t('contact.emailA11y', { value: settings.email })}
                    onUnavailable={() => reportUnavailable(settings.email ?? '')}
                  />
                ) : null}

                {linkError ? (
                  <Text
                    accessibilityRole="alert"
                    style={[styles.error, { textAlign }]}>
                    {linkError}
                  </Text>
                ) : null}
              </View>
            )}
          </View>

          {/* ── Office ────────────────────────────────────────────── */}
          {address ? (
            <View style={styles.block}>
              <SectionHeader
                eyebrow={t('contact.officeEyebrow')}
                title={t('contact.officeHeading')}
                style={styles.blockHeader}
              />

              <View style={styles.office}>
                <Text style={[styles.address, { textAlign }]}>{address}</Text>

                {mapsUrl ? (
                  <Button
                    label={t('contact.openInMaps')}
                    variant="secondary"
                    accessibilityHint={t('contact.openInMapsA11y')}
                    onPress={async () => {
                      // Same attempt-and-report shape as the rows above; see
                      // utils/open-external-url.ts for why nothing asks first.
                      const opened = await openFirstAvailable([mapsUrl]);
                      if (!opened) reportUnavailable(address);
                    }}
                    style={styles.officeAction}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          {/* ── Enquiry form ──────────────────────────────────────── */}
          <View style={styles.block}>
            <SectionHeader
              eyebrow={t('contact.formEyebrow')}
              title={t('contact.formHeading')}
              style={styles.blockHeader}
            />

            {submitState === 'success' ? (
              <View style={styles.success}>
                <Ionicons name="checkmark-circle" size={32} color={theme.primaryInk} />
                <Text style={[styles.successHeading, { textAlign }]}>
                  {t('contact.successHeading')}
                </Text>
                <Text style={[styles.body, { textAlign }]}>{t('contact.successBody')}</Text>
                <Button
                  label={t('contact.sendAnother')}
                  variant="secondary"
                  onPress={handleSendAnother}
                  style={styles.stretch}
                />
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={[styles.muted, { textAlign }]}>{t('contact.formIntro')}</Text>

                <TextField
                  label={t('contact.nameLabel')}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('contact.namePlaceholder')}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                />

                <TextField
                  label={t('contact.emailFieldLabel')}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('contact.emailPlaceholder')}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                />

                <TextField
                  label={t('contact.phoneFieldLabel')}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={t('contact.phonePlaceholder')}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                />

                {/* ── Reason ────────────────────────────────────── */}
                <View style={styles.reasons}>
                  <Text style={[styles.fieldLabel, { textAlign }]}>
                    {t('contact.reasonLabel')}
                  </Text>

                  
                  <View
                    style={styles.chips}
                    accessibilityRole="radiogroup"
                    accessibilityLabel={t('contact.reasonLabel')}>
                    {interests.map((interest) => {
                      const selected = interest.id === selectedInterest.id;
                      // The entry's own label for this language. Display only.
                      const label = contactInterestLabel(interest, language);

                      return (
                        <Pressable
                          key={interest.id}
                          onPress={() => setReasonKey(interest.id)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={t('contact.reasonA11y', { label })}
                          style={[styles.chip, selected && styles.chipSelected]}>
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <TextField
                  label={t('contact.messageLabel')}
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t('contact.messagePlaceholder')}
                  multiline
                  autoCapitalize="sentences"
                />

                {errorMessage ? (
                  <Text accessibilityRole="alert" style={[styles.error, { textAlign }]}>
                    {errorMessage}
                  </Text>
                ) : null}

                <Button
                  label={t('contact.send')}
                  loadingLabel={t('contact.sending')}
                  loading={submitting}
                  onPress={handleSubmit}
                  variant="primary"
                  style={styles.stretch}
                />
              </View>
            )}
          </View>

          {/* ── The other channel ─────────────────────────────────── */}
          <View style={styles.block}>
            <SectionHeader
              eyebrow={t('contact.propertyEyebrow')}
              title={t('contact.propertyHeading')}
              tone="muted"
              style={styles.blockHeader}
            />

            <View style={styles.propertyNote}>
              <Text style={[styles.body, { textAlign }]}>{t('contact.propertyBody')}</Text>

              <Button
                label={t('contact.browseProperties')}
                variant="secondary"
                onPress={() => router.push('/properties')}
                style={styles.stretch}
              />

              {/*
                Stated up front rather than discovered at the login wall. The
                Message Agent button itself already routes to /login when
                needed; this only removes the surprise.
              */}
              <Text style={[styles.note, { textAlign }]}>
                {t('contact.propertySignInNote')}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.softWhite },
  flex: { flex: 1 },
  scroll: { paddingBottom: Spacing.xxl },

  block: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  /** SectionHeader owns no outer spacing, so the gap belongs to the caller. */
  blockHeader: { marginBottom: Spacing.lg },

  body: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.text,
  },
  muted: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
  },
  note: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    color: theme.textMuted,
  },
  error: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    color: theme.danger,
  },
  retry: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.primaryInk,
  },

  inlineState: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  actions: { gap: Spacing.sm },

  office: { gap: Spacing.md },
  address: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.text,
  },
  officeAction: { alignSelf: 'stretch' },

  form: { gap: Spacing.md },
  fieldLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.sm,
    color: theme.text,
  },
  reasons: { gap: Spacing.sm },

  /**
   * The chip language already used by the saved-alert editor
   * (notifications/alerts/edit.tsx) — same pill, same selected treatment, so
   * choosing a contact reason feels like choosing an alert filter.
   */
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardBg,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: theme.brandGreen, borderColor: theme.brandGreen },
  chipText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.text,
  },
  chipTextSelected: { fontFamily: FontFamily.bodySemiBold, color: theme.primaryText },

  stretch: { alignSelf: 'stretch' },

  success: {
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  successHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.md,
    color: theme.text,
  },

  propertyNote: { gap: Spacing.md },
});
