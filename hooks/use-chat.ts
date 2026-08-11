import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/use-session';
import { threadsKey } from '@/hooks/use-threads';
import {
  ALREADY_READ,
  NOT_IN_STATE_SQLSTATE,
  RATE_LIMITED,
  RATE_LIMIT_SQLSTATE,
} from '@/lib/db-errors';
import type { Database } from '@/lib/database.types';
import type { ReactionCode } from '@/lib/reactions';

type MessageRow = Database['public']['Tables']['messages']['Row'];

export type MessageReaction = {
  user_id: string;
  reaction: string | null;
};

export type ChatMessage = MessageRow & {
  message_reactions: MessageReaction[];
  pending?: boolean;
};

export const messagesKey = (matchId: string) => ['messages', matchId] as const;

export function useMessages(matchId: string) {
  return useQuery({
    queryKey: messagesKey(matchId),
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select('*, message_reactions(user_id, reaction)')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });
}

export function useChatRealtime(matchId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: messagesKey(matchId) });
      void queryClient.invalidateQueries({ queryKey: threadsKey });
    };

    const channel = supabase
      .channel(`chat:${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        refresh,
      )
      // Reactions carry no match_id, so there is nothing to filter on and RLS
      // is the filter instead: only reactions inside the caller's own
      // conversations are ever forwarded.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        refresh,
      );

    let cancelled = false;

    // Realtime authorizes every change against the subscriber's own JWT. A
    // socket that has not been given one yet matches no rows, and the
    // subscription then receives nothing at all rather than failing, so this
    // has to happen before subscribe rather than alongside it.
    void supabase.realtime.setAuth().then(() => {
      if (!cancelled) {
        channel.subscribe();
      }
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [matchId, queryClient]);
}

export function useSendMessage(matchId: string) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (body: string) => {
      if (!userId) {
        throw new Error('Cannot send a message while signed out');
      }

      const { error } = await supabase
        .from('messages')
        .insert({ match_id: matchId, sender_id: userId, body });

      if (error) {
        if (error.code === RATE_LIMIT_SQLSTATE) {
          throw new Error(RATE_LIMITED);
        }

        throw error;
      }
    },

    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: messagesKey(matchId) });

      const previous = queryClient.getQueryData<ChatMessage[]>(messagesKey(matchId));

      const optimistic: ChatMessage = {
        id: `pending-${Date.now()}`,
        match_id: matchId,
        sender_id: userId ?? '',
        body,
        created_at: new Date().toISOString(),
        delivered_at: null,
        read_at: null,
        deleted_at: null,
        message_reactions: [],
        pending: true,
      };

      queryClient.setQueryData<ChatMessage[]>(messagesKey(matchId), (messages) => [
        ...(messages ?? []),
        optimistic,
      ]);

      return { previous };
    },

    onError: (_error, _body, context) => {
      if (context?.previous) {
        queryClient.setQueryData(messagesKey(matchId), context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: messagesKey(matchId) });
      void queryClient.invalidateQueries({ queryKey: threadsKey });
    },
  });
}

export function useUnsendMessage(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.rpc('unsend_message', { message: messageId });

      if (error) {
        if (error.code === NOT_IN_STATE_SQLSTATE) {
          throw new Error(ALREADY_READ);
        }

        throw error;
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: messagesKey(matchId) });
      void queryClient.invalidateQueries({ queryKey: threadsKey });
    },
  });
}

type ReactionInput = {
  messageId: string;
  code: ReactionCode | null;
};

export function useSetReaction(matchId: string) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({ messageId, code }: ReactionInput) => {
      const { error } = await supabase.rpc('set_reaction', {
        message: messageId,
        code: code ?? '',
      });

      if (error) {
        throw error;
      }
    },

    onMutate: async ({ messageId, code }) => {
      await queryClient.cancelQueries({ queryKey: messagesKey(matchId) });

      const previous = queryClient.getQueryData<ChatMessage[]>(messagesKey(matchId));

      queryClient.setQueryData<ChatMessage[]>(messagesKey(matchId), (messages) =>
        (messages ?? []).map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          const others = message.message_reactions.filter(
            (reaction) => reaction.user_id !== userId,
          );

          const mine = code === null ? [] : [{ user_id: userId ?? '', reaction: code }];

          return { ...message, message_reactions: [...others, ...mine] };
        }),
      );

      return { previous };
    },

    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(messagesKey(matchId), context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: messagesKey(matchId) });
    },
  });
}

// Delivered is set from the thread list as well as from the chat, because both
// prove the messages reached this device.
export function useMarkThread(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (state: 'delivered' | 'read') => {
      const rpc = state === 'read' ? 'mark_thread_read' : 'mark_thread_delivered';
      const { error } = await supabase.rpc(rpc, { thread: matchId });

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: threadsKey });
    },
  });
}
