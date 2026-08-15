import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EmptyState, Screen, Skeleton, Text } from '@/components/ui';
import { ChatHeader } from '@/components/chat-header';
import { ConsentBanner } from '@/components/chat-consent';
import { LoadFailed } from '@/components/load-failed';
import { MessageActions } from '@/components/message-actions';
import { MessageBubble } from '@/components/message-bubble';
import { MessageComposer } from '@/components/message-composer';
import { SafetyActions } from '@/components/safety-actions';
import {
  useChatRealtime,
  useMarkThread,
  useMessages,
  useSendMessage,
  useSetReaction,
  useUnsendMessage,
  type ChatMessage,
} from '@/hooks/use-chat';
import { useChatConsentRealtime, useConsentStatus } from '@/hooks/use-chat-consent';
import { useThread, useThreads } from '@/hooks/use-threads';
import { useSession } from '@/hooks/use-session';
import { setActiveChat } from '@/lib/active-chat';
import { ALREADY_READ, RATE_LIMITED, unsafeTextCategory } from '@/lib/db-errors';
import { formatDayLabel } from '@/lib/format';
import { isReactionCode, type ReactionCode } from '@/lib/reactions';
import { checkMessage } from '@/lib/text-safety';

type Item =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; key: string; message: ChatMessage };

// Uneven widths and both sides, because a column of identical blocks reads as a
// broken screen rather than as a conversation that has not arrived yet.
const PLACEHOLDER_BUBBLES = [
  { mine: false, width: 'w-2/3' },
  { mine: true, width: 'w-1/2' },
  { mine: false, width: 'w-3/4' },
  { mine: true, width: 'w-2/5' },
  { mine: false, width: 'w-3/5' },
] as const;

// Newest first, because the list renders inverted so the keyboard pushes the
// conversation up rather than covering it.
function buildItems(messages: ChatMessage[]): Item[] {
  const items: Item[] = [];
  let lastDay = '';

  for (const message of messages) {
    const sentAt = new Date(message.created_at);
    const day = sentAt.toDateString();

    if (day !== lastDay) {
      items.push({ kind: 'day', key: `day-${day}`, label: formatDayLabel(sentAt) });
      lastDay = day;
    }

    items.push({ kind: 'message', key: message.id, message });
  }

  return items.reverse();
}

