# Deleting your account

Google Play requires a page like this one: a way to ask for your account to be
deleted that works from a browser, without installing anything, and without
asking anyone for permission.

Last updated: 13 August 2026
Applies to: OpenHeart, the app and openheartapp.org

---

## The short version

- Open the app, go to **Settings**, then **Delete my account**. It takes effect
  immediately and nobody has to approve it.
- If you cannot reach the app, write to support@openheartapp.org from the email
  address on the account.
- Your name, photos, date of birth, bio and location are erased.
- Messages you already sent stay in the other person's conversation with your
  name removed, because those are also their messages.
- Safety records survive deletion. Deleting an account has never been a way to
  erase a report about it.

## Doing it yourself, in the app

1. Sign in.
2. Settings.
3. Delete my account.
4. Confirm.

There is no waiting period, no retention window, and no offer to keep your
account instead. The deletion runs in the database as a single operation and it
cannot be undone.

## Doing it by email

Write to support@openheartapp.org from the address you signed in with. Say that
you want the account deleted. We reply from a human, and the only thing we need
is confirmation that the request comes from the account holder, which is what
sending from that address establishes.

Nothing else is required, and we will not ask for identification.

## What is erased

Immediately, when you confirm:

| Data | What happens |
|---|---|
| Display name | Erased |
| Date of birth | Erased |
| Bio | Erased |
| Gender and who you were looking for | Erased |
| Location | Erased |
| Photos | Removed from the database and queued for deletion from storage |
| Push notification tokens | Deleted, so the device stops receiving anything |
| Sign-in credential | Deleted, so the email or provider login no longer works |
| Open matches | Closed, on both sides |

## What is kept, and why

Deleting an account here is anonymisation rather than removal of the row. That
is a deliberate decision, and these are the reasons.

**Messages you sent.** They stay in the conversation of the person you sent
them to, with your name removed. They are that person's messages as much as
yours, and letting one participant erase the other's history would be a
harassment tool.

**Reports and moderation records.** If somebody reported you, that report
survives. Deleting and re-registering is the standard way to evade a ban, and a
safety record that a ban evader can erase is not a safety record.

**A blank profile row.** The row itself is kept so that the messages and reports
above still have something to point at. It holds no personal data after
deletion: the fields in the table above are empty or null, and a flag records
that the account is deleted.

**Suspension records.** If the account was suspended, that stays too, for the
same reason as reports.

## How long the photo deletion takes

Photos are removed from the database the moment you confirm, so no one can see
them again from that point. The image files themselves sit in a queue and are
deleted from storage by a scheduled job. Expect them to be gone within seven
days.

## If you never had an account

Nothing to do. This page describes deleting an OpenHeart account, and if you
never created one there is nothing about you in the database.

## Questions

support@openheartapp.org, and the code that performs the deletion is
`delete_my_account()` in the public repository, which anybody can read.

## Open items

- Confirm with a lawyer that keeping a blank profile row, message history and
  moderation records after a deletion request satisfies GDPR Article 17,
  specifically the 17(3) exemptions relied on here.
- Confirm the seven day figure once the purge job is actually scheduled. It is
  currently the target, not a measured number.
