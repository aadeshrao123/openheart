import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Fetching a profile by id is safe here in a way it is not for discovery: the
// only ids reachable are the ones the caller is already matched with, so this
// is not the enumeration shape that keeps candidate/[id] reading from a cache.
export function useMatchProfile(otherId: string | undefined) {
  return useQuery({
    queryKey: ['match-profile', otherId],
    enabled: otherId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, bio, gender, birthdate, deleted_at, photos(r2_key, position)')
        .eq('id', otherId ?? '')
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  });
}
