import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { supabase } from '@/lib/supabase';

type PlatformKey = 'ios' | 'android' | 'web';

function currentPlatform(): PlatformKey {
  if (Platform.OS === 'ios') {
    return 'ios';
  }

  if (Platform.OS === 'android') {
    return 'android';
  }

  return 'web';
}

// Compares dotted numeric versions without a semver dependency. Missing
// segments count as zero, so "1.2" and "1.2.0" compare equal.
function compareVersions(left: string, right: string): number {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);

    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

export function useReleasePolicy() {
  const installedVersion = Application.nativeApplicationVersion ?? '0.0.0';

  const query = useQuery({
    queryKey: ['release-policy', currentPlatform()],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('release_policy')
        .select('minimum_supported_version, recommended_version, features')
        .eq('platform', currentPlatform())
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
  });

  const policy = query.data;

  return {
    ...query,

    // Fail open. A server outage must not brick the app, so an unreachable
    // policy is treated as "you are current" rather than "you must update".
    mustUpdate:
      policy !== undefined &&
      compareVersions(installedVersion, policy.minimum_supported_version) < 0,

    shouldUpdate:
      policy !== undefined &&
      compareVersions(installedVersion, policy.recommended_version) < 0,

    // Unknown flags default to enabled so a client older than a flag keeps
    // working exactly as it did when it shipped.
    isFeatureEnabled: (name: string): boolean => {
      const features = policy?.features as Record<string, boolean> | undefined;

      return features?.[name] ?? true;
    },
  };
}
