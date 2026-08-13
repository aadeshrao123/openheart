# Verification Rules

Nothing in this codebase is written from memory. Every version number, API
signature, config key, and platform requirement is checked against a primary
source before it is committed.

---

## Never guess

If you are about to write any of the following, verify it first:

- a package version
- an API method name or its arguments
- a config file key
- a platform rule (App Store, Play Store, GDPR)
- a pricing figure
- a claim about what a library does

"I am fairly confident" is not verification. Model training data goes stale,
and a plausible wrong answer is more expensive than a lookup.

## What counts as a source

In descending order of authority:

1. The actual code in `node_modules/`, or the tool's own `--help` output.
2. Official documentation for the exact version in use.
3. The library's GitHub repository: source, README, CHANGELOG, release notes.
4. An official blog post or migration guide from the maintainers.

These do not count: blog posts by third parties, Stack Overflow answers without
a date, tutorials, AI-generated summaries, or anything that does not state which
version it applies to.

## Verify locally before reaching for the web

Cheaper, faster, and specific to what is actually installed:

```bash
npm view <package> version          # latest published
npm ls <package>                    # what is actually installed
npx expo-doctor                     # Expo compatibility check
supabase --version
```

Reading the installed source in `node_modules/<pkg>/dist/index.d.ts` beats any
documentation, because it is the code that will actually run.

## Versions are resolved, never remembered

Do not write a version number into documentation or a config file from memory.
Let the tooling pin it:

```bash
npx expo install <package>     # resolves the version matching the Expo SDK
```

`expo install` exists precisely because hand-picking versions breaks React
Native builds in ways that surface at runtime on one platform only.

When documentation must mention a version, write the command that produces it
rather than the number itself.

## Cite the source in the code

When a non-obvious rule comes from a specific source, name it in a comment so
the next reader can re-verify instead of re-deriving:

```sql
-- Wrapped in a select so the planner evaluates this once as an initPlan
-- instead of per row.
-- supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
using ((select auth.uid()) = id)
```

## Report uncertainty instead of smoothing over it

If something could not be verified, say so plainly in the PR description or the
commit message. An unverified assumption that is labelled is a task. An
unverified assumption that is presented as fact is a bug with a delay fuse.

## Claims about the running system need evidence

Do not report that something works. Run it and paste what happened.

```bash
supabase test db                    # RLS policies actually deny what they claim
npx tsc --noEmit                    # types actually compile
npx expo start                      # app actually boots on ios, android, web
```

A change is done when it has been executed, not when it has been written.
