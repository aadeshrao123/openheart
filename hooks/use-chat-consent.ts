import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';
import { useSession } from '@/hooks/use-session';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export type ConsentState = Database['public']['Enums']['consent_state'];

export type ChatConsent = {
  state: ConsentState;
  requested_by: string;
  settled_by: string | null;
};

export const consentKey = (matchId: string) => ['chat-consent', matchId] as const;

export function useChatConsent(matchId: string) {
  return useQuery({
    queryKey: consentKey(matchId),
    queryFn: async (): Promise<ChatConsent | null> => {
      const { data, error } = await supabase
        .from('explicit_consent')
        .select('state, requested_by, settled_by')
        .eq('match_id', matchId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  });
}

// Its own channel rather than a third listener on the chat one, because the
// chat channel filters on match_id and this table's rows are keyed by it, so
// the filter column has a different name and cannot be shared.
export function useChatConsentRealtime(matchId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | undefined;

    void freshChannel(`consent:${matchId}`).then((opened) => {
      if (cancelled) {
        void supabase.removeChannel(opened);
        return;
      }

      channel = opened;

      opened
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'explicit_consent',
            filter: `match_id=eq.${matchId}`,
          },
          () => {
            void queryClient.invalidateQueries({ queryKey: consentKey(matchId) });
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
  }, [matchId, queryClient]);
}

type Move = { kind: 'request' } | { kind: 'respond'; accept: boolean } | { kind: 'revoke' };

export function useConsentMove(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (move: Move) => {
      const { error } =
        move.kind === 'request'
          ? await supabase.rpc('request_explicit_consent', { thread: matchId })
          : move.kind === 'revoke'
            ? await supabase.rpc('revoke_explicit_consent', { thread: matchId })
            : await supabase.rpc('respond_to_explicit_consent', {
                thread: matchId,
                accept: move.accept,
              });

      if (error) {
        throw error;
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: consentKey(matchId) });
    },
  });
}

// What a screen actually needs off all of the above: whether the filter is off,
// and whose turn it is. Deliberately does not subscribe, so more than one
// component can ask without opening a channel each; the screen calls
// useChatConsentRealtime once and TanStack Query shares the row.
export function useConsentStatus(matchId: string) {
  const { data: session } = useSession();
  const { data: consent } = useChatConsent(matchId);

  const me = session?.user.id;
  const state = consent?.state ?? null;

  return {
    state,
    explicitAllowed: state === 'active',
    // Only ever one of these two, and never both, so the chat has one banner.
    awaitingMe: state === 'requested' && consent?.requested_by !== me,
    awaitingThem: state === 'requested' && consent?.requested_by === me,
    // After a decline or a revocation the person who ended it owns whether it
    // comes back. The other side is not shown a button that would be refused.
    // A null settled_by is somebody withdrawing their own unanswered question,
    // which nobody refused, so it is open to both again.
    canRequest:
      state === null ||
      ((state === 'declined' || state === 'revoked') &&
        (consent?.settled_by === null || consent?.settled_by === me)),
  };
}
