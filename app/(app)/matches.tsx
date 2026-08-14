import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, EmptyState, Screen, Skeleton, Text } from '@/components/ui';
import { LoadFailed } from '@/components/load-failed';
import { ThreadRow } from '@/components/thread-row';
import { useThreads } from '@/hooks/use-threads';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Matches the shape of ThreadRow: avatar, then a name line and a preview line.
function ThreadListSkeleton() {
  const { t } = useTranslation();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      aria-busy
      className="gap-1"
    >
      {[0, 1, 2, 3, 4].map((row) => (
        <View key={row} className="flex-row items-center gap-4 px-2 py-3">
          <Skeleton shape="avatar" />

          <View className="flex-1 gap-2">
            <Skeleton shape="line" className="w-1/3" />
            <Skeleton shape="caption" className="w-2/3" />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function MatchesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = useSession();
  const { data: threads, isPending, isError, isFetching, refetch } = useThreads();

  // Reaching this screen proves the messages are on the device, which is what
  // the second tick means. The RPC only touches rows whose delivered_at is
  // still null, so the change event it produces cannot drive this round again.
  useEffect(() => {
    for (const thread of threads ?? []) {
      if (thread.unread_count > 0) {
        void supabase.rpc('mark_thread_delivered', { thread: thread.match_id });
      }
    }
  }, [threads]);

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | undefined;

    void freshChannel('threads').then((opened) => {
      if (cancelled) {
        void supabase.removeChannel(opened);
        return;
      }

      channel = opened;

      opened
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
          void refetch();
        })
        .subscribe();
    });

    return () => {
      cancelled = true;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [refetch]);

  if (isPending) {
    return (
      <Screen scroll className="gap-6 py-6">
        <View className="gap-2">
          <View className="h-px w-12 bg-brand" />
          <Text variant="title">{t('matches.title')}</Text>
        </View>

        <ThreadListSkeleton />
      </Screen>
    );
  }

  // Before the empty state, not after it. A failed read used to render "No
  // matches yet", which is a confident lie about someone's conversations.
  if (isError) {
    return (
      <LoadFailed
        retrying={isFetching}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (threads.length === 0) {
    return (
      <Screen className="justify-center">
        <EmptyState icon="heart" title={t('matches.title')} body={t('matches.empty')}>
          <Button label={t('home.browse')} onPress={() => router.push('/deck')} />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      className="gap-6 py-6"
      refreshing={isFetching}
      onRefresh={() => {
        void refetch();
      }}
    >
      <View className="gap-2">
        <View className="h-px w-12 bg-brand" />
        <Text variant="title">{t('matches.title')}</Text>
      </View>

      <View>
        {threads.map((thread) => (
          <ThreadRow
            key={thread.match_id}
            thread={thread}
            isMine={thread.last_sender_id === session?.user.id}
            onPress={() =>
              router.push({ pathname: '/chat/[id]', params: { id: thread.match_id } })
            }
          />
        ))}
      </View>

      <Card elevation="flat">
        <Text variant="caption" tone="subtle">
          {t('matches.privacy_note')}
        </Text>
      </Card>
    </Screen>
  );
}
