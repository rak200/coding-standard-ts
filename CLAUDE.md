# CLAUDE.md

Guidance for Claude Code when working in this repository.

@.rak200/CONVENTIONS.md
@CONVENTIONS.md

> The second import is **local**: this repository *is* Layer 2. Everywhere else it reads
> `@node_modules/@rak200/coding-standard-ts/CONVENTIONS.md`, because npm does not install a
> package into its own tree. If `.rak200/` is empty, the clone skipped its submodule:
> `git submodule update --init --recursive`.

## What this repository is

The TypeScript half of the ecosystem baseline: five shared configurations — compiler, linter,
formatter, test runner, mutation engine — the `coverage-floor` binary that enforces the floor, and
the prose that documents every decision they carry. Consumers install it from git as a
`devDependency` and extend each config; the tools themselves are declared as `dependencies` so a
consumer cannot end up with the standard and not the tools.

Unlike the PHP half, it **does** ship source and a test suite (`src/coverage-floor.js`, `bin/`), so
its CI calls the TypeScript pipeline rather than the language-agnostic one.

## Architecture

```
eslint.base.js        # flat config, exported as @rak200/coding-standard-ts/eslint
tsconfig.base.json    # …/tsconfig
prettier.base.js      # …/prettier
stryker.base.js       # …/stryker
vitest.base.js        # …/vitest
src/coverage-floor.js # the coverage floor: parse, compare, report the ratchet
bin/                  # the `coverage` verb's entry point
tests/                # mirrors the units above, one test file each
```

**Four of the five are modules, and `tsconfig` is the exception** — because TypeScript's `extends`
resolves a package specifier and the other four tools' do not. A JSON config for one of those four
*replaces* this standard instead of extending it, silently, while `lint` stays green; the reason is
written out for Prettier in `CONVENTIONS.md` §Code style and it generalises. The `exports` map in
`package.json` is the public surface — a path not listed there is not consumable.

## Where the rules are

In the two imports above, in [README.md](README.md), and in each config file beside the line it
explains. This file restates none of them.
