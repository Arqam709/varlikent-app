import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/features/localization/language-context';
import { useTheme } from '@/features/theme/theme-context';
import { useThemedStyles } from '@/features/theme/use-themed-styles';
import type { ThemePalette } from '@/features/theme/themes';
import { useAuth } from '@/features/auth/auth-context';
import { getPropertyConversations } from '@/features/property-messaging/property-messaging-api';
import { useRealtime } from '@/features/realtime/realtime-context';
import { ApiError } from '@/services/api-client';
import {
  PROPERTY_MESSAGE_NEW_EVENT,
  type PropertyConversationSummary,
  type PropertyMessageNewEvent,
} from '@/types/property-messaging';
import { applyMessageEventToConversations } from '@/utils/apply-message-event';
import { formatChatTime } from '@/utils/format-chat-time';



type LoadState = 'loading' | 'success' | 'error';

type LoadMode = 'initial' | 'refresh' | 'silent';

export default function ChatsScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const router = useRouter();
  const { user, token, status } = useAuth();
  const realtime = useRealtime();

  const [conversations, setConversations] = useState<PropertyConversationSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  /** Generation counter: a superseded response can never overwrite a newer one. */
  const requestRef = useRef(0);
  /** Whether a first successful load has happened, so focus can go silent. */
  const hasLoadedRef = useRef(false);
  /**
   * In-flight guard for the unknown-conversation refetch, so a burst of events
   * for conversations this inbox has not loaded collapses into one GET rather
   * than one per message.
   */
  const unknownRefetchRef = useRef(false);

  const load = useCallback(
    async (mode: LoadMode) => {
      if (!token) return;

      const requestId = ++requestRef.current;

      if (mode === 'initial') setLoadState('loading');
      if (mode === 'refresh') setRefreshing(true);

      try {
        const list = await getPropertyConversations(token);
        if (requestId !== requestRef.current) return;

        setConversations(list);
        setLoadState('success');
        setErrorMessage('');
        hasLoadedRef.current = true;
      } catch (error) {
        if (requestId !== requestRef.current) return;

        setErrorMessage(
          error instanceof ApiError ? error.message : t('common.somethingWentWrong')
        );
        // A failed refresh keeps the chats already on screen rather than
        // replacing a working list with an error — the same rule the
        // Properties tab uses.
        if (mode === 'initial') setLoadState('error');
      } finally {
        setRefreshing(false);
      }
    },
    // `t` is listed because the catch block builds a user-facing message;
    // without it a failure would keep the language active at definition time.
    [token, t]
  );

  useFocusEffect(
    useCallback(() => {
      if (status !== 'authenticated' || !token) {
        // Signing out must not leave the previous account's chats on screen.
        requestRef.current++;
        setConversations([]);
        hasLoadedRef.current = false;
        return;
      }

      load(hasLoadedRef.current ? 'silent' : 'initial');

      // Invalidates anything still in flight when the tab loses focus.
      return () => {
        requestRef.current++;
      };
    }, [status, token, load])
  );

  useFocusEffect(
    useCallback(() => {
      const socket = realtime?.socket?.current;
      if (!socket || status !== 'authenticated') return undefined;

      const handleNewMessage = (payload: PropertyMessageNewEvent) => {
        if (!payload?.conversationId) return;

        setConversations((current) => {
          const { conversations, unknown } = applyMessageEventToConversations(current, payload, {
            currentUserId: user?._id ?? null,
          
          });

          if (unknown) {
            if (!unknownRefetchRef.current) {
              unknownRefetchRef.current = true;
              load('silent').finally(() => {
                unknownRefetchRef.current = false;
              });
            }
            return current;
          }

          return conversations;
        });
      };

      socket.on(PROPERTY_MESSAGE_NEW_EVENT, handleNewMessage);

      return () => {
        // Only this screen's own handler. Never removeAllListeners — the open
        // thread subscribes to the same event and would lose its subscription.
        socket.off(PROPERTY_MESSAGE_NEW_EVENT, handleNewMessage);
      };
    }, [realtime, realtime?.isConnected, status, user?._id, load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('tabs.chats')}</Text>
      </View>

      {status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.brandGreen} />
        </View>
      ) : status !== 'authenticated' ? (
        <SignInGate
          onLogin={() => router.push('/login')}
          onRegister={() => router.push('/register')}
        />
      ) : loadState === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.brandGreen} />
        </View>
      ) : loadState === 'error' ? (
        <View style={styles.centered}>
          <Text style={styles.stateHeading}>{t('chats.loadError')}</Text>
          <Text style={styles.stateBody}>{errorMessage}</Text>
          <Button
            label={t("common.retry")}
            variant="primary"
            onPress={() => load('initial')}
            style={styles.stretch}
          />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={theme.brandGreen}
              colors={[theme.brandGreen]}
            />
          }
          renderItem={({ item }) => (
            <ChatRow
              conversation={item}
              currentUserId={user?._id ?? null}
              onPress={() => router.push({ pathname: '/messages/[id]', params: { id: item._id } })}
            />
          )}
          
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={28} color={theme.brandGreen} />
              </View>
              <Text style={styles.stateHeading}>{t('chats.emptyTitle')}</Text>
              <Text style={styles.stateBody}>
                {t('chats.emptyBody')}
              </Text>
              <Button
                label={t("chats.browseProperties")}
                variant="secondary"
                onPress={() => router.push('/properties')}
                style={styles.stretch}
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

