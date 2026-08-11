import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/use-session';
import type { Database } from '@/lib/database.types';

export type Photo = Database['public']['Tables']['photos']['Row'];

export const myPhotosKey = ['photos', 'me'] as const;

export const MAX_PHOTOS = 6;

export function useMyPhotos() {
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: myPhotosKey,
    enabled: userId !== undefined,
    queryFn: async () => {
      if (!userId) {
        throw new Error('useMyPhotos ran without a session');
      }

      // photos_select_own returns pending and rejected rows too, which is what
      // lets the grid explain why a photo is not live yet.
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('profile_id', userId)
        .order('position');

      if (error) {
        throw error;
      }

      return data;
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (photoId: string) => {
      // Deleting the row is the client's half. The object is purged separately:
      // nothing here can reach R2, and a client that could would be able to
      // delete anyone's object.
      const { error } = await supabase.from('photos').delete().eq('id', photoId);

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myPhotosKey });
    },
  });
}

// Through an RPC rather than a sequence of updates. position is unique per
// profile and capped at 5, so a full grid has no spare slot to park a photo in,
// and PostgREST gives each request its own transaction, so the client cannot
// hold two updates together. set_photo_order does it in one statement.
export function useReorderPhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const { error } = await supabase.rpc('set_photo_order', { photo_ids: orderedIds });

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myPhotosKey });
    },
  });
}
