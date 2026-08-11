import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/use-session';
import type { Database } from '@/lib/database.types';

export type Thread = Database['public']['Functions']['list_threads']['Returns'][number];

export const threadsKey = ['threads'] as const;

export function useThreads() {
  return useQuery({
    queryKey: threadsKey,
    queryFn: async (): Promise<Thread[]> => {
      const { data, error } = await supabase.rpc('list_threads');

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });
}

export function useThread(matchId: string | undefined) {
  const { data: threads } = useThreads();

  return threads?.find((thread) => thread.match_id === matchId);
}

export function useUnmatch() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (matchId: string) => {
      if (!session) {
        throw new Error('Cannot unmatch while signed out');
      }

      const { error } = await supabase
        .from('matches')
        .update({ unmatched_by: session.user.id })
        .eq('id', matchId);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: threadsKey }),
  });
}

// Per user, so the other participant keeps their copy of the conversation.
export function useHideThread() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (matchId: string) => {
      if (!session) {
        throw new Error('Cannot hide a thread while signed out');
      }

      const { error } = await supabase
        .from('hidden_matches')
        .insert({ match_id: matchId, user_id: session.user.id });

      if (error) {
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: threadsKey }),
  });
}
