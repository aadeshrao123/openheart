// Which conversation is on screen right now, or null.
//
// Read by the notification handler in hooks/use-push.ts, which runs outside the
// component tree and so cannot use a hook or read the router. A module level
// value is the whole mechanism, and it is enough: there is only ever one chat
// open, and the handler only ever asks which one.
//
// Deliberately not Zustand. Nothing renders from this, and putting it in the
// store would invite a component to subscribe to it and re-render a
// conversation every time a notification arrived.

let openChat: string | null = null;

export function setActiveChat(matchId: string | null): void {
  openChat = matchId;
}

export function isActiveChat(matchId: string): boolean {
  return openChat === matchId;
}
