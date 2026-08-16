import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import { Colors, FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { getPropertyConversations } from '@/features/property-messaging/property-messaging-api';
import { ApiError } from '@/services/api-client';
import type { PropertyConversationSummary } from '@/types/property-messaging';
import { formatChatTime } from '@/utils/format-chat-time';



type LoadState = 'loading' | 'success' | 'error';

type LoadMode = 'initial' | 'refresh' | 'silent';

export default function ChatsScreen() {
  const router = useRouter();
  const { user, token, status } = useAuth();

  const [conversations, setConversations] = useState<PropertyConversationSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  /** Generation counter: a superseded response can never overwrite a newer one. */
  const requestRef = useRef(0);
  /** Whether a first successful load has happened, so focus can go silent. */
  const hasLoadedRef = useRef(false);

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
          error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
        );
        // A failed refresh keeps the chats already on screen rather than
        // replacing a working list with an error — the same rule the
        // Properties tab uses.
        if (mode === 'initial') setLoadState('error');
      } finally {
        setRefreshing(false);
      }
    },
    [token]
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>

      {status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.brandGreen} />
        </View>
      ) : status !== 'authenticated' ? (
        <SignInGate
          onLogin={() => router.push('/login')}
          onRegister={() => router.push('/register')}
        />
      ) : loadState === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.brandGreen} />
        </View>
      ) : loadState === 'error' ? (
        <View style={styles.centered}>
          <Text style={styles.stateHeading}>Unable to load chats</Text>
          <Text style={styles.stateBody}>{errorMessage}</Text>
          <Button
            label="Try Again"
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
              tintColor={Colors.brandGreen}
              colors={[Colors.brandGreen]}
            />
          }
          renderItem={({ item }) => (
            <ChatRow
              conversation={item}
              currentUserId={user?._id ?? null}
              onPress={() => router.push({ pathname: '/messages/[id]', params: { id: item._id } })}
            />
          )}
          // Only reachable on a genuinely empty inbox — loading and error are
          // handled above, so no chats never reads as a failure.
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={28} color={Colors.brandGreen} />
              </View>
              <Text style={styles.stateHeading}>No chats yet</Text>
              <Text style={styles.stateBody}>
                When you message an agent about a property, your conversation will appear here.
              </Text>
              <Button
                label="Browse Properties"
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
  return (
    <View style={styles.centered}>
      <View style={styles.emptyIcon}>
        <Ionicons name="chatbubbles-outline" size={28} color={Colors.brandGreen} />
      </View>

      <Text style={styles.gateEyebrow}>Stay in touch</Text>
      <Text style={styles.stateHeading}>Message our agents directly</Text>
      <Text style={styles.stateBody}>
        Sign in to ask about a property and keep every conversation in one place.
      </Text>

      {/* Reuses the existing auth routes — no duplicate auth UI. */}
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

          {isClosed ? <Text style={styles.closedTag}>Closed</Text> : null}

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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.softWhite },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: Colors.charcoal,
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
    backgroundColor: Colors.marble,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  gateEyebrow: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    color: Colors.brandGreen,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  gateActions: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.lg },
  stateHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: FontSizes.lg,
    color: Colors.charcoal,
    textAlign: 'center',
  },
  stateBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  rowPressed: { borderColor: Colors.brandGreen, backgroundColor: Colors.marble },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: Colors.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.md,
    color: Colors.textOnDark,
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
    color: Colors.charcoal,
  },
  // Unread emphasis stays restrained: a weight and colour shift, no highlight
  // block. This is a Varlikent surface, not a WhatsApp reproduction.
  agentNameUnread: { fontFamily: FontFamily.bodySemiBold },
  time: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  timeUnread: { color: Colors.brandGreen, fontFamily: FontFamily.bodyMedium },

  propertyTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
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
    color: Colors.textMuted,
  },
  previewUnread: { fontFamily: FontFamily.bodyMedium, color: Colors.charcoal },

  closedTag: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },

  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    backgroundColor: Colors.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.textOnDark,
  },
});
