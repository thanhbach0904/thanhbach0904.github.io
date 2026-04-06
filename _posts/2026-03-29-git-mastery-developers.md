---
layout: post
title: "Git is 20 years old and most developers still use 5% of it"
date: 2026-03-29
tag: technical
description: "The most ubiquitous tool in software development is also among the least understood. Here is what you are probably missing."
read_time: 6
image: /assets/images/placeholder-technical2.jpg
---

Git was released in 2005 by Linus Torvalds over a weekend to manage the Linux kernel. Two decades later, it underpins virtually all professional software development. And yet surveys consistently find that most developers' Git vocabulary consists of six commands: `clone`, `pull`, `add`, `commit`, `push`, and — when things go wrong — a prayer.

This is a shame. Git's deeper features address exactly the problems that slow teams down.

## Interactive rebase: your history is a draft

Commits, for many developers, are immutable once created. They are not. `git rebase -i` allows you to reorder, squash, split, and reword commits before they become part of shared history.

```bash
# Rewrite the last 5 commits interactively
git rebase -i HEAD~5
```

The practical benefit is enormous. You can work messy (committing frequently, with rough messages) and present clean (a logical sequence of well-described changes) before pushing. Code review becomes dramatically easier when the history tells a coherent story.

## Bisect: binary search for bugs

When a bug exists in the current codebase but not in a version from three months ago, the cause is somewhere in hundreds of commits. `git bisect` automates a binary search:

```bash
git bisect start
git bisect bad                  # current version is broken
git bisect good v2.1.0          # this version worked
# Git checks out the midpoint commit; you test and mark good/bad
# Repeats until the culprit commit is identified
```

This can narrow hundreds of commits to the guilty one in 7–8 steps. It is one of the most underused features in daily development.

## Worktrees: multiple branches simultaneously

The standard workflow requires stashing or committing before switching branches. `git worktree` allows you to check out multiple branches into separate directories simultaneously — useful when you need to test something on `main` without disturbing your feature branch.

```bash
git worktree add ../hotfix-branch hotfix/critical-fix
```

## The lesson

Git's complexity is a feature, not a bug. Investing a day in understanding it properly — rebase, bisect, worktrees, the reflog — will pay dividends across every project you work on for the rest of your career.
