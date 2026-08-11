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

      // maybeSingle, not single: a signed-in user with no profile row yet is
      // the normal state between verifying a code and finishing onboarding,
      // and single() treats zero rows as an error.
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
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
      const { data, error } = await supabase
        .from('profiles')
        .insert({ ...profile, id: userId })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
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

      const { data, error } = await supabase
        .from('profiles')
        .update(edit)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
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
