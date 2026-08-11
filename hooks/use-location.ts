import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { toCoarseLocation } from '@/lib/location';
import { useSession } from '@/hooks/use-session';
import { myProfileKey } from '@/hooks/use-my-profile';

export type LocationResult = 'saved' | 'denied' | 'unavailable';

export function useUpdateLocation() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (): Promise<LocationResult> => {
      const userId = session?.user.id;

      if (!userId) {
        throw new Error('Cannot save a location while signed out');
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      // Refusing is a normal answer, not an error, so this returns rather than
      // throws. They just will not appear in a distance filter yet.
      if (status !== Location.PermissionStatus.GRANTED) {
        return 'denied';
      }

      // Lowest accuracy the platform offers: it is rounded to about a kilometre
      // twice over, so a precise fix would cost battery for discarded digits.
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
      });

      const { error } = await supabase
        .from('profiles')
        .update({
          location: toCoarseLocation(position.coords.latitude, position.coords.longitude),
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      return 'saved';
    },

    onSuccess: (result) => {
      if (result === 'saved') {
        void queryClient.invalidateQueries({ queryKey: myProfileKey });
      }
    },
  });
}
