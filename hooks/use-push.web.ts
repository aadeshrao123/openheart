import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';
import { threadsKey } from '@/hooks/use-threads';
import { useSession } from '@/hooks/use-session';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

// expo-notifications is Android and iOS only, and there is no web build of it
// to fall back on. So the browser gets a different thing wearing the same name:
// the Notification API, driven by the realtime subscription the app already
// holds open while a tab is running.
//
// The honest limitation, and it is not small: this only works while a tab is
// open. Closing the browser ends the socket and ends the notifications. Real
// web push needs a service worker, a VAPID keypair and an encrypted payload,
// which is a different feature rather than a bigger version of this one.
//
// Nothing here talks to push_tokens. A browser has no Expo token, so there is
// nothing for the server to send to and no row to write.

type MessageRow = Database['public']['Tables']['messages']['Row'];
type MatchRow = Database['public']['Tables']['matches']['Row'];

function canNotify(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function usePush(): void {
  const router = useRouter();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId || !canNotify()) {
      return;
    }

    // Asked once. A browser that has already been told no returns "denied"
    // here without prompting, which is the correct outcome rather than a
    // reason to keep asking.
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }

    const show = (title: string, body: string, matchId: string) => {
      if (Notification.permission !== 'granted') {
        return;
      }

      // Nothing while they are looking at the tab. The conversation updates in
      // front of them, and a desktop notification for a message already on
      // screen is noise.
      if (typeof document !== 'undefined' && !document.hidden) {
        return;
      }

      // tag, so ten messages from one conversation replace each other rather
      // than stacking ten deep.
      const notification = new Notification(title, { body, tag: `openheart:${matchId}` });

      notification.onclick = () => {
        window.focus();
        notification.close();
        router.push({ pathname: '/chat/[id]', params: { id: matchId } });
      };
    };

    let cancelled = false;
    let channel: RealtimeChannel | undefined;

    void freshChannel('push:web').then((opened) => {
      if (cancelled) {
        void supabase.removeChannel(opened);
        return;
      }

      channel = opened;

      opened
        // No filter, because there is nothing to filter on: RLS is the filter.
        // Only rows inside this user's own conversations are ever forwarded.
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => {
            const message = payload.new as MessageRow;

            if (message.sender_id === userId) {
              return;
            }

            // The thread list is stale now whether or not a notification is
            // shown, and on web there is no other global subscription to do it.
            void queryClient.invalidateQueries({ queryKey: threadsKey });

            show(t('push.message_title'), t('push.message_body'), message.match_id);
          },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'matches' },
          (payload) => {
            const match = payload.new as MatchRow;

            void queryClient.invalidateQueries({ queryKey: threadsKey });

            show(t('push.match_title'), t('push.match_body'), match.id);
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [userId, router, t, queryClient]);
}
