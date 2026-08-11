# Trying the app

Everything below runs against a local database. Nothing here can reach a real
account, and the fixture refuses to run against anything but localhost.

## Start it

Three terminals, or three background tabs.

```bash
supabase start
```

```bash
node scripts/dev-fixture.mjs
```

```bash
npx expo start
```

Then press `w` for the browser, `a` for an Android emulator, or scan the QR code
with Expo Go on a phone. iOS needs a Mac for the simulator; Expo Go on an iPhone
works from Windows.

The fixture prints what it made. It creates four real accounts:

| Account | For |
|---|---|
| `dev@test.dev` | the deck. 25 candidates nearby, two of whom already like it |
| `ava@test.dev` | chat |
| `ben@test.dev` | chat. Has already messaged Ava |
| `cleo@test.dev` | chat. Matched with both, has said nothing |

All three chat accounts are matched with each other, so there is a conversation
to open the moment you sign in.

## Sign in

The app never uses a password. It emails a six digit code, and locally that mail
is caught rather than sent.

1. Enter one of the addresses above and press continue.
2. Get the code:

```bash
node scripts/dev-fixture.mjs --code --email ava@test.dev
```

You can also read it by eye at http://127.0.0.1:54324, which is the local mail
catcher.

To be both sides of a conversation at once, sign in as Ava in a normal window
and as Ben in a private one. A session belongs to the browser profile, so two
tabs in the same window share one account and signing in again just replaces it.

## What to try

**The deck.** Home, then Browse people.

- Drag a card left or right. It follows your finger, tilts, and shows PASS or
  LIKE as you pass the commit point.
- Or use the Pass and Like buttons. They do exactly the same thing, on purpose:
  a deck that only works by dragging cannot be used with a screen reader.
- Swipe right on **Test Profile 1** or **Test Profile 2**. Both already like
  you, so the match screen appears. The match itself is made by a database
  trigger inside the same statement as the swipe, so two people swiping at the
  same moment cannot race.
- Tap a card to open the full profile.
- Filters, top right. Narrow the distance to 5 and apply: the deck is discarded
  and rebuilt, and most candidates disappear. Widen it again to get them back.
- Keep swiping to the end to see the empty state.

**Chat.** Home, then Messages. Best with two windows, as above.

- Ben's message is already waiting for Ava, with an unread count on the row.
  Opening the thread marks it read, and Ben's window shows that happen live.
- Send one back. The tick beside it goes from one to two the moment the other
  window has it, and both ticks brighten once it has been read. Hovering is not
  needed: each state is also announced to a screen reader.
- Tap or hold any message to react. Six reactions, one per person per message,
  and tapping the same one again clears it.
- Tap one of your own messages and remove it, **before the other side reads
  it**. After that the option refuses, because a message someone has already
  read is part of their conversation and not yours to erase.
- Tap the name at the top to open their profile, and from there unmatch or
  remove the conversation. Removing is per person: check the other window and
  the thread is still there.
- Nothing else can read any of it. Sign in as Cleo, who is matched with both,
  and the conversation is not visible anywhere.

**Profile and photos.** Home, then Edit profile or Photos.

- Date of birth is visibly locked. It is set once at signup and only a trigger
  can change it, because an age gate a user can edit is not a gate.
- Add a photo. It uploads to real Cloudflare R2 storage, gets checked for
  format, and then stops at "being reviewed", which is correct: photos cannot go
  live until a CSAM provider exists. Nothing in this build can approve one.
- Reorder and delete work. Deleting queues the object to be purged from R2.

**Settings.** Sign out and back in, and your profile is still there. Delete the
account and it is anonymized rather than dropped, so a conversation the other
person is part of survives with your name removed.

**The theme.** Change your system between light and dark with the app open. Every
colour in the app comes from `global.css`, so the whole thing repaints.

## What deliberately does not work

**A photo becoming visible.** There is no CSAM provider. Rekognition covers
adult content, and AWS states plainly that it does not detect CSAM, so the scan
composes both checks and fails closed without either. Nothing here can approve a
photo, which is the correct direction to fail.

**Photos on other people's cards.** Same reason, plus no delivery origin is
configured yet. Cards show an initial instead.

**Push notifications.** A new message only appears while the app is open. Push
needs an Expo project and APNs and FCM credentials that do not exist yet.

**Report and block.** Phase 6. Both exist in the database and neither is in the
UI yet.

**Sign in with Apple or Google.** Needs developer accounts that do not exist.
Email is the only method, and adding the others is an entry in a list.

## Resetting

Run the fixture again. It clears what it made and starts over.

```bash
node scripts/dev-fixture.mjs
```

The tests need an empty database. They assert exact row counts and use fixed
email addresses, so a loaded fixture makes several of them fail in ways that
look like a broken policy and are not.

```bash
supabase db reset --local && supabase test db --local
```

Then `supabase stop && supabase start` before seeding again, for the reason in
the next section.

## If sign-in email arrives as a link instead of a code

`supabase db reset` restarts the containers but does not re-read
`config.toml`, so the custom email templates are lost.

```bash
supabase stop && supabase start
```
