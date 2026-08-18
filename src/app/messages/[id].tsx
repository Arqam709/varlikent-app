import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import { useAuth } from '@/features/auth/auth-context';
import {
  getPropertyConversation,
  getPropertyMessages,
  markPropertyConversationRead,
  sendPropertyMessage,
} from '@/features/property-messaging/property-messaging-api';
import { useRealtime } from '@/features/realtime/realtime-context';
import { useRecoveryReconcile } from '@/features/realtime/use-recovery-reconcile';
import { ApiError } from '@/services/api-client';
import {
  MAX_MESSAGE_LENGTH,
  PROPERTY_MESSAGE_NEW_EVENT,
  type PropertyConversationDetail,
  type PropertyMessage,
  type PropertyMessageNewEvent,
} from '@/types/property-messaging';
import { appendUniqueMessage } from '@/utils/append-unique-message';
import { formatPrice } from '@/utils/format-price';
import { applyRecovery, collectRecoveryPages } from '@/utils/recover-thread-messages';


type LoadState = 'loading' | 'success' | 'error';

/** How many messages a page requests. The backend caps this at 50. */
const PAGE_SIZE = 30;

export default function ConversationScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, token, status } = useAuth();
  const realtime = useRealtime();

  const [conversation, setConversation] = useState<PropertyConversationDetail | null>(null);
  const [messages, setMessages] = useState<PropertyMessage[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const listRef = useRef<FlatList<PropertyMessage>>(null);

  const shouldScrollToEnd = useRef(true);

  /**
   * The current messages, readable without being a dependency.
   *
   * Recovery needs to know what is already loaded, but listing `messages` in
   * reconcileMessages' dependencies would change its identity on every message —
   * and useRecoveryReconcile keys its effect on that identity, so it would
   * reconcile after every message instead of after every reconnect.
   */
  /**
   * Latest `t`, read without being a dependency.
   *
   * `load` builds one user-facing fallback string, but listing `t` in its
   * dependencies would rebuild `load` on every language change — and the effect
   * that owns it would then re-fetch the thread and re-issue mark-read. This is
   * an RT-1/RT-3 screen, so its fetch behaviour must not change; a ref gives the
   * current translation without touching identity.
   */
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const messagesRef = useRef<PropertyMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    // iOS fires the `Will` pair early enough to animate with the keyboard;
    // Android only reliably emits the `Did` pair.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  /** Clear the nav bar when it is visible; sit on the keyboard when it is not. */
  const bottomInset = keyboardVisible ? 0 : insets.bottom;

  const load = useCallback(async () => {
    if (!id || !token) return;

    setLoadState('loading');
    try {
      const [detail, page] = await Promise.all([
        getPropertyConversation(token, id),
        getPropertyMessages(token, id, { limit: PAGE_SIZE }),
      ]);

      setConversation(detail);
      setMessages(page.messages);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setLoadState('success');

      // Opening a thread should land on the newest message.
      shouldScrollToEnd.current = true;

      markPropertyConversationRead(token, id).catch(() => {});
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : tRef.current('common.somethingWentWrong')
      );
      setLoadState('error');
    }
  }, [id, token]);

  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  /*
   * Live messages for THIS conversation.
   *
   * The socket is a notification channel only — nothing is ever sent through
   * it. Sending still goes through POST /:id/messages exactly as before, and
   * this screen works completely without a socket: if the connection is down
   * (or the Render free instance is asleep), the thread behaves the way it did
   * before RT-1 and new messages appear on the next open.
   *
   * ── Why the socket is read inside the effect ────────────────────────────
   * RealtimeProvider keeps the socket in a REF, which deliberately does not
   * trigger a render. `isConnected` is the state that does, so it drives this
   * effect: when the handshake completes the effect re-runs and subscribes.
   * This screen very often mounts before the socket is ready — reading the ref
   * once during the first render would silently subscribe to nothing.
   *
   * The instance is captured in a local const so cleanup calls .off() on
   * exactly the object and handler that .on() was called with, even if the ref
   * has since been repointed or cleared by a sign-out.
   *
   * Gated on loadState === 'success' so an event cannot append to a list the
   * initial fetch is about to replace wholesale.
   */
  useEffect(() => {
    const socket = realtime?.socket?.current;
    if (!socket || loadState !== 'success' || !id) return undefined;

    const handleNewMessage = (payload: PropertyMessageNewEvent) => {
      // One event serves every conversation this customer is part of, so a
      // mismatched payload is expected traffic rather than an error. Messages
      // for other threads are ignored here; the Chats inbox is RT-2.
      if (!payload || payload.conversationId !== id) return;

      const incoming = payload.message;
      if (!incoming?._id) return;

      // Deduped by server id: the sender also receives its own message here,
      // and this event can beat the POST response. See appendUniqueMessage.
      setMessages((current) => appendUniqueMessage(current, incoming));

      // Reuses the existing one-shot scroll intent, consumed by
      // onContentSizeChange — the same mechanism a sent message uses.
      shouldScrollToEnd.current = true;

      /*
       * The customer is looking at this exact thread, so they have genuinely
       * read it — but the server incremented customerUnreadCount when it stored
       * the message. Clear it through the EXISTING REST route.
       *
       * Only for the AGENT'S messages: the customer also receives their own
       * sends back on this event (that is what keeps a second signed-in device
       * in step), and marking read because of your own message would be a
       * pointless write. The endpoint is idempotent ($set to 0, never a
       * decrement), so a burst costs a few harmless repeat calls rather than
       * needing new read-state machinery.
       *
       * This clears only the CUSTOMER'S OWN counter. Nothing is sent to the
       * agent — RT-1 has no read receipts.
       */
      if (token && user?._id && incoming.sender !== user._id) {
        markPropertyConversationRead(token, id).catch(() => {});
      }
    };

    socket.on(PROPERTY_MESSAGE_NEW_EVENT, handleNewMessage);

    return () => {
      // Same instance, same function reference — so navigating between threads
      // cannot leave a previous screen's handler behind and run one event twice.
      socket.off(PROPERTY_MESSAGE_NEW_EVENT, handleNewMessage);
    };
  }, [realtime, realtime?.isConnected, id, token, user?._id, loadState]);

  /*
   * Recover this thread's messages after a reconnect or a foreground.
   *
   * The Chats reconciliation cannot do this: it refreshes conversation ROWS and
   * knows nothing about the message list on screen. So the thread repairs itself.
   *
   * Silent — `loadState` is never touched, so the conversation stays readable
   * throughout and a failure leaves the existing bubbles alone.
   */
  const reconcileMessages = useCallback(async () => {
    if (!token || !id) return;

    const recovery = await collectRecoveryPages({
      current: messagesRef.current,
      fetchPage: ({ before }) =>
        getPropertyMessages(token, id, { before, limit: PAGE_SIZE }),
    });

    if (recovery.messages.length === 0) return;

    let appliedNew = false;

    setMessages((current) => {
      const { messages: next } = applyRecovery(current, recovery);
      appliedNew = next.length !== current.length;
      return next;
    });

    /*
     * Only adopt the fetched cursor when the recovered block could NOT be bridged
     * to local history — otherwise the existing cursor is still correct, because
     * recovery only ever adds messages NEWER than the oldest one already loaded.
     * Overwriting it would make "Load older" re-fetch history the customer
     * already has, or skip past it.
     */
    if (!recovery.contiguous) {
      setCursor(recovery.nextCursor);
      setHasMore(recovery.hasMore);
    }

    if (appliedNew) {
      // Reuses the existing one-shot scroll intent.
      shouldScrollToEnd.current = true;

      /*
       * The customer has this thread OPEN, so recovered agent messages have
       * genuinely been seen — clear the server counter through the existing
       * route. This is why an open thread settles to 0 on foreground while an
       * unrelated conversation stays unread: only the thread actually on screen
       * marks itself read. Nothing is sent to the agent; still no read receipts.
       */
      const fromOther = recovery.messages.some((message) => message.sender !== user?._id);
      if (fromOther) {
        markPropertyConversationRead(token, id).catch(() => {});
      }
    }
  }, [token, id, user?._id]);

  useRecoveryReconcile(
    // Only reconcile a thread that has actually finished loading.
    loadState === 'success' ? realtime?.recoveryVersion ?? 0 : 0,
    reconcileMessages
  );

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const handleLoadOlder = async () => {
    if (!token || !id || !cursor || loadingOlder) return;

    setLoadingOlder(true);
    try {
      const page = await getPropertyMessages(token, id, { before: cursor, limit: PAGE_SIZE });

      setMessages((current) => {
        const seen = new Set(current.map((message) => message._id));
        const older = page.messages.filter((message) => !seen.has(message._id));
        return [...older, ...current];
      });

      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!token || !id || !text || sending) return;

    setSending(true);
    setSendError(null);
    try {
      const saved = await sendPropertyMessage(token, id, text);
      /*
       * Deduped, because the socket copy of this very message may ALREADY be in
       * state — property-message:new is emitted the moment the write commits,
       * which routinely beats this POST response back to the device.
       *
       * A blind [...current, saved] here was the duplicate-key bug: the socket
       * handler appended it, then this line appended it again, and FlatList saw
       * two children with the same `_id`.
       */
      setMessages((current) => appendUniqueMessage(current, saved));
      setDraft('');

      // Your own message should always be brought into view.
      shouldScrollToEnd.current = true;
    } catch (error) {
      // The typed text stays in the box. Discarding what someone wrote because
      // a request failed is the worst possible response to a failure.
      setSendError(
        error instanceof ApiError ? error.message : t('messageThread.sendFailed')
      );
    } finally {
      setSending(false);
    }
  };

  const isClosed = conversation?.status === 'closed';
  const canSend = draft.trim().length > 0 && !sending && !isClosed;
  const counterpartyName = conversation?.counterparty?.name || 'Agent';

  /* ── Auth gate ─────────────────────────────────────────────────────── */

  if (status === 'unauthenticated') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Message" subtitle="" onBack={handleBack} />
        <View style={[styles.centered, { paddingBottom: insets.bottom }]}>
          <Text style={styles.stateHeading}>{t('messageThread.signInTitle')}</Text>
          <Text style={styles.stateBody}>{t('messageThread.signInBody')}</Text>
          <Button
            label={t('common.signIn')}
            variant="primary"
            onPress={() => router.push('/login')}
            style={styles.stateAction}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header
        title={loadState === 'success' ? counterpartyName : 'Message'}
        subtitle={loadState === 'success' ? 'Agent' : ''}
        onBack={handleBack}
      />

      {loadState === 'loading' ? (
        <View style={[styles.centered, { paddingBottom: insets.bottom }]}>
          <ActivityIndicator color={theme.brandGreen} />
        </View>
      ) : loadState === 'error' ? (
        <View style={[styles.centered, { paddingBottom: insets.bottom }]}>
          <Text style={styles.stateHeading}>{t('messageThread.loadError')}</Text>
          <Text style={styles.stateBody}>{errorMessage}</Text>
          <Button label={t('common.retry')} variant="primary" onPress={load} style={styles.stateAction} />
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(message) => message._id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <>
                <PropertyCard property={conversation?.property ?? null} />
                {hasMore ? (
                  <Pressable
                    onPress={handleLoadOlder}
                    disabled={loadingOlder}
                    accessibilityRole="button"
                    accessibilityLabel={t('messageThread.loadOlder')}
                    accessibilityState={{ disabled: loadingOlder, busy: loadingOlder }}
                    style={styles.loadOlder}>
                    {loadingOlder ? (
                      <ActivityIndicator size="small" color={theme.brandGreen} />
                    ) : (
                      <Text style={styles.loadOlderText}>{t('messageThread.loadOlder')}</Text>
                    )}
                  </Pressable>
                ) : null}
              </>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  Start a conversation with {counterpartyName} about this property.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <MessageBubble message={item} mine={item.sender === user?._id} />
            )}
            onContentSizeChange={() => {
              if (!shouldScrollToEnd.current) return;
              shouldScrollToEnd.current = false;
              listRef.current?.scrollToEnd({ animated: false });
            }}
          />

          {isClosed ? (
            <View style={[styles.closedNotice, { paddingBottom: Spacing.md + bottomInset }]}>
              <Text style={styles.closedText}>
                This conversation is currently closed.
              </Text>
            </View>
          ) : (
            <View style={[styles.composer, { paddingBottom: Spacing.sm + bottomInset }]}>
              {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
              <View style={styles.composerRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t('messageThread.compose')}
                  placeholderTextColor={theme.textMuted}
                  style={styles.input}
                  multiline
                  // Mirrors the server's cap so the limit is felt while typing
                  // rather than discovered as a 400 after pressing send.
                  maxLength={MAX_MESSAGE_LENGTH}
                  editable={!sending}
                />
                <Pressable
                  onPress={handleSend}
                  disabled={!canSend}
                  accessibilityRole="button"
                  accessibilityLabel={t('messageThread.send')}
                  accessibilityState={{ disabled: !canSend, busy: sending }}
                  style={({ pressed }) => [
                    styles.sendButton,
                    !canSend && styles.sendButtonBlocked,
                    pressed && canSend && styles.sendButtonPressed,
                  ]}>
                  {sending ? (
                    <ActivityIndicator size="small" color={theme.textOnDark} />
                  ) : (
                    <Ionicons name="send" size={18} color={theme.textOnDark} />
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

/* ─────────────────────────── Pieces ─────────────────────────── */

function Header({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        hitSlop={10}
        style={styles.backButton}>
        <Ionicons name="chevron-back" size={22} color={theme.charcoal} />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function PropertyCard({
  property,
}: {
  property: PropertyConversationDetail['property'];
}) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  if (!property) {
    return (
      <View style={styles.propertyCard}>
        <Text style={styles.propertyUnavailable}>{t('messageThread.listingGone')}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/properties/[id]', params: { id: property._id } })}
      accessibilityRole="button"
      accessibilityLabel={`View property: ${property.title}`}
      style={({ pressed }) => [styles.propertyCard, pressed && styles.propertyCardPressed]}>
      <Text style={styles.propertyTitle} numberOfLines={2}>
        {property.title}
      </Text>
      <Text style={styles.propertyMeta}>
        {property.district} · {property.listingType === 'Rent' ? 'For Rent' : 'For Sale'}
      </Text>
      <Text style={styles.propertyPrice}>
        {formatPrice(property.price, property.listingType, property.priceLabel)}
      </Text>
      <Text style={styles.propertyLink}>View Property ›</Text>
    </Pressable>
  );
}

function MessageBubble({ message, mine }: { message: PropertyMessage; mine: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.text}</Text>
        <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
          {formatMessageTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  return sameDay ? clock : `${date.getDate()} ${MONTHS[date.getMonth()]}, ${clock}`;
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.softWhite },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: { padding: Spacing.xs },
  headerText: { flex: 1 },
  headerTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.md,
    color: theme.charcoal,
  },
  headerSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
  },

  list: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    flexGrow: 1,
  },

  propertyCard: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardBg,
    gap: 2,
  },
  propertyCardPressed: { backgroundColor: theme.marble },
  propertyTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.sm,
    color: theme.charcoal,
  },
  propertyMeta: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
  },
  propertyPrice: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.md,
    color: theme.navy,
    marginTop: 2,
  },
  propertyLink: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.xs,
    color: theme.brandGreen,
    marginTop: Spacing.xs,
  },
  propertyUnavailable: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.textMuted,
  },

  loadOlder: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  loadOlderText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.xs,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.brandGreen,
  },

  empty: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
    textAlign: 'center',
  },

  bubbleRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
  },
  bubbleMine: { backgroundColor: theme.brandGreen },
  bubbleTheirs: {
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  bubbleText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    color: theme.charcoal,
  },
  bubbleTextMine: { color: theme.textOnDark },
  bubbleTime: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },

  composer: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.navBg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    // paddingBottom is applied inline: Spacing.sm + the safe-area inset, with
    // the inset dropped while the keyboard covers the navigation bar.
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.softWhite,
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.charcoal,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonPressed: { backgroundColor: theme.primaryPressed },
  sendButtonBlocked: { opacity: 0.4 },
  sendError: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.danger,
    marginBottom: Spacing.sm,
  },

  closedNotice: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.marble,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    // paddingBottom applied inline, same reasoning as the composer.
  },
  closedText: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.textMuted,
    textAlign: 'center',
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  stateHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.charcoal,
    textAlign: 'center',
  },
  stateBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.textMuted,
    textAlign: 'center',
  },
  stateAction: { marginTop: Spacing.md, alignSelf: 'stretch' },
});
