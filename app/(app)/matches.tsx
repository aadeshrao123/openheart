import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Screen, Text } from '@/components/ui';
import { ThreadRow } from '@/components/thread-row';
import { useThreads } from '@/hooks/use-threads';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export default function MatchesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = useSession();
  const { data: threads, isPending, refetch } = useThreads();

  // Reaching this screen proves the messages are on the device, which is what
  // the second tick means.
  useEffect(() => {
    for (const thread of threads ?? []) {
      if (thread.unread_count > 0) {
        void supabase.rpc('mark_thread_delivered', { thread: thread.match_id });
      }
    }
  }, [threads]);

  useEffect(() => {
    const channel = supabase
      .channel('threads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        void refetch();
      });

    let cancelled = false;

    void supabase.realtime.setAuth().then(() => {
      if (!cancelled) {
        channel.subscribe();
      }
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [refetch]);

  if (isPending) {
    return (
      <Screen className="justify-center">
        <Text tone="muted" className="text-center">
          {t('common.loading')}
        </Text>
      </Screen>
    );
  }

  if (!threads || threads.length === 0) {
    return (
      <Screen className="justify-center gap-5">
        <Text variant="title">{t('matches.title')}</Text>
        <Text tone="muted">{t('matches.empty')}</Text>
        <Button label={t('home.browse')} onPress={() => router.push('/deck')} />
      </Screen>
    );
  }

  return (
    <Screen scroll className="gap-6 py-6">
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
