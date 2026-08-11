## What this changes and why

## Verification

Both must pass. Paste the output, do not summarize it. A change is done when it
has been executed, not when it has been written.

```
$ supabase test db

```

```
$ npx tsc --noEmit

```

## Checklist

- [ ] I read CONTRIBUTING.md.
- [ ] `supabase test db` and `npx tsc --noEmit` both pass, output pasted above.
- [ ] No hardcoded colours, sizes, or radii. Semantic tokens only, and any new
      value was added to `global.css` and `tailwind.config.js`.
- [ ] No hardcoded user-visible strings. Every one is a translation key,
      including accessibility labels, placeholders, and error text.
- [ ] Layout uses `ps-`, `pe-`, `ms-`, `me-`, `text-start`, `text-end`, never
      the left/right forms.
- [ ] ASCII only. No em dashes, curly quotes, arrows, or emoji. Lines under 100
      characters.
- [ ] Any screen this touches works on iOS, Android, and web.

## If this adds or changes a table

- [ ] RLS enabled, policies, and grants are all in the same migration that
      creates the table.
- [ ] One policy per operation, `to authenticated`, `auth.uid()` wrapped in a
      `select`, no `using (true)` on user data.
- [ ] A pgTAP test in `supabase/tests/` proves the negative case: a user who
      should not see the row gets zero rows.
- [ ] Types regenerated with `supabase gen types typescript --local`.
- [ ] No column that a shipped client reads was dropped, renamed, or narrowed.

## Anything you could not verify

Say it here rather than leaving it implied. A labelled assumption is a task. An
unverified assumption presented as fact is a bug with a delay fuse.
