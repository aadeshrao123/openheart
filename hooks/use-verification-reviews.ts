import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { useIsModerator } from '@/hooks/use-moderation';
import type { VerificationChallenge } from '@/hooks/use-verification';
import type { Database } from '@/lib/database.types';

type ReviewRow =
  Database['public']['Functions']['list_verification_reviews']['Returns'][number];

// Widened, because the generator types every column of a `returns table` as
// non-null. An attempt sent for review carries no reason code, and one started
// before the second pose existed carries only one challenge.
export type VerificationReview = Omit<
  ReviewRow,
  'failure_reason' | 'challenge_two' | 'selfie_two_r2_key'
> & {
  failure_reason: string | null;
  challenge_two: VerificationChallenge | null;
  selfie_two_r2_key: string | null;
};

export const verificationReviewsKey = ['verification-reviews'] as const;

export function useVerificationReviews() {
  const isModerator = useIsModerator();

  return useQuery({
    queryKey: verificationReviewsKey,
    enabled: isModerator,
    queryFn: async (): Promise<VerificationReview[]> => {
      const { data, error } = await supabase.rpc('list_verification_reviews');

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });
}

type SelfieView = {
  selfies: { challenge: VerificationChallenge; url: string }[];
  photo_urls: string[];
};

// Never cached: the URLs expire in five minutes and a stale one is a broken
// image.
export function useReviewSelfie(attemptId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...verificationReviewsKey, attemptId, 'selfie'],
    enabled,
    gcTime: 0,
    staleTime: 0,
    queryFn: () => callFunction<SelfieView>('review-selfie', { attempt_id: attemptId }),
  });
}

export function useReviewVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attemptId, approved }: { attemptId: string; approved: boolean }) => {
      const { error } = await supabase.rpc('review_verification', {
        attempt: attemptId,
        approved,
      });

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: verificationReviewsKey });
    },
  });
}
