# Store data disclosures

Both stores ask the same questions in different words, and both treat a wrong
answer as a compliance problem rather than a typo. This is the prepared set, to
be pasted into the consoles when the developer accounts exist.

Every answer below was derived from the schema and the Edge Functions, not from
a template. If a future change adds a column or a vendor, this file changes in
the same pull request or it becomes a false declaration.

Cross-check before submitting: this must agree with `docs/privacy-policy.md` and
with `expo.ios.privacyManifests` in `app.json`. Three copies of the same facts
is not ideal, and it is what both stores require.

---

## The two answers that decide everything else

**Do you or your third parties use data for tracking?** No.

There is no advertising SDK, no analytics SDK, no attribution SDK, and no
advertising identifier anywhere in the codebase. `NSPrivacyTracking` is false
and `NSPrivacyTrackingDomains` is empty, which is checkable rather than claimed.

**Is data encrypted in transit?** Yes. Every request is HTTPS, and photo objects
are fetched from Cloudflare over TLS.

---

## Apple: App Privacy ("nutrition label")

Answer "Yes, we collect data from this app", then declare exactly these.

Nothing below is used for tracking or for third-party advertising. Every entry
is linked to the user's identity, because a dating profile is an identity by
definition, and pretending otherwise would be the wrong answer.

| Data type | Category | Purpose | Linked | Tracking |
| :--- | :--- | :--- | :--- | :--- |
| Email address | Contact Info | App Functionality | Yes | No |
| Name | Contact Info | App Functionality | Yes | No |
| Coarse Location | Location | App Functionality | Yes | No |
| Photos or Videos | User Content | App Functionality | Yes | No |
| Other User Content | User Content | App Functionality | Yes | No |
| Sensitive Info | Sensitive Info | App Functionality | Yes | No |

Notes for the reviewer field, and the reasoning behind the awkward ones:

- **Coarse Location, never Precise.** The app requests precise location from the
  operating system, and a database trigger rounds it to about one kilometre
  before the value is stored. What is collected, in the sense the label asks
  about, is coarse. Declaring Precise would be inaccurate in the other
  direction, and this is worth one sentence in the review notes so it does not
  look like an attempt to under-declare.
- **Sensitive Info** covers three things this app really does hold: sexual
  orientation, inferable from gender plus who the user is looking for; the date
  of birth used for the age gate; and the face comparison performed during photo
  verification.
- **Other User Content** is bios, messages and reports.
- **Photos or Videos** includes the verification selfie, even though it is
  destroyed once the check finishes. It is collected at the moment it is
  uploaded, and the label asks about collection.
- **User ID and Device ID are deliberately absent.** The account identifier is
  not exposed for any purpose beyond running the service, and no device
  identifier is read. Once push notifications ship, the Expo push token is a
  device identifier and **Device ID must be added here** with App Functionality
  as its purpose. That is the one entry this table will need.

### Age rating

18+. Answer the questionnaire as: unrestricted web access No; user-generated
content Yes, with moderation; frequent or intense mature or suggestive themes
Yes; dating Yes. Under Apple's current rating system this lands at 18+, which is
the intended and correct outcome for a dating app.

### Guideline 1.2 checklist, which reviewers apply to any app with UGC

| Requirement | Where it is |
| :--- | :--- |
| Filter objectionable material first | Two scans, before a photo is visible |
| Report offensive content, promptly | Report action on every profile and chat |
| Block abusive users | Block action on every profile and every chat |
| Published contact information | Settings, Help, Contact us |

### Guideline 5.1.1(v), account deletion

Settings, Delete account. Two taps, an on-screen confirmation of what is
erased, immediate. Not a deactivation and not an email request. State in the
review notes that deletion anonymizes rather than dropping the database row, and
say why: reports about an account have to outlive it, or deleting and
re-registering erases the evidence trail.

---

## Google Play: Data safety

Play asks, per data type, whether it is **collected**, whether it is **shared**,
whether collection is **optional**, and why.

Nothing here is *shared* in Play's sense. Play defines sharing as transfer to a
third party, and explicitly excludes transfers to a service provider processing
on your behalf. Supabase, Cloudflare, AWS and the Canadian Centre for Child
Protection are all processors, so every "shared" answer is No.

| Play data type | Collected | Shared | Optional | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| Personal info: Name | Yes | No | No | App functionality |
| Personal info: Email address | Yes | No | No | App functionality, Account management |
| Personal info: User IDs | Yes | No | No | App functionality, Account management |
| Personal info: Sexual orientation | Yes | No | No | App functionality |
| Personal info: Other info (date of birth) | Yes | No | No | App functionality, Fraud prevention |
| Location: Approximate location | Yes | No | No | App functionality |
| Photos and videos: Photos | Yes | No | No | App functionality |
| Messages: Other in-app messages | Yes | No | No | App functionality |
| App activity: Other actions | Yes | No | No | App functionality |

Play asks two extra questions the Apple label does not:

- **Is the data encrypted in transit?** Yes.
- **Can users request that data be deleted?** Yes, and there is an in-app route.
  Play also wants a **web deletion URL** for users who no longer have the app
  installed. That page does not exist yet and is listed as an open item below.

Notes on the entries that need care:

- **User IDs** is Yes here where Apple's User ID is No, because Play's
  definition covers any account identifier. The two consoles genuinely differ;
  this is not an inconsistency to fix.
- **Sexual orientation** is its own Play type. It is inferable from gender plus
  who the user is looking for, so it is declared rather than argued about.
- **Approximate location, not Precise**, for the same reason as Apple.
- **Other actions** covers swipes and last-active timestamps.
- Once notifications ship, the Expo push token is a **Device or other IDs**
  entry. Add it in the same change that adds the client registration.

### Additional Play declarations for this app

- **Content rating (IARC questionnaire):** dating app, user-generated content,
  users can interact and share location. Expect Mature 17+ or the local
  equivalent.
- **Target audience and content:** adults only. Do not opt into any families or
  teacher-approved programme.
- **App access:** reviewers cannot sign up without an email code, so provide
  working test credentials and note that a profile must have an approved photo
  and pass verification before the deck shows anyone.
- **Photo and video permissions declaration:** the app uses the photo picker for
  profile photos and the camera for the verification selfie. Both are declared
  with the one-time-use justification.
- **Health apps and financial features:** not applicable, answer No.

---

## Open items

1. **A web account-deletion page.** Play requires a URL where someone who has
   uninstalled the app can request deletion. It needs to exist before submission
   and it is not built.
2. **Device ID and Device or other IDs entries**, in both consoles, in the same
   change that ships push notifications.
3. **Confirm the Supabase production region**, because the privacy policy names
   it and this file's processor list has to agree.
4. **Data safety answers are per release.** Anything that adds a column, a
   permission or a vendor changes this file too.
