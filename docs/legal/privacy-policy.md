# Privacy Policy

**Draft. Not yet reviewed by a lawyer, and not yet published.** Three items at
the bottom need a legal answer before this can go live. Everything else was
written from the code rather than from a template, and every claim in it is one
you can check against this repository.

Last updated: 12 August 2026
Applies to: OpenHeart, the app and openheart.app

---

## The short version

- You must be 18 or older.
- We never sell your data, and there is nothing to upsell you, so there is no
  commercial reason to collect more than the app needs.
- Your exact location never reaches our database. It is rounded to about a
  kilometre before it is stored, and other people are only ever told a rounded
  distance.
- Nobody is ever told who swiped which way on them.
- Deleting your account erases your personal data and keeps a blank row, so the
  people you talked to keep their own messages and a record of any report about
  you survives.

## Who we are

OpenHeart is a free, open source dating app funded by donations. The source
code, including every database policy described here, is public under the
AGPL-3.0 at https://github.com/aadeshrao123/openheart.

For anything in this policy, including a request about your data, write to
support@openheart.app. A person reads every message.

If you are in the UK or EU, this is where the data controller's registered
name and address go. That is one of the items still to be filled in.

## What we collect, and why

### You give us

| What | Why | Can you avoid it |
| :--- | :--- | :--- |
| Email address | To sign you in. There is no password. | No |
| Display name | Shown on your profile | No |
| Date of birth | The 18+ check. Set once and never editable. | No |
| Gender, who you are looking for | To show you relevant people, and them you | No |
| Bio | Your profile | Yes, leave it blank |
| Photos | Your profile | No, a profile needs one photo |
| A verification selfie | To prove there is a real person behind the profile | No, but see below |
| Distance, age range | Your search preferences | Defaults are used if you do not set them |
| Messages and reactions | To deliver them | Yes, by not sending any |
| Reports you file | So a moderator can act | Yes, by not filing one |

### Your device gives us

| What | Why |
| :--- | :--- |
| Approximate location | To show you people nearby |
| Time you were last active | To order results, so you see people who are actually around |
| App version | To tell you when a version is too old to be safe to run |
| Push notification token | To tell you about a match or a message, once notifications ship |

### We do not collect

No advertising identifiers. No tracking across other apps or websites. No
analytics SDK. No contacts, no calendar, no microphone, no health data. The app
declares no tracking in its App Store privacy manifest, and that is true because
there is nothing in the codebase that could do it.

## Location, specifically

This is the part most dating apps get wrong, so it is worth being exact.

Your coordinates are rounded to roughly one kilometre by a database trigger
before they are written. The precise value never lands in the table, which means
it can never leak from it, including to us.

Other users are never sent your coordinates at all. They are sent a distance,
and that distance is bucketed to five kilometres before it leaves the server.
Precise distances measured from a few different points can be combined to locate
a home address. That is a documented, real attack on dating apps, not a
hypothetical one, and the bucketing exists to defeat it.

## Photos, and how they become visible

A photo you upload is not visible to anyone until it has been checked.

1. Your app asks our server for a one-time upload link.
2. The photo lands in a private area that no user can read.
3. It is scanned, twice. Once by Amazon Rekognition for adult content, and once
   by the Canadian Centre for Child Protection's Arachnid Shield service, which
   compares it against a database of known child sexual abuse material.
4. Only if both pass does it become visible.

There is no "upload now, check later". A photo that fails is queued for deletion
from storage.

## Photo verification, and your face

To enter anyone's deck you take one selfie in a pose we choose at the moment you
start. We ask you to agree to this before the camera opens.

What happens to it:

- It is compared against the photos already on your profile, using Amazon
  Rekognition, to check they are the same person.
- Amazon documents these operations as stateless: they do not store the image
  and do not add you to any collection.
- We store the result, which is a pass, a fail, or a reason code such as "too
  dark". We do not store a similarity score, a face template, or any other
  measurement of your face.
- The selfie itself is queued for deletion as soon as the result is final.
- If the automated check is not confident, one of our moderators looks at the
  selfie and your profile photos, and the selfie is deleted once they decide. We
  do this rather than rejecting you automatically because face comparison is
  measurably less accurate on darker skin, and an automatic no would lock real
  people out unevenly.

Your selfie never appears on your profile and nobody you match with ever sees
it.

**If you are in the EU or UK**, this processing is biometric data used to
identify you, and we rely on your explicit consent, which is the agreement
screen shown before the camera opens. You can withdraw it by deleting your
account. **If you are in Illinois, Texas or Washington**, state biometric law
applies and the required written-consent and retention-schedule wording is one
of the open items below.

## Who else touches your data

These are processors. None of them is allowed to use your data for their own
purposes, and none of them is paid for your data.

