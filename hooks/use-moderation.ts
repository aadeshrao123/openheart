import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/use-session';
import type { Database } from '@/lib/database.types';

export type Report = Database['public']['Functions']['list_reports']['Returns'][number];
export type ReportStatus = Database['public']['Enums']['report_status'];

export const reportsKey = (includeResolved: boolean) =>
  ['reports', includeResolved] as const;

// Read off the JWT rather than asked of the server. app_metadata is admin-only
// in GoTrue, verified: a client PUT of it returns 403 not_admin. This only
// decides whether to render the screen, and list_reports checks again anyway.
export function useIsModerator(): boolean {
  const { data: session } = useSession();
  const metadata: unknown = session?.user.app_metadata;

  if (typeof metadata !== 'object' || metadata === null) {
    return false;
  }

  return (metadata as Record<string, unknown>).moderator === true;
}

export function useReports(includeResolved: boolean) {
  const isModerator = useIsModerator();

  return useQuery({
    queryKey: reportsKey(includeResolved),
    enabled: isModerator,
    queryFn: async (): Promise<Report[]> => {
      const { data, error } = await supabase.rpc('list_reports', {
        include_resolved: includeResolved,
      });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });
}

type Resolution = {
  reportId: string;
  verdict: Exclude<ReportStatus, 'pending'>;
  note?: string;
  suspend?: boolean;
};

export function useResolveReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reportId, verdict, note, suspend }: Resolution) => {
      const { error } = await supabase.rpc('resolve_report', {
        report: reportId,
        verdict,
        note: note?.trim() || undefined,
        suspend: suspend ?? false,
      });

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useLiftSuspension() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase.rpc('lift_suspension', { target: targetId });

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
