import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// supabase.channel(topic) returns the *existing* channel when one with that
// topic is still registered, and removeChannel is asynchronous. Opening a chat,
// leaving and opening it again therefore handed back a channel that was already
// subscribed, and binding a listener to one of those throws:
//
//   cannot add `postgres_changes` callbacks after `subscribe()`
//
// which reached the root error boundary and replaced the screen.
//
// setAuth runs here too. Realtime authorizes every change against the
// subscriber's JWT, and a socket that has not been given one matches no rows
// and then receives nothing rather than failing, so it has to happen before
// subscribe rather than alongside it.
export async function freshChannel(topic: string): Promise<RealtimeChannel> {
  const stale = supabase.getChannels().find((channel) => channel.topic === `realtime:${topic}`);

  if (stale) {
    await supabase.removeChannel(stale);
  }

  await supabase.realtime.setAuth();

  return supabase.channel(topic);
}
