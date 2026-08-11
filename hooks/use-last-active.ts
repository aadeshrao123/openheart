import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/use-session';

// Discovery orders by last_active. A write per foreground is a write per app
// switch, which on a phone is constant and changes the ordering by nothing.
const MINIMUM_INTERVAL_MS = 5 * 60_000;

export function useLastActivePing(): void {
  const { data: session } = useSession();
  const userId = session?.user.id;
  const lastPingAt = useRef(0);

  const ping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        throw error;
      }
    },
  });

  // A failed ping must never surface to the user or reach the error boundary.
  const send = ping.mutate;

  useEffect(() => {
    if (!userId) {
      return;
    }

    const maybePing = () => {
      const now = Date.now();

      if (now - lastPingAt.current < MINIMUM_INTERVAL_MS) {
        return;
      }

      lastPingAt.current = now;
      send(userId);
    };

    maybePing();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        maybePing();
      }
    });

    return () => subscription.remove();
  }, [userId, send]);
}
