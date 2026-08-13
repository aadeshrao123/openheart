import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/use-session';
import { RATE_LIMITED, RATE_LIMIT_SQLSTATE } from '@/lib/db-errors';
import type { Database } from '@/lib/database.types';

export type SwipeDirection = Database['public']['Enums']['swipe_direction'];

export type Candidate = Database['public']['Functions']['discover_profiles']['Returns'][number] & {
  photoKeys: string[];
};

export { RATE_LIMITED };

export const discoveryKey = ['discovery'] as const;
export const matchesKey = ['matches'] as const;

// 20 fills roughly three screens of the deck, so the next page is fetched well
// before the user reaches the end of the current one.
const PAGE_SIZE = 20;

// Refetch once the deck is nearly out rather than when it is empty, so the next
// page is in flight while there are still cards to swipe.
export const REFILL_THRESHOLD = 5;

export function useDiscovery() {
  return useQuery({
    queryKey: discoveryKey,
    staleTime: 60_000,
    queryFn: async (): Promise<Candidate[]> => {
      const { data, error } = await supabase.rpc('discover_profiles', {
        page_size: PAGE_SIZE,
      });

      if (error) {
        throw error;
      }

      const candidates = data ?? [];

      if (candidates.length === 0) {
        return [];
      }

      // A second query rather than widening discover_profiles: that function is
      // security definer, so every column it returns is one that RLS no longer
      // checks. photos_select_others already allows exactly the approved photos
      // of exactly these profiles, so the policy does the work here instead.
      const { data: photos, error: photosError } = await supabase
        .from('photos')
        .select('profile_id, r2_key, position')
        .in(
          'profile_id',
          candidates.map((candidate) => candidate.id),
        )
        .eq('moderation_state', 'approved')
        .order('position');

      if (photosError) {
        throw photosError;
      }

      const byProfile = new Map<string, string[]>();

      for (const photo of photos ?? []) {
        const keys = byProfile.get(photo.profile_id) ?? [];

        keys.push(photo.r2_key);
        byProfile.set(photo.profile_id, keys);
      }

      return candidates.map((candidate) => ({
        ...candidate,
        photoKeys: byProfile.get(candidate.id) ?? [],
      }));
    },
  });
}

type SwipeInput = {
  targetId: string;
  direction: SwipeDirection;
  // What on the profile was liked, and what was said about it. 0024 refuses
  // both at once, and refuses either on a pass.
  likedPhotoId?: string | null;
  likedPrompt?: string | null;
  comment?: string | null;
};

export type SwipeResult = {
  matchedName: string | null;
};

export const likesKey = ['likes', 'received'] as const;

// Free and never behind a payment, which is the single most common thing a
// dating app charges for. 0024 makes an incoming like readable by the person
// it is aimed at; a pass stays invisible to whoever was passed on.
export function useLikesReceived() {
  return useQuery({
    queryKey: likesKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('likes_received');

      if (error) {
        throw error;
      }

      return data;
    },
  });
}

export const UNDO_TOO_LATE = 'P0001';
export const UNDO_MATCHED = 'P0002';

// Free, and only ever the last swipe inside a short window. 0023 refuses one
// that created a match, because the other person has already been told.
export function useUndoSwipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('undo_last_swipe');

      if (error) {
        throw error;
      }

      return data;
    },

    // Refetch rather than pushing the card back on: the deck is ordered by last
    // active and the returning profile does not necessarily belong on top.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: discoveryKey }),
  });
}

export function useSwipe() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({
      targetId,
      direction,
      likedPhotoId = null,
      likedPrompt = null,
      comment = null,
    }: SwipeInput): Promise<SwipeResult> => {
      if (!userId) {
        throw new Error('Cannot swipe while signed out');
      }

      // The match is created by a trigger inside this same statement, so two
      // simultaneous mutual likes cannot race into a duplicate or a missing
      // match. Nothing here decides whether a match happened.
      const { error } = await supabase.from('swipes').insert({
        swiper_id: userId,
        target_id: targetId,
        direction,
        liked_photo_id: direction === 'like' ? likedPhotoId : null,
        liked_prompt: direction === 'like' ? likedPrompt : null,
        comment: direction === 'like' && comment?.trim() ? comment.trim() : null,
      });

      if (error) {
        // 53400 is the swipe rate limit trigger, not a permission failure. The
        // screen says something true about it instead of a generic error.
        if (error.code === RATE_LIMIT_SQLSTATE) {
          throw new Error(RATE_LIMITED);
        }

        throw error;
      }

      if (direction !== 'like') {
        return { matchedName: null };
      }

      // Asked afterwards, never computed. matches is readable only by its two
      // participants, so a row coming back is proof the trigger fired rather
      // than a guess about whether it should have.
      const pair = [userId, targetId].sort();

      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('id')
        .eq('user_a', pair[0])
        .eq('user_b', pair[1])
        .maybeSingle();

      if (matchError) {
        throw matchError;
      }

      if (!match) {
        return { matchedName: null };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', targetId)
        .maybeSingle();

      return { matchedName: profile?.display_name ?? null };
    },

    // Removed from the cache before the request is sent. Waiting for the round
    // trip would leave the swiped card on screen, and refetching the whole deck
    // would reshuffle the cards under the user's thumb.
    onMutate: async ({ targetId }) => {
      await queryClient.cancelQueries({ queryKey: discoveryKey });

      const previous = queryClient.getQueryData<Candidate[]>(discoveryKey);

      queryClient.setQueryData<Candidate[]>(discoveryKey, (deck) =>
        (deck ?? []).filter((candidate) => candidate.id !== targetId),
      );

      return { previous };
    },

    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(discoveryKey, context.previous);
      }
    },

    onSuccess: (result) => {
      if (result.matchedName !== null) {
        void queryClient.invalidateQueries({ queryKey: matchesKey });
        void queryClient.invalidateQueries({ queryKey: likesKey });
      }
    },
  });
}
