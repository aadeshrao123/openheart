import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const sessionKey = ['session'] as const;

export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    // The SDK owns, persists and refreshes the session, and pushes changes
    // through onAuthStateChange. Nothing here to revalidate.
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      return data.session;
    },
  });
}

// Call once, from the root layout.
export function useAuthSync(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData(sessionKey, session);

      // The rest of the cache belongs to the account that just left, and on a
      // shared device the next person must not see it.
      //
      // Deferred, and never queryClient.clear(). Removing a query with a mounted
      // observer refetches it immediately, so clearing from inside this callback
      // re-entered the auth client mid-emit and killed the in-flight getSession
      // the app was waiting on: the splash never went away.
      if (!session) {
        setTimeout(() => {
          queryClient.removeQueries({
            predicate: (query) => query.queryKey[0] !== sessionKey[0],
          });
        }, 0);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [queryClient]);
}
