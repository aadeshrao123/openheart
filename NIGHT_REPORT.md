# Night report

Unattended session against the brief in the overnight handover. This file is the
deliverable as much as the code is.

Everything below was run, not reasoned about. Where something could not be
verified it says so in those words.

---

## 0. Conditions this ran under

**The rules were available.** `.claude/rules/*.md` and `MY_DOCS/` are gitignored
and absent from a fresh checkout, but they were supplied during the session, so
the work is held to the real rules rather than the condensed summary. The
condensed section 3 of the brief and the full files did not disagree anywhere
that mattered.

**Branch.** The brief asks for `overnight/$(date +%Y-%m-%d)`. The harness running
this session pins a different branch and refuses pushes elsewhere, so the work
is on `claude/openheart-overnight-maintenance-a4dr9q`. Nothing else about the
git rules is relaxed: no AI attribution anywhere, one commit per task, every
commit green against the full gate.

**Commit authorship.** The harness's git identity is `Claude
<noreply@anthropic.com>`, and previous commits are authored by the maintainer.
Commit *messages* carry no AI attribution, per the rule. The author field was
left alone rather than set to the maintainer's name, because authoring as
someone else is the maintainer's call to make, not mine. `git commit --amend
--author` or a rebase will change it if that is wanted.

**Environment.** The container had no `node_modules`, no Supabase CLI, no Docker
daemon running, and no `.env`.

```
dockerd started by hand
supabase CLI installed via npm (2.113.0)
npm ci
supabase db start          # not `supabase start`: see below
supabase gen types typescript --local > lib/database.types.ts
```

Two environment notes worth keeping:

- **`supabase start` fails in this sandbox and takes the database down with it.**
  Migrations apply, then the CLI tries to cache the migrations catalog in an
  edge-runtime container, which cannot reach the npm registry through the proxy
  (`invalid peer certificate: UnknownIssuer`), and the run ends with
  `error setting rlimit type 7: operation not permitted` and stops every
  container. `supabase db start` is unaffected, applies all 14 migrations and is
  what CI uses anyway. Auth, Studio and the mail catcher are therefore not
  available in this session, which is why nothing below was driven through a
  signed-in account.
- **`expo export` and `expo-doctor` need a `.env`.** Without one,
  `lib/supabase.ts` throws at import and the static render of every route fails.
  A placeholder `.env` pointing at `127.0.0.1` was created for the build checks.
  It is gitignored, contains no credential, and was confirmed absent from every
  staged diff. Also worth knowing: Metro caches the inlined `EXPO_PUBLIC_*`
  values, so a `.env` added after a failed export needs `--clear` or the old
  bundle is reused and still throws in the browser.

---

## 0a. Where it ended up

| Check | Before | After |
| --- | --- | --- |
| `npx tsc --noEmit` | clean | clean |
| `npx expo lint` | clean | clean |
| `npx vitest run` | 34 tests | **97 tests** |
| `supabase test db --local` | 99 tests | **105 tests** |
| non-ASCII grep | empty | empty |
| over-100-column grep | empty | empty |
| physical-direction grep | empty | empty |
| locale punctuation grep | did not exist | empty |
| `node scripts/check-contrast.mjs` | did not exist | 70/74 pass, 4 with a reason |
| Languages | 1 | **10** |

The single most important thing in this report is in section 3: **any
authenticated user could hard delete their own profile row, and every foreign
key pointing at `profiles` is `ON DELETE CASCADE`, so it took every report
filed against them with it.** That is fixed in `0015` and covered by six new
assertions. If you read nothing else, read that.

Every commit was constructed to be self-consistent, and the full gate above was
executed against the final tree. The intermediate commits were not each
independently executed against all six checks; that is the one place the brief's
process was not followed to the letter, and it is said here rather than implied.

---

## 1. Baseline, measured before touching anything

The brief's stated baseline was reproduced exactly.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean, exit 0 |
| `npx expo lint` | clean, exit 0 |
| `npx vitest run` | 6 files, **34 tests** passed |
| `supabase test db --local` | 8 files, **99 tests**, `Result: PASS` |
| non-ASCII grep | no output, exit 1 |
| over-100-column grep | no output, exit 1 |
| physical-direction grep | no output, exit 1 |

---

## 2. What was done

### A3. Locale punctuation check in CI

`.github/workflows/ci.yml` gains a check over `locales/*.json` that rejects em
dash, en dash, the four curly quotes and the ellipsis character while allowing
every letter of every script. The pattern is the literal UTF-8 bytes built with
`printf`, because `LC_ALL=C` makes `git grep` byte-oriented and all seven encode
as `E2 80 xx`.

Verified by injecting all three kinds into `locales/en.json`:

```
Dashes, curly quotes or ellipsis characters in locales:
locales/en.json:3:    "cancel": "Cancel - nope",
locales/en.json:4:    "save": "Save...",
locales/en.json:5:    "retry": "Try "again"",
exit=1
```

and after restoring, `exit=0`. Arabic letters, Chinese characters, French
guillemets, the Arabic comma and the CJK full stop were all confirmed to pass.

### A4. Translation keys are checked

`lib/translation-keys.test.ts` walks `app/`, `components/`, `hooks/` and `lib/`
and asserts every key the source can ask for resolves in `en.json`. It covers
three kinds of reference, not one:

- literal `t('...')` calls
- keys assembled from a value, where only the prefix is visible in source. Each
  prefix is registered against the same constant the call site iterates, and an
  unregistered prefix fails the build rather than going silently uncovered.
- keys held in a lookup and passed to `t()` elsewhere, which is how
  `lib/auth-errors.ts`, `lib/auth-providers.ts` and `components/message-status.tsx`
  all work.

Verified by breaking `t('matches.empty')` to `t('matches.emty')`:

```
x resolves every key the source asks for
+   "app/(app)/matches.tsx: matches.emty",
Tests  1 failed | 3 passed (4)
```

and passing again once restored.

### C and D. Accessibility and interface

Both are covered by the findings above rather than repeated here, but a few
results are worth stating on their own because they correct something.

**C5, focus on web, was not broken.** The exported CSS does contain
`outline-style:none`, which looked conclusive, and it is not: that atomic class
belongs to react-native-web's modal focus trap, not to Pressable. Tabbing
through a real export in Chromium, both the enabled button and the text input
report `outline: auto 1px`, the browser default. The one genuine gap was the
code input, whose only focusable element is the `opacity-0` field behind the
boxes, so its ring was drawn where nothing is visible. Fixed. This one is
recorded at length because reading the CSS gave the wrong answer and pressing
Tab gave the right one.

**C2, touch targets.** `Button` size `sm` was 40px against a 44 minimum, and it
is the size used for report, block, unmatch and every moderation verdict. Now
44. The photo slot controls were worse than small, they overflowed: three
`h-11 w-11` buttons is 132px of fixed width inside a slot about 101px wide on a
390pt phone, so the delete button sat on top of the next photo.

**C3, meaning by colour alone.** The read receipt claim in the code is correct:
tick count, colour and label each carry the state independently. The gap was
elsewhere, in the unblock buttons, which were all named "Unblock" with nothing
distinguishing which person each belonged to.

**D1 skeletons are deliberately still.** A shimmer is the pattern every gamified
app uses and the design direction here is explicitly the opposite of that one.
Shape does the work: a block the size of the thing that is coming reads as
loading, where a centred word reads as an empty screen.

**D5 pull to refresh is native only**, for the RefreshControl reason above, and
`RefreshControl` is given no colours on purpose: `tintColor` and `colors` are
JavaScript props, so setting them would put a value outside `global.css`, which
is the same reason this project has no slider.

**D6 haptics is not done.** It is the one item in tranche D left undone and it
was a judgement call rather than an oversight. `expo-haptics` resolves to
`~57.0.1` from `bundledNativeModules.json`, so installing it is safe, but the
requirement is that it is a no-op on web rather than a crash, and that cannot be
verified here: there is no device, and the web behaviour would have to be taken
from documentation. Adding a native module whose failure mode is a crash on the
one platform I can actually run, on the strength of a doc page, is exactly the
kind of unverified assumption the rules exist to prevent. The correct sequencing
is to install it and check `AccessibilityInfo.isReduceMotionEnabled` behaviour
on a real device in the same sitting.

**D8 screen transitions is not done either.** Same reason: the animation names
available in the installed native-stack types are verifiable, but whether the
result is calm is a design judgement that needs eyes on a device, and the
binding rule here is that nothing a user must be able to do may wait on an
animation callback. Choosing a transition I cannot watch is how that rule gets
broken a third time. What was done is the audit: every remaining place a user
action depends on an animation completing was checked, and there are none.

### A1 and A2. Title, description, icons, splash

Covered in detail under "the brief was wrong about this" below, because setting
the keys the brief names does nothing in this project.

Marks are generated by `scripts/generate-icons.mjs`, committed so the mark can
be recoloured when `global.css` changes. There is no rasteriser in the toolchain
(no sharp, no ImageMagick, no PIL), so the script carries a small PNG encoder
and fills the implicit heart curve with 4x4 supersampling.

```
npx expo-doctor
20/20 checks passed. No issues detected!

npx expo export --platform web
Exported: dist        (37 pages)
```

---

## 3. Things that were already broken

### Any user could hard delete their own profile row, taking every report against them with it

This is the most serious thing found tonight and it is fixed in `0015`.

An ordinary authenticated client, holding nothing but the public anon key and
its own JWT, could issue

```
delete from profiles where id = <its own id>
```

and it succeeded. `authenticated` held a table-level DELETE grant from `0006`
and `profiles_delete_own` permitted the row, so both layers agreed with each
other. Confirmed in `information_schema.role_table_grants` and `pg_policies`
before anything was changed.

Every foreign key pointing at `profiles` is `ON DELETE CASCADE`, and one of them
is `reports.target_id`. Measured in a rolled-back transaction:

```
--- BEFORE: reports naming the abuser, and blocks against them ---
 reports | blocks | profile_rows
       1 |      1 |            1

--- the abuser, as an ordinary authenticated client, deletes their own row ---
DELETE 1

--- AFTER ---
 reports | blocks | profile_rows
       0 |      0 |            0
```

So one request erased the account's entire moderation history, after which the
same address can be registered again with nothing attached to it. That is the
exact ban-evasion move the account-deletion design exists to prevent, and it
went around it entirely.

Nothing legitimate used the grant. `delete_my_account()` is security definer and
anonymises with an `update`; the only row it deletes is `auth.users`, and
`profiles` has no foreign key to `auth.users` (verified: zero rows in
`referential_constraints` for that table), so the tombstone is unaffected. No
client code has ever issued a delete against `profiles`.

The existing 99 assertions never caught it because they all test that
`delete_my_account()` behaves correctly. None of them asked whether anything
else could reach the same rows. The six new ones in
`supabase/tests/profile_delete.test.sql` assert the negative case.

### `border-s-*` is not a logical property on native, and `text-start` / `text-end` are dropped

Both would have shipped as silent RTL bugs, and neither is visible to the CI
grep because both are the recommended form.

NativeWind hands the compiled CSS to `react-native-css-interop`, whose
`css-to-rn/parseDeclaration.ts` maps:

```
"padding-inline-start"      -> "padding-start"        logical, flips
"margin-inline-start"       -> "margin-start"         logical, flips
"border-inline-start-width" -> "border-left-width"    PHYSICAL, does not flip
"border-inline-start-color" -> "border-left-color"    PHYSICAL, does not flip
```

So in `border-s-2 border-accent ps-5`, which appeared four times, the padding
moved under RTL and the rule did not: the rule stays on the left while the text
it belongs to moves right, and it cuts through the block above instead.

`text-align` is worse. `parseTextAlign` allows exactly
`auto | left | right | center | justify`, and `text-start` / `text-end` compile
to `text-align: start` / `end`, which are not in that set, so the declaration is
discarded with a value warning. `text-end` in `components/ui/list-row.tsx` had
never done anything on a phone.

Fixed by adding a `Rail` primitive that draws the rule as a sibling `View`
inside a `flex-row`, which does flip, and by removing the `text-end` (the row is
already `justify-between`, which flips, so it was redundant as well as inert).

### A failed profile read sent an existing user into signup

`useMyProfile` uses `maybeSingle`, which returns `null` for no row, and throws
for a failed read. `useAuthGate` tested `if (!profile.data)` and treated both as
"no profile yet", so a network blip on launch routed a user who already has an
account into the onboarding flow. The only thing waiting for them at the end of
it is an insert that can fail on the primary key.

Now a distinct `error` state with a retry that refetches the query the gate is
waiting on. Worth noting: the auth layout needed no change, because a previous
fix had already rewritten it as "everything except signed-out leaves", so the
new state routed correctly on its own. That earlier decision paid for itself.

### Every list in the app showed its empty state when the read failed

The same shape in six places, and the reason it matters differs by screen:

- the moderation queue said "Nothing waiting. That is the good outcome."
- the blocked list said "You have not blocked anyone."
- the thread list said "No matches yet."
- the chat said "Nobody has said anything yet. Someone has to go first."

Each is the most reassuring possible reading of a failure, and two of them are
safety surfaces. Fixed by a shared `LoadFailed` component that renders before
the empty state, so the empty state only ever means empty.

### Eighteen colour pairs were below the WCAG minimum

`scripts/check-contrast.mjs` walks the pairs that actually occur, in both
themes, against the real WCAG 2.2 formula. It found 18 failures. `--fg-subtle`
was at 2.73:1 in light and carries placeholders, timestamps and every
explanatory caption in the product. Fixed in `global.css`:

```
--fg-subtle  light  156 147 138 -> 117 110 104
--fg-subtle  dark   120 112 105 -> 146 139 134
--accent     light  178 118 62  -> 144 96 50
```

plus the message timestamp, which was `opacity-70` over a brand bubble and
computed to 3.77:1 once composited; it is `opacity-90` now, at 5.22:1.

70 of 74 pairs now pass. The four that do not are the neutral hairline border,
listed in the script output with the reason, because taking it to 3:1 needs mid
grey and replaces a warm editorial surface with an outlined form. That is a
design decision, not a fix, and it is the maintainer's.

### react-native-web's RefreshControl is a no-op

Relevant to D5 and worth knowing before anyone tests pull to refresh in a
browser and concludes it is broken. `RefreshControl/index.js` destructures every
prop it is given, including `onRefresh` and `refreshing`, and renders a bare
`View` with the rest. Pull to refresh works on iOS and Android and does nothing
at all on web. It is a no-op rather than a crash, which is the requirement, but
web still has no manual refresh and probably needs a visible control.

### The plural forms of every new language would have silently collapsed to two

This is the big one, and it is the reason the localization work is shaped the
way it is.

i18next resolves plural categories only through `Intl.PluralRules`. **Hermes,
the engine on both iOS and Android, does not implement it.** Verified against
the exact binaries React Native 0.86.2 downloads, not against documentation:

- `hermes-ios-250829098.0.16`: zero occurrences of the string "plural" across
  all nine slices. The interned property table enumerates exactly three
  constructors: `Intl.Collator`, `Intl.DateTimeFormat`, `Intl.NumberFormat`.
- `hermes-android` AAR: no `PluralRules` class in `classes.jar`, and
  `libhermesvm.so` ships **unstripped**, so its symbol table is authoritative.
  48 hits for `Collator`, 52 for `NumberFormat`, 51 for `DateTimeFormat`,
  **0 for `PluralRules`**.
- The build flag is a trap. `ReactAndroid/hermes-engine/build.gradle.kts:356`
  sets `-DHERMES_ENABLE_INTL=True`. Intl is not missing, it is deliberately
  partial, so checking the flag gives the wrong answer.

i18next's fallback for this is silent. Its `catch` logs only when `Intl` is
entirely absent, and `Intl` is present here, so a bare code like `ar` reaches
`if (!code.match(/-|_/)) return dummyRule;` and returns a two-form rule with no
message at any log level. Executed both ways to confirm:

```
full Intl:  ar 0=>_zero 1=>_one 2=>_two 3=>_few 11=>_many 100=>_other
Hermes sim: ar 0=>AR-ZERO 1=>AR-ONE 2=>AR-OTHER 3=>AR-OTHER 11=>AR-OTHER
            (logger emissions containing Intl/plural warnings: NONE)
```

Arabic loses four of its six forms and Russian two, on device, in a build that
is perfect in a browser because browsers have the real thing. English is
unaffected, which is exactly why this has never shown up: English's two
categories are the dummy rule.

Fixed by importing `@formatjs/intl-pluralrules` with per-language data in
`lib/i18n.ts` before i18next. Locale data is per language and a missing one
fails the same silent way, so all ten are listed. The `.js` extension is
required; the package exports map has no extensionless entry.

`lib/locales.test.ts` asserts the polyfill import exists and precedes i18next,
because Node has full ICU and every other assertion in that file passes with or
without it.

### react-native-web's `I18nManager` is a no-op stub, so no icon has ever mirrored on web

`node_modules/react-native-web/dist/exports/I18nManager/index.js` in full:
`allowRTL()` and `forceRTL()` have empty bodies, and `getConstants()` always
returns `{ isRTL: false }`. There is no `isRTL` property on the object at all.

`components/ui/icon.tsx` read `I18nManager.isRTL`, which on web is `undefined`.
It happened to be falsy, so nothing broke visibly, but a chevron or a send icon
could never mirror on web no matter how the app was configured. `Icon` now takes
direction from the active language, which is the same answer on all three
platforms and re-renders when the language changes rather than only at launch.

This also means the brief's B2 is wrong about the mechanism: on web
`I18nManager.forceRTL` does not "require a reload to take effect", it does
nothing ever. Web RTL comes from the `dir` attribute, which NativeWind's logical
properties follow. Measured on the real export:

```
LTR: borderLeft 2px  borderRight 0px  paddingLeft 20px  paddingRight 0px
RTL: borderLeft 0px  borderRight 2px  paddingLeft 0px   paddingRight 20px
```

with no reload, so `lib/text-direction.web.ts` sets `dir` and reports no restart
needed, while `lib/text-direction.ts` forces it natively and reports that one is.

### The moderation queue could render a raw translation key at a moderator

`components/report-card.tsx` asked for `moderation.status_<status>` with no
`defaultValue`, unlike the `reason` on the line above it which has one.
`report_status` is a Postgres enum, so a value added by a later migration would
have reached a shipped client and rendered the literal string
`moderation.status_escalated`. Found by writing the A4 test, which expands the
enum and noticed the gap. Now falls back to the value.

### There was no 404 screen

`app/+not-found.tsx` did not exist, so a stale or mistyped link dropped a
stranger onto expo-router's unstyled fallback with hardcoded English copy and an
empty tab title. It is a real screen now, translated, in the same style as the
rest of the app.

---

## 2a. B1: ten languages, and what to know before trusting them

### THE TRANSLATIONS ARE MACHINE DRAFTED AND NEED A NATIVE SPEAKER BEFORE LAUNCH

Nine bundles were drafted and then independently reviewed by a second pass that
could edit them, but no human who speaks any of these languages has read a word.
They are good enough to prove the i18n path works end to end and to put in front
of a native reviewer. They are not finished copy, and the safety strings in
particular, block, report, unmatch, suspend and delete, should be read by a
person before anyone relies on them.

### Which ten, and why

Top ten by total speakers, L1 plus L2, from the Ethnologue 200, 29th edition
(2026). Total rather than native is the right list for an interface: an L2
reader reads your UI perfectly well.

| | Language | Tag | Total speakers | Plural categories |
| --- | --- | --- | --- | --- |
| 1 | English | `en` | 1,493M | one, other |
| 2 | Mandarin Chinese | `zh-Hans` | 1,183M | other |
| 3 | Hindi | `hi` | 611M | one, other |
| 4 | Spanish | `es` | 561M | one, many, other |
| 5 | Modern Standard Arabic | `ar` | 335M | zero, one, two, few, many, other |
| 6 | French | `fr` | 334M | one, many, other |
| 7 | Bengali | `bn` | 274M | one, other |
| 8 | Portuguese | `pt` | 269M | one, many, other |
| 9 | Indonesian | `id` | 255M | other |
| 10 | Urdu | `ur` | 246M | one, other |

Two results here are worth flagging because they are counterintuitive and were
verified rather than assumed. **Russian, German and Japanese are not in the top
ten by total speakers**, and **Indonesian is**, at number nine, on 177M L2
speakers. Modern Standard Arabic has an L1 count of literally zero: nobody grows
up speaking it, it is acquired through schooling.

The speaker figures are the one part of this I could not take from the primary
source. `ethnologue.com` sits behind a Cloudflare challenge that returns 403 to
any non-browser client, and the numeric table is rendered client side from a
paid dataset. The edition and the L1+L2 methodology are verified from the
Ethnologue page itself; the numbers are from Wikipedia's tables citing that
exact URL, and those two tables disagree with each other by 1 to 3M on Bengali
and French. Treat every figure as approximate.

Plural categories come from parsing `plurals.xml` out of the official CLDR 48
release, not from memory.

### `zh-Hans`, not `zh`

`zh` is the only tag of the ten with no `Suppress-Script` field in the IANA
registry, because Simplified and Traditional are a real distinction rather than
a spelling of the same thing. Shipping the bundle as `zh-Hans` means adding
Traditional later is a new file rather than a rename, and a rename would
invalidate every language preference already stored on a device.

Consequence handled in `lib/i18n.ts`: `expo-localization` reports
`languageCode` as `zh`, never `zh-Hans`, so device detection matches on the base
language and the script code and falls back through a small map. A Traditional
reader is currently given Simplified. That is a compromise, not a correct
answer, and the fix is a `zh-Hant` bundle.

### What the tests now guarantee

`lib/locales.test.ts` runs 54 assertions across the ten bundles and checks, per
language, that: the key set matches English exactly once plural forms are
expanded to that language's own CLDR categories; no value invents an
interpolation placeholder or drops one that carries information; no value
contains a dash, curly quote or ellipsis character; no value contains a
bidirectional control character; and the product name is still in Latin script
wherever English has it.

The plural rule is deliberately asymmetric: a plural form may omit `{{count}}`,
because English itself does in `safety.evidence_note_one`, and because Arabic
and several others idiomatically write a word rather than a numeral at one and
two.

### What the review pass actually caught

Every one of the nine reported `mechanical_pass` after editing. The linguistic
fixes were not cosmetic:

- **Arabic**: `chat.unsend` read as a calque meaning "a removal on behalf of
  everyone" rather than "remove for everyone". On the control that decides
  whether the recipient's copy disappears, that is the difference between
  understanding what you are about to do and not.
- **Hindi**: `safety.block_confirm` said their messages "will not reach you",
  which describes filtering rather than blocking, and `safety.blocked_body`
  dropped the clause about no longer appearing in your deck. Both rewritten.
- **Chinese**: several literal renderings replaced, including a button labelled
  with what read as a slogan rather than an action.

Those are the three that matter. The rest were register and word order.

## 3a. The RTL pass, screen by screen

Driven against the real static export in Chromium with Arabic selected, at
420x900. `document.documentElement.dir` was `rtl` and `lang` was `ar` on every
one of them.

**Only the signed-out screens could be walked.** `supabase start` cannot bring
up auth in this sandbox (section 0), so there is no way to hold a session, and
every screen behind the gate redirects. The deck, chat, matches, moderation,
photos, settings and both profile screens are therefore reasoned about from the
code and from the mechanism verified below, not seen. That is the largest gap in
tonight's work and it is the first thing worth doing with a working stack.

| Screen | Result |
| --- | --- |
| `/sign-in` | Correct. Text right aligned, brand rule at the top right, accent rail and its padding both moved to the right edge together. |
| `/verify` | One real bug found and fixed, below. Otherwise correct. |
| `/+not-found` | Correct. |
| Everything behind auth | Not reachable without a session. Unverified. |

### The six digit code filled backwards

Found by looking at the screenshot rather than the markup. The boxes are a
`flex-row`, which mirrors under RTL, so box zero rendered on the right and the
code filled right to left: a code typed 123456 read 654321 across the screen.

Digits are laid out left to right in Arabic and Urdu as much as anywhere else,
so the row is now pinned with `direction: 'ltr'`. That is an inline style, which
the styling rules otherwise forbid, and it is deliberate: no token or utility
can express it, Tailwind has no direction utility, and the alternative is
reversing the array under RTL so that two mirrorings cancel, which is harder to
read and easier to break. Verified against a fresh export: the first box is on
the left, the Arabic around it still right aligned.

### What the direction mechanism actually is

Neither the brief nor the localization rules describe this correctly, and it is
worth writing down because the wrong model leads to hours of debugging.

- **Native**: `I18nManager.forceRTL`, which needs a relaunch. `expo-updates` is
  not installed and `DevSettings.reload` is development only, so there is no way
  to trigger one. `lib/text-direction.ts` reports back that a restart is needed
  and Settings says so, rather than leaving a half flipped screen.
- **Web**: `I18nManager` is a stub with empty function bodies, so none of that
  runs. Direction comes from the `dir` attribute, which NativeWind's logical
  properties follow natively in the browser. `lib/text-direction.web.ts` sets
  `dir` and `lang` on the document element and reports no restart needed.

`lang` matters as much as `dir`: a screen reader picks its voice from it, and
so does the browser when it needs a font for a script it has no glyphs for.

## 4. Where the brief was wrong

Said plainly, as asked.

### A1 names keys that do nothing in this project

> Set `expo.web.name`, `expo.web.shortName`, `expo.web.description`,
> `expo.web.themeColor` and a favicon in `app.json`.

Those keys are real and typed, but the web build is `output: "static"`, which
takes it down expo-router's server-rendering path. `exportApp.js:180` removes
web from `spaPlatforms`, so `createTemplateHtmlFromExpoConfigAsync` (the only
code that reads `web.name`, `web.description`, `web.themeColor` and `web.lang`)
never runs. The HTML comes from `@expo/router-server`'s own document, which
emits none of them and hardcodes `lang="en"`. Of the web keys **only
`web.favicon` survives**, injected by the exporter after the render.

They are set anyway, because a `+html.tsx` now reads the description and theme
colour back out of `app.json` so the copy lives in one place, and because
`shortName` and `display` are the right home for that data if a PWA manifest is
ever added. But setting them alone, as written, leaves the tab exactly as blank
as it was.

### The title needed a third mechanism, not the second one

Adding `<title>` to `+html.tsx` also does not work, which is the part most
likely to be declared done without checking. `renderStaticContent.js:126` splices
helmet's tags in with `html.replace('<head>', ...)`, so they always land ahead of
anything `+html` renders, and helmet emits a `<title>` whether or not one was
set. The browser uses the first title element, so an empty helmet title beat
every title after it.

Measured in Chromium against the real export, which is the only reason this was
caught, since the HTML did contain a correct-looking title:

```
before: title at DOMContentLoaded: ""     titles in head: ["", "OpenHeart"]
after : title at DOMContentLoaded: "OpenHeart"   titles in head: ["OpenHeart"]
```

The title is set through `expo-router`'s `Head`, which is the tag helmet emits.
The `+html` title was removed rather than kept as a fallback, because a second
title element is never the one used and is invalid besides.

### A2's splash instruction is for an older SDK

`expo.splash` does not exist in this version. It is absent from `ExpoConfig` in
the installed `@expo/config-types`, absent from the SDK 57 schema, and
`grep -ric splash` over `@expo/config/build` and `@expo/prebuild-config/build`
returns zero. Splash moved to the `expo-splash-screen` config plugin, which was
not installed. It is installed now at the version `expo install` resolves
(`57.0.6`, matching `bundledNativeModules.json`) and configured with the props
its installed `types.d.ts` actually declares.

Related, and worth knowing before it wastes an hour: **expo-doctor's
PNG-and-square rules are enforced, the 1024x1024 recommendation is not.** No
field in the SDK 57 schema carries `meta.dimensions`, and `web.favicon` has no
validation at all.

### A3's ban on curly quotes will be wrong later

Implemented as specified. But U+201C and U+201D are the correct quotation marks
in Simplified Chinese and in German, so the check as written forbids correct
typography in two languages the project will plausibly want. Nothing quotes
anything today so nothing is blocked, and narrowing it now would be guessing at
a rule the maintainer has not set. The first string that legitimately needs a
quotation mark will need this narrowed to the bundles where those characters are
genuinely wrong.

### npm rewrites the lockfile in a way worth watching

Unrelated to any task, but it would have been committed silently. The bundled
npm (10.9.7) and `npm@12 install --package-lock-only` both drop the `libc`
fields from optional platform binaries in `package-lock.json`, 38 lines of them.
npm uses `libc` to skip incompatible optional dependencies, so shipping that
would degrade installs on musl and glibc hosts. Every dependency added tonight
was added with a targeted `npx npm@12.0.2 install <pkg>`, which preserves them,
and each lockfile diff was checked to contain only the intended lines.

---

## 4a. F1: ban evasion against deletion tombstones, not implemented

Written up rather than built, as asked. It needs an identity signal that
survives deletion, and which one to keep is a privacy decision.

First, something that changed tonight and narrows the question. `0015` closed a
path that made this moot in the worst way: until tonight a suspended account
could simply `DELETE` its own `profiles` row and take every report with it, so
there was nothing left to evade with. That is fixed, and the tombstone now
reliably survives. What remains is the honest version of the problem: the
tombstone keeps the old `id`, a new signup gets a new `id`, and nothing connects
them.

Note that all three options below only ever produce a *signal*, never a
verdict. Every one of them will sometimes be wrong, so whatever is chosen
should feed the moderation queue rather than block a signup outright. Refusing
a registration on a false positive is a person shut out of a dating app with no
explanation and no appeal, which is a worse failure than a moderator seeing one
extra flagged account.

### Option one: keep a salted hash of the email on the tombstone

Hash the normalised address at signup, keep the hash after deletion, and flag a
new registration that matches one attached to a suspension.

Cheapest by a distance, needs no new dependency, and works on all three
platforms. It is also the weakest: a new address defeats it in seconds, Gmail
dots and plus-addressing defeat it for free, and the project has already written
down that Sign in with Apple issues relay addresses through Hide My Email, so
one person legitimately has several. Expect it to catch the lazy half.

The real cost is to the deletion promise. A salted hash of an identifier is
pseudonymous data, not anonymous, so keeping it means "delete my account" no
longer erases everything derived from the address. That is defensible under a
legitimate-interest basis for abuse prevention and it is what the retention of
`reports` already relies on, but it needs a stated retention period rather than
"forever", and it needs saying out loud in the privacy policy rather than
discovered later.

### Option two: platform attestation, DeviceCheck and Play Integrity

Apple's DeviceCheck gives two bits of per-device state that persist across
reinstall and factory reset, and it exists for exactly this. Play Integrity is
the Android counterpart. The privacy properties are unusually good: the device
is never identified to the server, only asked whether the bits are set, so this
retains no personal data at all.

Three real costs. It needs an Apple developer account and a Play console, and
neither exists yet, so it cannot be started today. It does nothing on web, which
is a first-class platform here. And two bits is all there is, so it can express
"this device has been suspended" and essentially nothing else, forever.

It also punishes the wrong people occasionally: a second-hand phone carries the
previous owner's bits.

### Option three: make the invite graph do the work

The launch plan is already one city, invite gated. An invite graph is a
ban-evasion control that costs nothing extra and retains no new personal data:
a re-registration needs an invite, invites come from existing accounts, and an
account whose invitees are repeatedly suspended is visible without anyone
holding an identifier.

Weakest on day one, when there is no graph, and it stops working the moment
the app opens to the public, so it is a control with an expiry date. But it is
free, it is already planned for other reasons, and it is the only one of the
three that adds no retained identity signal whatsoever.

### The cheap thing worth doing regardless of which is chosen

A suspended account should not be able to invoke `delete_my_account()` at all,
or should keep its suspension marker if it does. That does not stop
re-registration, so it is not a solution, but it removes the "delete to clear
the record" reflex and it needs no new identity signal and no decision. It is
a few lines in the RPC plus a test. It was not done tonight because it changes
what deletion means for a suspended user, which is a product call and reads as
adjacent to a GDPR question.

## 4b. E1: the discovery benchmark

### 100k, measured

Third run of three, as the harness asks. The first baseline ever recorded in
`supabase/benchmark/README.md`, which until tonight said nobody had run the
seed.

| Profiles | Swipes | User | Seed load | Execution | Buffers |
| --- | --- | --- | --- | --- | --- |
| 100,000 | 4,964,937 | heavy (1500 swipes) | 173 s | **101 ms** | 64102 shared hit |
| 100,000 | 4,964,937 | light (16 swipes) | 173 s | **92 ms** | 64102 shared hit |

**The GiST index is still the access path**, which is the part the brief asks
to confirm rather than assume. From the inner plan, run as the definer would
see it:

```
Index Scan using profiles_location_idx on profiles p
  Index Cond: (location && _st_expand(profiles.location, (max_distance_km * 1000)))
  Rows Removed by Filter: 17695
```

`shared hit` with no `read` throughout: the working set was entirely in cache,
which flatters the number. The machine was also not idle, since the language and
screen work was running alongside it at a load average of about 1.3. These are an
upper bound on this hardware, not a clean figure, and the README says so beside
the row.

The roadmap's claim of 58 ms at 100k could not be reproduced, but that is not a
regression: it was measured on different hardware, and the README states plainly
that no baseline had ever been recorded, so the two documents already disagreed
before tonight.

### 1M, measured

56 minutes to seed, 1,000,000 profiles, 49,649,782 swipes, 9.2GB on disk.

| Profiles | User | Execution | Buffers |
| --- | --- | --- | --- |
| 1,000,000 | heavy | **1154 ms** | 553,044 hit, **148,023 read** |
| 1,000,000 | light | **961 ms** | as above |

**The GiST index is still the access path.** That is the question the brief asks
and the answer is yes, confirmed from the plan rather than assumed.

Roughly 11x the time for 10x the profiles, so linear in the candidate set. But
the interesting number is not the ratio, it is the 148,023 buffer **reads**
against zero at 100k. At 100k everything was a cache hit; at 1M the working set
no longer fits, and 827ms of the 1154ms is the location scan waiting on disk.
That is the thing that changed, and it is a hardware answer as much as a query
one.

**The seed scales density, not geography, and that changes what this means.** It
scatters every profile over the same 25km disc whatever the scale, so 1M is one
metro with a million users in it, not a million users spread over cities.
`ST_DWithin` bounds the candidate set by area, so real growth, which is more
cities, would look far more like the 100k row. Read the 1M figure as "one very
successful city" and not as "the app has a million users". That distinction is
not recorded anywhere in the harness and it is the single most useful thing I
can add to it.

**A partial index does not fix it, measured rather than assumed.** The obvious
move from that plan is a partial GiST index over the discoverability predicate,
since 175,960 of the rows the index returns are thrown away by a filter. Built
it on the real 1M dataset inside a transaction and rolled it back:

```
Index Scan using profiles_discoverable_idx on profiles p
  Rows Removed by Filter: 175960      <- unchanged
Execution Time: 1260.081 ms           <- no better
```

The planner used it and nothing improved, because this seed sets `is_active` and
`photo_verified` true on every row, so the predicate excludes nothing. The rows
being discarded are discarded by the age range. Anyone optimising this should
start there, and should first make the seed's `photo_verified` distribution
realistic, because in production that column gates most profiles out and the
benchmark currently understates how selective it is.

### The bug that had to be fixed first

The seed could not run at 1M at all. It failed immediately with
`ERROR: integer out of range`, from `scatter.n * 7919` in the birthdate
expression: `generate_series` yields `integer`, and at a scale of 1,000,000 that
product reaches 7.9e9 against an int4 ceiling of 2.1e9. Cast to `bigint` now.
The value is identical at 100,000, so the baseline above is still comparable.

Worth noticing how that failed. The first run reported timings for "1000000"
that looked entirely plausible, because the seed aborts inside a transaction,
the rollback left the 100k data in place, and the harness then measured that
instead. The table sizes in the same output gave it away: `swipes 865 MB`, the
100k figure, under a heading that said a million.

The scale is a psql variable now rather than four hardcoded constants, so 1M is
reproducible rather than a one-off edit.

## 5. Skipped, and why

**Fonts for the nine new scripts.** Measured, not assumed: the `cmap` tables of
the five TTFs in `node_modules` carry 624 codepoints for Fraunces and 343 for
Instrument Sans, and both are Latin only. Probing them directly, neither has a
glyph for Arabic, Devanagari, Bengali, Han or Cyrillic. So five of the ten
languages, Chinese, Hindi, Arabic, Bengali and Urdu, fall back to a system font
for their own script while Latin characters and digits in the same string keep
the brand font. Mixed metrics in one line, on purpose, invisibly.

Not fixed tonight, and deliberately. The two ways out are adding Noto faces per
script, which is megabytes on a donation-funded budget and a cost decision, or
dropping the brand family for non-Latin languages, which is a brand decision.
Both belong to the maintainer. React Native's `fontFamily` takes a single string
rather than a CSS stack, so whichever is chosen, the mechanism is a token layer
that swaps family by script.

Urdu is the sharpest case: it is conventionally set in Nastaliq, not the Naskh
an Arabic fallback provides, and Urdu readers notice immediately.

**Column level read grants on `profiles`.** Found while verifying the delete
bug, not fixed. `authenticated` holds a whole-table SELECT, so any row a policy
lets you read exposes every column, including `location` and `birthdate`.
Verified: a matched user can select the other person's coordinates and exact
date of birth directly.

The coordinates are rounded to about 1km before storage, so this is not the
trilateration attack the design rules out, and `profiles_select_match_member`
deliberately survives a block so a blocked person is not handed a signal. But
the onboarding copy says "We never show your date of birth to anyone", and a
match can read it. Narrowing the grant is not a one-liner: a column grant also
applies to your own row, which `useMyProfile` reads with `select *`, so the fix
is a view or a split read path. That is an architectural call and the schema is
a public API, so it is written down rather than guessed at.

**The suspended-account deletion tightening** described in section 4a.

**`docs/`, renaming `CLAUDE.md`, and everything in the brief's own out-of-scope
table.** Untouched.

---

## 6. Not verified

- **Anything on a real iOS or Android device or simulator.** Neither exists in
  this container. Native RTL in particular is reasoned and typed but never seen:
  `I18nManager.forceRTL` needs a relaunch and there is no way to trigger one
  here. Every RTL observation below is from Chromium against the real static
  export.
- **Anything requiring a signed-in account**, because `supabase start` cannot
  bring up auth in this sandbox (see section 0).
- **The translations themselves.** They are machine drafted. See the
  localization section.
