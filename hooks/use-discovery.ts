import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type SwipeDirection = Database['public']['Enums']['swipe_direction'];

type SwipeInput = {
  targetId: string;
  direction: SwipeDirection;
};

export const discoveryKey = ['discovery'] as const;
export const matchesKey = ['matches'] as const;

// 20 fills roughly three screens of the deck, so the next page is fetched well
// before the user reaches the end of the current one.
const DEFAULT_PAGE_SIZE = 20;

export function useDiscovery(pageSize = DEFAULT_PAGE_SIZE) {
  return useQuery({
    queryKey: [...discoveryKey, pageSize],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('discover_profiles', {
        page_size: pageSize,
      });

      if (error) {
        throw error;
      }

      return data;
    },
  });
}

export function useSwipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetId, direction }: SwipeInput) => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;

      if (!userId) {
        throw new Error('Cannot swipe while signed out');
      }

      // A mutual like creates the match via a trigger inside this same
      // statement. Never try to detect a match client-side: two simultaneous
      // swipes would race.
      const { error } = await supabase.from('swipes').insert({
        swiper_id: userId,
        target_id: targetId,
        direction,
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discoveryKey });
      queryClient.invalidateQueries({ queryKey: matchesKey });
    },
  });
}
