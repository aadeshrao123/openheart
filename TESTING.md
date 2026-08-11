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

The fixture prints what it made. It creates `dev@test.dev`, gives it a profile
in central London, seeds 25 candidates around the same point, and makes two of
them like you already, so a match can be seen without a second device.

## Sign in

The app never uses a password. It emails a six digit code, and locally that mail
is caught rather than sent.

1. Enter `dev@test.dev` and press continue.
2. Get the code:

```bash
node scripts/dev-fixture.mjs --code
```

You can also read it by eye at http://127.0.0.1:54324, which is the local mail
catcher.

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

**Chat.** Phase 5. The match screen has no message button, because a button that
goes nowhere is worse than one that is absent.

**Report and block.** Phase 6. Both exist in the database and neither is in the
UI yet.

**Sign in with Apple or Google.** Needs developer accounts that do not exist.
Email is the only method, and adding the others is an entry in a list.

## Resetting

Run the fixture again. It clears what it made and starts over.

```bash
node scripts/dev-fixture.mjs
```

Before running the tests, clear the seed. `discovery.test.sql` asserts an exact
candidate count and the seeded profiles break it, which looks like a failing
policy and is not.

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "delete from profiles where id::text like 'deadbeef-%';
   delete from auth.users where id::text like 'deadbeef-%';"

supabase test db --local
```

## If sign-in email arrives as a link instead of a code

`supabase db reset` restarts the containers but does not re-read
`config.toml`, so the custom email templates are lost.

```bash
supabase stop && supabase start
```
