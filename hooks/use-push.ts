import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { getLocales } from 'expo-localization';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/use-session';

// What a notification does while the app is already open. No sound, because
// lib/sounds.ts already plays one for a message that arrives in a conversation
// the user is looking at, and two is worse than either.
//
// shouldShowAlert is deprecated in this version, per the installed types:
// banner and list replaced it.
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
});

// Named to match the channelId the Edge Function sends. Android 8 and above
// drops a notification whose channel does not exist, silently.
const CHANNEL = 'default';

async function deviceToken(): Promise<string | null> {
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;

  // Asking again after a refusal is how an app trains people to refuse it
  // permanently at the OS level.
  if (!granted && existing.canAskAgain) {
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }

  if (!granted) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Matches and messages',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;

  if (typeof projectId !== 'string') {
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });

    return data;
  } catch (error) {
    // A simulator, an emulator, or a build with no push credentials. None of
    // those is worth an error in front of somebody trying to use the app.
    console.warn('push token unavailable', error);

    return null;
  }
}

export function usePush(): void {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user.id;
  const registered = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      // Signed out on a shared device. 0019 is explicit that the token has to
      // go, or the next person's phone keeps receiving the previous person's
      // matches.
      const stale = registered.current;
      registered.current = null;

      if (stale) {
        void supabase.from('push_tokens').delete().eq('token', stale);
      }

      return;
    }

    let cancelled = false;

    void deviceToken().then(async (token) => {
      if (cancelled || token === null) {
        return;
      }

      registered.current = token;

      // The locale travels with the token because the server writes the
      // notification text and cannot ask the device what language it is in.
      const { error } = await supabase.rpc('register_push_token', {
        push_token: token,
        device: Platform.OS,
        locale: getLocales()[0]?.languageTag ?? null,
      });

      if (error) {
        console.warn('could not register for push', error.message);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { match_id?: unknown };
      const matchId = typeof data?.match_id === 'string' ? data.match_id : null;

      // Both a match and a message open the conversation. A new match with
      // nothing said in it is exactly where somebody wants to land.
      if (matchId) {
        router.push({ pathname: '/chat/[id]', params: { id: matchId } });
      }
    });

    return () => tapped.remove();
  }, [router]);
}
