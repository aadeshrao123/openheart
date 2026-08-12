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
      const id = otherId ?? '';

      // Two requests, sent together. birthdate left the client's read grant in
      // 0016, so the age is computed in the database, by the same expression
      // discover_profiles uses and gated on the same match rule the row's own
      // policy states. Folding it into the row read would take a view over
      // profiles that runs as its owner, which is a second way to read a
      // profile and the one thing this must not turn into.
      const [profile, age] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, bio, gender, deleted_at, photos(r2_key, position)')
          .eq('id', id)
          .maybeSingle(),
        supabase.rpc('match_age', { target: id }),
      ]);

      if (profile.error) {
        throw profile.error;
      }

      if (age.error) {
        throw age.error;
      }

      if (!profile.data) {
        return null;
      }

      // null for anyone the caller is not matched with, which is the only way
      // this hook is reachable anyway.
      const matchAge: number | null = age.data ?? null;

      return {
        ...profile.data,
        age: matchAge,
      };
    },
  });
}
