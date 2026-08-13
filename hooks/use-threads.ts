import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/use-session';
import type { Database } from '@/lib/database.types';

type ThreadRow = Database['public']['Functions']['list_threads']['Returns'][number];

// The generator types every column of a `returns table` as non-null. A thread
// with no messages leaves the whole lateral join null, and a profile with no
// approved photo has no key. A widening, so the rpc result needs no cast.
export type Thread = Omit<
  ThreadRow,
  'last_at' | 'last_body' | 'last_sender_id' | 'other_photo_key'
> & {
  last_at: string | null;
  last_body: string | null;
  last_sender_id: string | null;
  other_photo_key: string | null;
};

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
