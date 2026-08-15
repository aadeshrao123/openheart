import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { preparePhoto } from '@/lib/image';
import { myProfileKey } from '@/hooks/use-my-profile';
import { useSession } from '@/hooks/use-session';
import { RATE_LIMITED } from '@/lib/db-errors';
import type { Database } from '@/lib/database.types';

export type VerificationChallenge =
  Database['public']['Enums']['verification_challenge'];

export type VerificationStatus =
  Database['public']['Enums']['verification_status'];

export type VerificationOutcome = {
  status: VerificationStatus;
  reason: string | null;
};

export const verificationKey = ['verification'] as const;

// The most recent attempt, which is what the screen reports on. Deliberately
// not a list: how many times someone failed is a moderator's business.
export function useLatestVerification() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: verificationKey,
    enabled: session !== null && session !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verification_attempts')
        .select('id, status, challenge, failure_reason, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  });
}

type StartResponse = {
  attempt_id: string;
  challenge: VerificationChallenge;
  upload_url: string;
  challenge_two: VerificationChallenge;
  upload_url_two: string;
};

// Split from the submit below rather than one call, because the pose has to be
// on screen while the camera is open. The server picks it; the client is told.
export function useStartVerification() {
  return useMutation({
    mutationFn: async (): Promise<StartResponse> => {
      try {
        return await callFunction<StartResponse>('request-verification', {});
      } catch (error) {
        if (error instanceof Error && error.message === 'rate_limited') {
          throw new Error(RATE_LIMITED);
        }

        throw error;
      }
    },
  });
}

type SubmitInput = {
  attemptId: string;
  captures: { uploadUrl: string; uri: string }[];
};

export function useSubmitVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attemptId, captures }: SubmitInput) => {
      // Both poses go up before either is judged. Uploading and verifying one
      // at a time would tell somebody their first pose passed, which is the
      // feedback that makes guessing the pair worth doing.
      await Promise.all(
        captures.map(async ({ uploadUrl, uri }) => {
          // Same path a profile photo takes: resized to the cost target and
          // handed over as bytes, because a file:// URI is not a body on every
          // platform.
          const prepared = await preparePhoto(uri);

          const upload = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': prepared.contentType },
            body: prepared.bytes,
          });

          if (!upload.ok) {
            throw new Error('upload_failed');
          }
        }),
      );

      return await callFunction<VerificationOutcome>('verify-selfie', {
        attempt_id: attemptId,
      });
    },

    // photo_verified may have changed, and it is what decides whether this
    // person is in anybody's deck.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: verificationKey });
      void queryClient.invalidateQueries({ queryKey: myProfileKey });
    },
  });
}