| Who | What they handle | Where |
| :--- | :--- | :--- |
| Supabase | Database, sign-in, realtime messaging | To be confirmed at launch |
| Cloudflare | Photo storage and delivery (R2 and Images) | Western Europe |
| Amazon Web Services | Adult-content scan and the face comparison, via Rekognition | ap-south-1 |
| Canadian Centre for Child Protection | Abuse-material matching, via Arachnid Shield | Canada |
| Expo | Delivering push notifications, once they ship | United States |

Photos leave the EU for the two scans and for the Cloudflare origin. The
transfer mechanism is an open item below.

We do not use an analytics provider. If we ever add error reporting, it will be
listed here before it is switched on.

## How long we keep things

| What | How long |
| :--- | :--- |
| Your profile, while your account is open | Until you delete it |
| A verification selfie | Until the check finishes, then queued for deletion |
| A rejected photo | Queued for deletion immediately |
| Messages | While the conversation exists. See below. |
| Swipes | While your account is open |
| A report you file, or one about you | Kept after account deletion, see below |
| Suspension records | Kept after account deletion |
| Push notification tokens | Until you sign out or delete your account |

## Deleting your account

Settings, then Delete account. It is two taps and a confirmation, it is real,
and it happens immediately.

What it does:

- Erases your name, bio, gender, who you are looking for, your location and your
  date of birth.
- Queues every photo for deletion from storage.
- Ends every open conversation.
- Deletes your sign-in record, so the email address is gone.
- Removes your devices, so no notification can reach you afterwards.

What it deliberately does not do, and why:

- **The row is kept, blank, with only an identifier.** A hard delete would take
  every report about you with it, and deleting-then-re-registering is the
  standard way an abusive user erases their record.
- **Messages you sent are kept.** They are the other person's conversation as
  much as yours, and they can remove their own copy whenever they want. Neither
  of you can erase the other's.
- **A suspension is kept.** Leaving does not clear a moderation record.

If you believe the retained record should also be erased, write to us and say
so. We will weigh your request against the safety reason for keeping it, which
is what the law requires us to do rather than refusing outright.

## Blocking and reporting

If you block someone, they are not told. Your conversation closes on their side
in a way that is indistinguishable from an ordinary unmatch, and they keep the
history so that losing it is not itself a signal.

When you report someone, you choose whether to attach a snapshot of the messages
you are reporting. That snapshot is the only conversation content a moderator
can ever see. Moderators have no general access to anybody's messages.

## Your rights

If you are in the UK or EU, you have the right to access your data, correct it,
delete it, take it elsewhere, object to processing based on legitimate
interests, and complain to your data protection authority. If you are in
California, you have the right to know, delete, correct, and not be
discriminated against for asking. We do not sell or share personal information
as those terms are defined by the CCPA.

Write to support@openheart.app. We will answer within 30 days.

The legal grounds we rely on are: performing our contract with you, for running
the service; your consent, for location, camera and notifications; our
legitimate interest in keeping people safe, for moderation, blocking, reports
and abuse prevention; and legal obligation, for reporting child sexual abuse
material.

## Children

The app is 18+. The age gate runs before a profile is created and the date of
birth cannot be edited afterwards. If you believe a minor is using the app,
report the profile in the app or write to support@openheart.app and we will act
on it as a priority.

## Changes

We will post any change here and, if it is significant, in the app. The history
of this document is in the git repository, so you can see exactly what changed
and when.

---

## Open items before this can be published

These are flagged rather than hidden, because an unverified assumption that is
labelled is a task and one presented as fact is a liability.

1. **Controller identity.** A registered name and address for the data
   controller, and whether an EU or UK representative is required.
2. **The CSAM retention conflict, now the most urgent item here.** The scan is
   live and both verdicts have been exercised against the real service, so the
   app can now detect this material rather than merely being built to. The
   moment it does so on a real user's upload, a legal duty may attach.

   The Canadian Centre confirmed by email that Shield itself imposes no
   retention or reporting rules on a provider. So the duty, where one exists,
   comes from law rather than from them, and it differs by jurisdiction.

   The conflict is concrete: the REPORT Act amended 18 USC 2258A(h) to require a
   year's retention of reported material, and this pipeline currently queues a
   rejected photo for deletion in the same call that rejects it, then purges it
   from storage. That was verified end to end. If a preservation duty applies,
   the current behaviour destroys the thing the law says to keep.

   Nothing about that is a design decision to make here. A lawyer decides, and
   this document says what they decided.
3. **Biometric consent wording.** Illinois BIPA and the Texas and Washington
   equivalents require specific written consent and a published retention and
   destruction schedule. The app already asks for consent and already destroys
   the selfie; the wording has to be checked against the statutes.
4. **International transfer mechanism** for photos reaching AWS in India and the
   Canadian Centre in Canada, and the Supabase region once production exists.
