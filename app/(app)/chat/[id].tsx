import { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Text } from '@/components/ui';
import { ChatHeader } from '@/components/chat-header';
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
import { useThread, useThreads } from '@/hooks/use-threads';
import { useSession } from '@/hooks/use-session';
import { ALREADY_READ, RATE_LIMITED } from '@/lib/db-errors';
import { formatDayLabel } from '@/lib/format';
import { isReactionCode, type ReactionCode } from '@/lib/reactions';

type Item =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; key: string; message: ChatMessage };

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

export default function ChatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id ?? '';

  const { data: session } = useSession();
  const userId = session?.user.id;

  const { isPending: threadsPending } = useThreads();
  const thread = useThread(matchId);
  const { data: messages } = useMessages(matchId);

  useChatRealtime(matchId);

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

  if (threadsPending) {
    return (
      <Screen className="justify-center">
        <Text tone="muted" className="text-center">
          {t('common.loading')}
        </Text>
      </Screen>
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

    return send.error.message === RATE_LIMITED
      ? t('chat.rate_limited')
      : t('common.error_generic');
  };

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
          <View className="flex-1 items-center justify-center gap-3 px-4">
            <Text variant="quote" tone="muted" className="text-center">
              {t('chat.say_hello_title', { name })}
            </Text>
            <Text variant="caption" tone="subtle" className="text-center">
              {t('chat.say_hello_body')}
            </Text>
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

        {closed ? (
          <View className="border-t border-border px-4 py-5">
            <Text variant="caption" tone="subtle" className="text-center">
              {thread.other_deleted ? t('chat.other_left') : t('chat.unmatched')}
            </Text>
          </View>
        ) : (
          <MessageComposer
            onSend={(body) => send.mutate(body)}
            disabled={send.isPending}
            error={sendError()}
          />
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

      {unsend.isError && unsend.error.message === ALREADY_READ ? (
        <View className="px-4 pb-2">
          <Text variant="caption" tone="danger" className="text-center">
            {t('chat.unsend_too_late')}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
