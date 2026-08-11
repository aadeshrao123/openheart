import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/use-session';
import { threadsKey } from '@/hooks/use-threads';
import { discoveryKey } from '@/hooks/use-discovery';
import { RATE_LIMITED, RATE_LIMIT_SQLSTATE } from '@/lib/db-errors';
import type { ReportReason } from '@/lib/report-reasons';

export const blocksKey = ['blocks'] as const;

type ReportInput = {
  targetId: string;
  reason: ReportReason;
  detail?: string;
  matchId?: string;
  // What the reporter is pointing at. Moderators have no blanket read on
  // messages, so this snapshot is the only conversation content they ever see.
  evidence?: { sender_id: string; body: string; created_at: string }[];
};

export function useReport() {
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({ targetId, reason, detail, matchId, evidence }: ReportInput) => {
      if (!session) {
        throw new Error('Cannot report while signed out');
      }

      const { error } = await supabase.from('reports').insert({
        reporter_id: session.user.id,
        target_id: targetId,
        reason,
        detail: detail?.trim() || null,
        match_id: matchId ?? null,
        evidence: evidence ?? null,
      });

      if (error) {
        if (error.code === RATE_LIMIT_SQLSTATE) {
          throw new Error(RATE_LIMITED);
        }

        throw error;
      }
    },
  });
}

export function useBlocks() {
  return useQuery({
    queryKey: blocksKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocks')
        .select('blocked_id, created_at, profiles!blocks_blocked_id_fkey(display_name)')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });
}

export function useBlock() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (targetId: string) => {
      if (!session) {
        throw new Error('Cannot block while signed out');
      }

      const { error } = await supabase
        .from('blocks')
        .insert({ blocker_id: session.user.id, blocked_id: targetId });

      if (error) {
        throw error;
      }
    },

    // A block closes any open match through a trigger, so the thread list and
    // the deck are both stale afterwards.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: blocksKey });
      void queryClient.invalidateQueries({ queryKey: threadsKey });
      void queryClient.invalidateQueries({ queryKey: discoveryKey });
    },
  });
}

// Unblocking does not reopen the match. The trigger closed it, and reversing
// that would put a conversation back in front of someone who ended it.
export function useUnblock() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (targetId: string) => {
      if (!session) {
        throw new Error('Cannot unblock while signed out');
      }

      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', session.user.id)
        .eq('blocked_id', targetId);

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: blocksKey });
      void queryClient.invalidateQueries({ queryKey: discoveryKey });
    },
  });
}
