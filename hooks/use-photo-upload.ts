import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { pickPhoto, preparePhoto } from '@/lib/image';
import { myPhotosKey } from '@/hooks/use-photos';

// What the caller needs to tell the user apart. "cancelled" is not a failure.
export type UploadOutcome =
  | { status: 'cancelled' }
  | { status: 'uploaded'; moderationState: string }
  | { status: 'awaiting_review' }
  | { status: 'failed'; code: string };

type FunctionError = { code: string };

async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });

  if (error) {
    // The function replies with a stable machine code the client maps to a
    // translation key. invoke() surfaces a generic FunctionsHttpError, so the
    // body has to be read off the response to get at it.
    const response = (error as { context?: Response }).context;
    const parsed: unknown = response ? await response.json().catch(() => null) : null;
    const code = (parsed as FunctionError | null)?.code;

    throw new Error(code ?? 'internal_error');
  }

  if (data === null) {
    throw new Error('internal_error');
  }

  return data;
}

type SlotResponse = {
  photo_id: string;
  upload_url: string;
};

type ModerationResponse = {
  moderation_state: string;
};

export function useUploadPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (position: number): Promise<UploadOutcome> => {
      const uri = await pickPhoto();

      if (!uri) {
        return { status: 'cancelled' };
      }

      const prepared = await preparePhoto(uri);

      // The row is reserved server-side before the URL is signed, so from here
      // on a failure leaves a pending row the user can see and delete rather
      // than an object nothing knows about.
      const slot = await callFunction<SlotResponse>('request-photo-upload', { position });

      const upload = await fetch(slot.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': prepared.contentType },
        // A Uint8Array body works on iOS, Android and web alike. A file:// URI
        // does not, which is why lib/image.ts hands back bytes.
        body: prepared.bytes,
      });

      if (!upload.ok) {
        throw new Error('upload_failed');
      }

      // Photos are never visible until this writes a verdict. A 503 here means
      // no scanner is configured or it is unreachable, which leaves the row
      // pending and retryable rather than letting an unscanned photo through.
      try {
        const verdict = await callFunction<ModerationResponse>('moderate-photo', {
          photo_id: slot.photo_id,
        });

        return { status: 'uploaded', moderationState: verdict.moderation_state };
      } catch (error) {
        if (error instanceof Error && error.message === 'moderation_unavailable') {
          return { status: 'awaiting_review' };
        }

        throw error;
      }
    },

    // Invalidated on failure too: a reserved row may exist either way, and the
    // grid is what lets the user clear it.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: myPhotosKey });
    },
  });
}
