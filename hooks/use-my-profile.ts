import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/use-session';
import type { Database } from '@/lib/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export const myProfileKey = ['profile', 'me'] as const;

// Exactly the columns 0006_grants.sql allows a client to insert.
export type NewProfile = Pick<
  ProfileRow,
  | 'display_name'
  | 'birthdate'
  | 'bio'
  | 'gender'
  | 'seeking'
  | 'max_distance_km'
  | 'age_min'
  | 'age_max'
>;

// Exactly the columns it allows a client to update. birthdate is absent because
// an age gate you can edit past is not a gate; a trigger rejects it too, so this
// only decides whether the mistake is caught by tsc or by Postgres.
export type ProfileEdit = Partial<Omit<NewProfile, 'birthdate'>>;

// 0016 took birthdate, location and the suspension columns out of the client's
// read grant, and a column grant applies to your own row too: `select *` on
// yourself is now refused exactly like anyone else's. my_profile() is the
// supported way back to the whole row. It is security definer, and the only row
// it can return is the caller's.
//
// maybeSingle, not single: a signed-in user with no profile row yet is the
// normal state between verifying a code and finishing onboarding, and single()
// treats zero rows as an error.
async function fetchMyProfile(): Promise<ProfileRow | null> {
  const { data, error } = await supabase.rpc('my_profile').maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export function useMyProfile() {
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: myProfileKey,
    enabled: userId !== undefined,
    queryFn: async () => {
      if (!userId) {
        throw new Error('useMyProfile ran without a session');
      }

      return fetchMyProfile();
    },
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (profile: NewProfile) => {
      const userId = session?.user.id;

      if (!userId) {
        throw new Error('Cannot create a profile while signed out');
      }

      // profiles has no foreign key to auth.users (0007 dropped it so deletion
      // can leave a tombstone), so the insert policy is what ties row to owner.
      //
      // select('id'), not select(): a RETURNING clause is a read and needs the
      // same column privileges, and id is the one column that is still granted
      // and still enough to tell a write that landed from one that hit no row.
      const { error } = await supabase
        .from('profiles')
        .insert({ ...profile, id: userId })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      const created = await fetchMyProfile();

      if (!created) {
        throw new Error('The profile was written but could not be read back');
      }

      return created;
    },

    onSuccess: (profile) => {
      queryClient.setQueryData(myProfileKey, profile);
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (edit: ProfileEdit) => {
      const userId = session?.user.id;

      if (!userId) {
        throw new Error('Cannot update a profile while signed out');
      }

      const { error } = await supabase
        .from('profiles')
        .update(edit)
        .eq('id', userId)
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      // Same as the insert above: the whole row comes back through my_profile(),
      // because birthdate and location cannot be read off the table any more.
      const saved = await fetchMyProfile();

      if (!saved) {
        throw new Error('The profile was saved but could not be read back');
      }

      return saved;
    },

    onSuccess: (profile) => {
      queryClient.setQueryData(myProfileKey, profile);
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      // Anonymization, not a row delete: keeps the row so message history and
      // moderation records survive.
      const { error } = await supabase.rpc('delete_my_account');

      if (error) {
        throw error;
      }

      // local, because the auth user is already gone: a global sign-out would
      // fail revoking it and leave valid-looking tokens on the device.
      await supabase.auth.signOut({ scope: 'local' });
    },
  });
}
