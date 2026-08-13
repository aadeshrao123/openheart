import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/use-session';
import type { Database } from '@/lib/database.types';

type PromptRow = Database['public']['Tables']['profile_prompts']['Row'];

export type PromptAnswer = Pick<PromptRow, 'prompt' | 'answer' | 'position'>;

export const promptsKey = (profileId: string) => ['prompts', profileId] as const;

export function usePrompts(profileId: string | undefined) {
  return useQuery({
    queryKey: promptsKey(profileId ?? ''),
    enabled: profileId !== undefined,
    queryFn: async (): Promise<PromptAnswer[]> => {
      const { data, error } = await supabase
        .from('profile_prompts')
        .select('prompt, answer, position')
        .eq('profile_id', profileId ?? '')
        .order('position');

      if (error) {
        throw error;
      }

      return data;
    },
  });
}

// Replace rather than merge. Positions are unique per profile, so editing one
// answer in place can collide with a row that is about to move out of the way.
export function useSavePrompts() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (answers: PromptAnswer[]) => {
      const userId = session?.user.id;

      if (!userId) {
        throw new Error('Cannot save prompts while signed out');
      }

      const { error: cleared } = await supabase
        .from('profile_prompts')
        .delete()
        .eq('profile_id', userId);

      if (cleared) {
        throw cleared;
      }

      const kept = answers
        .filter((entry) => entry.answer.trim().length > 0)
        .map((entry, index) => ({
          profile_id: userId,
          prompt: entry.prompt,
          answer: entry.answer.trim(),
          position: index,
        }));

      if (kept.length > 0) {
        const { error } = await supabase.from('profile_prompts').insert(kept);

        if (error) {
          throw error;
        }
      }

      return kept.map(({ prompt, answer, position }) => ({ prompt, answer, position }));
    },

    onSuccess: (answers) => {
      const userId = session?.user.id;

      if (userId) {
        queryClient.setQueryData(promptsKey(userId), answers);
      }
    },
  });
}