/* ─────────────────────── Logged-out gate ─────────────────────── */

function SignInGate({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  return (
    <View style={styles.centered}>
      <View style={styles.emptyIcon}>
        <Ionicons name="chatbubbles-outline" size={28} color={theme.brandGreen} />
      </View>

      <Text style={styles.gateEyebrow}>{t('chats.gateEyebrow')}</Text>
      <Text style={styles.stateHeading}>{t('chats.gateTitle')}</Text>
      <Text style={styles.stateBody}>
        Sign in to ask about a property and keep every conversation in one place.
      </Text>

    
      <View style={styles.gateActions}>
        <Button label="Log In" variant="primary" onPress={onLogin} />
        <Button label="Create Account" variant="secondary" onPress={onRegister} />
      </View>
    </View>
  );
}

/* ─────────────────────── Chat row ─────────────────────── */

/** "John Smith" → JS · "john" → J. Falls back to the messaging icon's stead. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
  return initials || 'A';
}

function ChatRow({
  conversation,
  currentUserId,
  onPress,
}: {
  conversation: PropertyConversationSummary;
  /** The signed-in customer, for deciding whose message the preview shows. */
  currentUserId: string | null;
  onPress: () => void;
}) {
  const { t } = useLanguage();
  const styles = useThemedStyles(makeStyles);
  // The server already resolved "the other person" — for a customer that is
  // the agent. The participant serializer is privacy-minimal: name and avatar
  // only, no email or phone, and there is no professional title in V1.
  const agentName = conversation.counterparty?.name?.trim() || 'Agent';

  // A conversation can outlive its listing, which is hard-deleted.
  const propertyTitle = conversation.property?.title?.trim() || 'Listing no longer available';

  const avatar = conversation.counterparty?.avatar?.trim();
  const unread = conversation.unreadCount > 0;
  const isClosed = conversation.status === 'closed';

  const lastMessage = conversation.lastMessage;
  const sentByMe = Boolean(
    lastMessage?.sender && currentUserId && lastMessage.sender === currentUserId
  );
  const preview = lastMessage?.text?.trim()
    ? `${sentByMe ? 'You: ' : ''}${lastMessage.text.trim()}`
    : '';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        `Chat with ${agentName} about ${propertyTitle}.` +
        (preview ? ` Latest message: ${preview}.` : '') +
        (unread ? ` ${conversation.unreadCount} unread.` : '')
      }
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.avatar}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatarImage} contentFit="cover" transition={150} />
        ) : (
          <Text style={styles.avatarInitials}>{initialsOf(agentName)}</Text>
        )}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.agentName, unread && styles.agentNameUnread]} numberOfLines={1}>
            {agentName}
          </Text>
          <Text style={[styles.time, unread && styles.timeUnread]}>
            {formatChatTime(conversation.lastActivityAt)}
          </Text>
        </View>

        <Text style={styles.propertyTitle} numberOfLines={1}>
          {propertyTitle}
        </Text>

        <View style={styles.rowBottom}>
          {preview ? (
            <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
              {preview}
            </Text>
          ) : (
            // Unreachable in practice — the backend hides conversations with
            // no messages from every inbox — but a row must never render blank.
            <Text style={styles.preview} numberOfLines={1}>
              Tap to open this conversation
            </Text>
          )}

          {isClosed ? <Text style={styles.closedTag}>{t('chats.closed')}</Text> : null}

          {/* The server's own per-caller count. Never recomputed from history. */}
          {unread ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.softWhite },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: theme.charcoal,
  },

  list: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  stretch: { alignSelf: 'stretch', marginTop: Spacing.md },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    backgroundColor: theme.marble,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  gateEyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: theme.brandGreen,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  gateActions: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.lg },
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

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  rowPressed: { borderColor: theme.brandGreen, backgroundColor: theme.marble },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: theme.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.md,
    color: theme.textOnDark,
  },

  /** `flex: 1` lets long titles wrap instead of pushing the row wider. */
  rowBody: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  agentName: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.md,
    color: theme.charcoal,
  },
  // Unread emphasis stays restrained: a weight and colour shift, no highlight
  // block. This is a Varlikent surface, not a WhatsApp reproduction.
  agentNameUnread: { fontFamily: FontFamily.bodySemiBold },
  time: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
  },
  timeUnread: { color: theme.brandGreen, fontFamily: FontFamily.bodyMedium },

  propertyTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
    marginTop: 2,
  },

  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  preview: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.textMuted,
  },
  previewUnread: { fontFamily: FontFamily.bodyMedium, color: theme.charcoal },

  closedTag: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.textMuted,
  },

  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    backgroundColor: theme.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.xs,
    color: theme.textOnDark,
  },
});
