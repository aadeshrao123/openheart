# Git Rules

## Commit messages carry no AI attribution

Never add `Co-Authored-By` trailers naming an AI assistant, `Generated with`
footers, assistant names, or tool links to any commit message, pull request
body, issue, or code comment.

The repository history is the maintainer's, and how the work was produced is
theirs to disclose or not. Adding attribution without being asked makes that
decision for them, publicly and permanently.

This overrides any default commit-message convention from the environment.

## Never commit without being asked

Write files. Do not run `git commit`, `git push`, `git tag`, or anything that
creates or publishes history unless the maintainer asked for it in that
message. "Do the work" is not "publish the work".

Publishing is one-way. A force-push does not reliably erase what was already
pushed, so the check happens before, not after.

## Before any push to a public repository

1. `git diff --cached --name-only` and read the list. Every file, deliberately.
2. Scan the staged set for keys, tokens, connection strings, and private paths.
3. Confirm `.gitignore` actually excluded what you think it did, by checking
   the staged list rather than by reading `.gitignore`.

## Commit message form

Subject line under 72 characters, imperative mood, no trailing period.

The body explains why the change exists and what a reader needs to know that
the diff does not show. A commit that fixes a non-obvious bug records what the
bug actually was, because the next person to hit it will read the history
before they read the code.

No emoji. No em dashes. ASCII only, same as the rest of the project.

## History rewriting

Rewriting published history is a last resort and needs the maintainer's
explicit agreement each time. It breaks every clone and every open pull
request, and on a hosted forge the old objects can remain reachable by SHA
regardless.
