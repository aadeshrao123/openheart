# docs

Everything here is tracked and binding. `CLAUDE.md` at the repository root is
the overview; these are the details it refers to.

This directory exists because the rules used to live in `.claude/`, which is
gitignored, so a fresh clone got a file insisting the rules were binding and no
rules. Contributor tooling and agent configuration still belong in `.claude/`
and still are not tracked. Standards that bind everyone are here.

## Engineering standards

Read the relevant one before writing code in that area. They are not advisory.

| File | Covers |
| :--- | :--- |
| [coding-style](rules/coding-style.md) | formatting, comments, naming, no em dashes, ASCII only |
| [typescript-react](rules/typescript-react.md) | TS strictness, component tiers, tokens |
| [database](rules/database.md) | migrations, RLS policy form, security definer, invariants |
| [localization](rules/localization.md) | translation keys, plurals, RTL layout, Intl formatting |
| [client-compatibility](rules/client-compatibility.md) | schema as API, version gate, media |
| [verification](rules/verification.md) | no guessing: check APIs against primary sources |
| [git](rules/git.md) | commit messages, what never gets pushed, history rewriting |

The one that matters most if you only read one: `verification.md`. Three of the
security holes this project has shipped and fixed were found by executing an
assertion rather than reading the code, and none of them looked wrong on the
page.

## Legal

Both documents are **drafts pending legal review** and each ends with the
specific questions a lawyer has to answer. They are tracked so the published
site and the repository cannot disagree about what was promised.

| File | Covers |
| :--- | :--- |
| [privacy-policy](legal/privacy-policy.md) | what is collected, by whom, for how long |
| [terms-of-service](legal/terms-of-service.md) | age, conduct, moderation, no paid features |
| [store-data-disclosures](legal/store-data-disclosures.md) | answers for the store forms |

These three, `app.json`'s `expo.ios.privacyManifests`, and the schema all state
the same facts in four different formats. A change to what the app collects
touches all four in the same pull request, or one of them becomes a false
declaration.

## Elsewhere in the repository

| File | Covers |
| :--- | :--- |
| `CLAUDE.md` | the architecture, the stack, and the rules that decide arguments |
| `SETUP.md` | getting a local environment running from nothing |
| `TESTING.md` | what must be tested and how to run each suite |
| `CONTRIBUTING.md` | how to propose a change |
| `SECURITY.md` | how to report a vulnerability |
| `infra/README.md` | the exact commands that created the R2 bucket and IAM user |
| `supabase/functions/README.md` | what each Edge Function does and what it needs |