function ChatSkeleton() {
  const { t } = useTranslation();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      aria-busy
      className="flex-1 gap-4"
    >
      <View className="flex-row items-center gap-3 border-b border-border pb-3">
        <Skeleton shape="avatar" />

        <View className="flex-1 gap-2">
          <Skeleton shape="line" className="w-1/3" />
          <Skeleton shape="caption" className="w-1/2" />
        </View>
      </View>

      <View className="gap-3">
        {PLACEHOLDER_BUBBLES.map((bubble, index) => (
          <View key={index} className={bubble.mine ? 'items-end' : 'items-start'}>
            <Skeleton shape="bubble" className={bubble.width} />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id ?? '';

  const { data: session } = useSession();
  const userId = session?.user.id;

  const threads = useThreads();
  const thread = useThread(matchId);
  const { data: messages, isPending, isError, isFetching, refetch } = useMessages(matchId);

  useChatRealtime(matchId);
  useChatConsentRealtime(matchId);

  // So the notification handler can tell that a message arriving here is
  // already on screen. Focus rather than mount, because the screen stays
  // mounted underneath a profile pushed on top of it, and a notification is
  // worth showing then.
  useFocusEffect(
    useCallback(() => {
      setActiveChat(matchId);

      return () => setActiveChat(null);
    }, [matchId]),
  );

  const { explicitAllowed } = useConsentStatus(matchId);
  const send = useSendMessage(matchId);
  const unsend = useUnsendMessage(matchId);
  const react = useSetReaction(matchId);
  const mark = useMarkThread(matchId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);

  const items = useMemo(() => buildItems(messages ?? []), [messages]);

  const unreadCount = (messages ?? []).filter(
    (message) => message.sender_id !== userId && message.read_at === null,
  ).length;

  const markThread = mark.mutate;

  useEffect(() => {
    if (unreadCount > 0) {
      markThread('read');
    }
  }, [unreadCount, markThread]);

  if (threads.isPending || isPending) {
    return (
      <Screen className="flex-1 pt-2">
        <ChatSkeleton />
      </Screen>
    );
  }

  // Before anything that reads the data. A failed thread read leaves no thread
  // to find, which used to redirect as though the match had been unmatched, and
  // a failed message read left the conversation looking empty.
  if (threads.isError || isError) {
    return (
      <LoadFailed
        retrying={threads.isFetching || isFetching}
        onRetry={() => {
          void threads.refetch();
          void refetch();
        }}
      />
    );
  }

  if (!thread) {
    return <Redirect href="/matches" />;
  }

  const name = thread.other_deleted ? t('chat.deleted_account') : thread.other_name;
  const closed = thread.unmatched || thread.other_deleted;

  const selected = (messages ?? []).find((message) => message.id === selectedId);
  const selectedMine = selected?.sender_id === userId;

  const myReaction = selected?.message_reactions.find(
    (reaction) => reaction.user_id === userId,
  )?.reaction;

  const sendError = () => {
    if (!send.isError) {
      return undefined;
    }

    if (send.error.message === RATE_LIMITED) {
      return t('chat.rate_limited');
    }

    const refused = unsafeTextCategory(send.error.message);

    return refused ? refusalText(refused) : t('common.error_generic');
  };

  // Different words to the profile screen for the same rule. A bio is refused
  // because a bio is public; this is refused because the other person has not
  // agreed, which is a thing they can do something about.
  const refusalText = (category: string) =>
    category === 'sexual' ? t('consent.refused') : t('safety.text_slur');

  // The same rules the trigger applies, so a refusal arrives while the words
  // are still in the field. The copy in the database is the one that decides;
  // this only saves a round trip and says why.
  const refuse = (body: string) => {
    const violation = checkMessage(body, explicitAllowed);

    return violation ? refusalText(violation.category) : undefined;
  };

  // Both roll their optimistic change back when they fail, so with nothing said
  // the reaction or the removal simply undoes itself while the user watches.
  const actionError = () => {
    if (unsend.isError) {
      return unsend.error.message === ALREADY_READ
        ? t('chat.unsend_too_late')
        : t('common.error_generic');
    }

    return react.isError ? t('common.error_generic') : undefined;
  };

  const actionFailure = actionError();

  return (
    <Screen className="flex-1 pt-2">
      <ChatHeader
        name={name}
        photoKey={thread.other_photo_key}
        subtitle={
          thread.unmatched
            ? t('chat.unmatched')
            : thread.other_deleted
              ? t('chat.deleted_account')
              : t('chat.view_profile')
        }
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/matches'))}
        onOpenProfile={() => router.push({ pathname: '/match/[id]', params: { id: matchId } })}
        onSafety={() => setSafetyOpen(true)}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {items.length === 0 ? (
          // The screen somebody lands on straight after matching, so it gets
          // the same treatment as every other empty state rather than being
          // two lines of grey text on nothing.
          <View className="flex-1 justify-center">
            <EmptyState
              icon="chat"
              title={t('chat.say_hello_title', { name })}
              body={t('chat.say_hello_body')}
            />
          </View>
        ) : (
          <FlatList
            inverted
            data={items}
            keyExtractor={(item) => item.key}
            contentContainerClassName="gap-2 py-4"
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) =>
              item.kind === 'day' ? (
                <View className="flex-row items-center gap-3 py-3">
                  <View className="h-px flex-1 bg-border" />
                  <Text variant="overline" tone="subtle">
                    {item.label}
                  </Text>
                  <View className="h-px flex-1 bg-border" />
                </View>
              ) : (
                <MessageBubble
                  message={item.message}
                  mine={item.message.sender_id === userId}
                  onOpenActions={() => setSelectedId(item.message.id)}
                />
              )
            }
          />
        )}

        {actionFailure ? (
          <View className="px-4 pb-2">
            <Text variant="caption" tone="danger" role="alert" className="text-center">
              {actionFailure}
            </Text>
          </View>
        ) : null}

        {closed ? (
          <View className="border-t border-border px-4 py-5">
            <Text variant="caption" tone="subtle" className="text-center">
              {thread.other_deleted ? t('chat.other_left') : t('chat.unmatched')}
            </Text>
          </View>
        ) : (
          <>
            <ConsentBanner matchId={matchId} name={name} />

            <MessageComposer
              onSend={(body) => send.mutate(body)}
              disabled={send.isPending}
              error={sendError()}
              validate={refuse}
            />
          </>
        )}
      </KeyboardAvoidingView>

      <MessageActions
        visible={selected !== undefined}
        mine={selectedMine}
        canUnsend={selectedMine && selected?.read_at === null && selected?.deleted_at === null}
        selected={isReactionCode(myReaction ?? null) ? (myReaction as ReactionCode) : null}
        onReact={(code) => {
          if (selectedId) {
            react.mutate({ messageId: selectedId, code });
          }

          setSelectedId(null);
        }}
        onUnsend={() => {
          if (selectedId) {
            unsend.mutate(selectedId);
          }

          setSelectedId(null);
        }}
        onClose={() => setSelectedId(null)}
      />

      {/* The last twenty, both sides, because a message only reads as abuse
          next to what was said around it. Nothing else gives a moderator any
          access to a conversation. */}
      <SafetyActions
        visible={safetyOpen}
        name={name}
        targetId={thread.other_id}
        matchId={matchId}
        evidence={(messages ?? [])
          .filter((message) => message.deleted_at === null)
          .slice(-20)
          .map((message) => ({
            sender_id: message.sender_id,
            body: message.body,
            created_at: message.created_at,
          }))}
        onClose={() => setSafetyOpen(false)}
        onBlocked={() => router.replace('/matches')}
      />
    </Screen>
  );
}
