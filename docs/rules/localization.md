# Localization Rules

Every user-visible string is translatable from the first commit. Retrofitting
i18n means touching every screen twice, and RTL layout in particular cannot be
bolted on later without a full visual pass.

Stack: `expo-localization` reads the device locale, `i18next` plus
`react-i18next` resolves strings, and the built-in `Intl` API formats dates,
numbers, and units. No date library.

Sources:
https://docs.expo.dev/guides/localization/
https://reactnative.dev/docs/i18nmanager

---

## No hardcoded strings

Any string a user can read comes from a translation key.

```tsx
<Text>No matches yet</Text>              // bad
<Text>{t('matches.empty')}</Text>        // good
```

This includes accessibility labels, placeholder text, error messages, alert
titles, and empty states. Those are the ones that get missed.

It does not include: log messages, error messages thrown for developers,
analytics event names, or test fixtures.

## Never build a sentence from fragments

Word order differs between languages. A sentence assembled in code can only
ever be correct in the language it was assembled for.

```tsx
// Bad: unfixable in any language that puts the verb elsewhere
<Text>{t('you_matched')} {name}</Text>

// Good: the translator controls the whole sentence
<Text>{t('matches.new_match', { name })}</Text>
```

Same rule for the reverse case: do not concatenate a translated fragment onto a
number, a date, or a distance. Interpolate it.

## Plurals use i18next suffixes, never a ternary

```tsx
// Bad: wrong in Polish, Russian, Arabic, and Welsh, among others
<Text>{count === 1 ? '1 match' : `${count} matches`}</Text>

// Good
<Text>{t('matches.count', { count })}</Text>
```

```json
"count_one": "{{count}} match",
"count_other": "{{count}} matches"
```

i18next selects the form using `Intl.PluralRules`, so a language with six plural
categories gets six keys and the calling code never changes.

## Keys are namespaced by feature and describe meaning

`matches.empty`, `safety.block_confirm`, `chat.unread`.

Not `text1`, not `noMatchesYet`, and never the English text itself as the key.
Keys named after their English content stop making sense the moment the English
copy is edited.

Namespaces mirror the feature folders, so a contributor knows where a string
lives without searching.

---

## RTL is not optional

RTL is enabled by default and follows React Native's `I18nManager`, so the app
flips automatically when the device is set to Arabic, Hebrew, Persian, or Urdu.
That only helps if the layout uses logical properties.

### Use start/end, never left/right

| Never | Always |
|---|---|
| `pl-4` `pr-4` | `ps-4` `pe-4` |
| `ml-2` `mr-2` | `ms-2` `me-2` |
| `text-left` `text-right` | `text-start` `text-end` |
| `left-0` `right-0` | `start-0` `end-0` |
| `rounded-l-*` `rounded-r-*` | `rounded-s-*` `rounded-e-*` |
| `flex-row-reverse` to fix RTL | nothing, the framework handles it |

Symmetric utilities such as `px-4` and `mx-2` are fine and preferred.

`flex-row` already reverses under RTL. Writing `flex-row-reverse` to compensate
produces a layout that is broken in one direction or the other.

### Directional icons must mirror

Back arrows, chevrons, and send icons point the other way in RTL. Non-directional
icons such as a heart or a camera must not flip.

### Test it

Enable an RTL language on the device or simulator and walk the main flows.
`I18nManager.forceRTL` requires an app restart to take effect, so a hot reload
will show a misleading half-flipped state.

---

## Formatting comes from Intl, never from code

Use the helpers in `lib/format.ts`. Do not write a date format string, a
thousands separator, or a unit suffix by hand.

- `formatDistance()` handles metric and imperial, because a user in the US
  expects miles and a user in Germany expects kilometres.
- `formatRelativeTime()` produces "3 days ago" in the user's language via
  `Intl.RelativeTimeFormat`.
- `formatDate()` handles the day/month ordering that differs between locales.

`Intl` ships with Hermes and every browser, so this costs no bundle size.

---

## What is never translated

User-generated content: display names, bios, and messages. Store and render
them exactly as written. Do not machine-translate them, and do not assume a
name is in the app's current language.

## Text must be free to grow

German and Finnish routinely run 30% longer than English. Never fix a width to
fit an English string, never truncate a label without a way to see the full
text, and let buttons size to their content.

## Adding a language

1. Copy `locales/en.json` to `locales/<code>.json` and translate the values.
2. Add the code to `SUPPORTED_LANGUAGES` and `resources` in `lib/i18n.ts`.

Nothing else changes. If adding a language requires touching a component, that
component has a hardcoded string in it.
