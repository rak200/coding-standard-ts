# `./vitest`

[← Reference](README.md)

The suite. A Vite config the consumer merges.

```js
// vitest.config.js
import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@rak200/coding-standard-ts/vitest';
export default mergeConfig(base, defineConfig({/* what to look at */}));
```

## Contents

- [What it sets](#what-it-sets)
- [The order a mutant's run takes](#the-order-a-mutants-run-takes)
- [Why clover](#why-clover)

---

## What it sets

Coverage — `provider: 'v8'`, `reporter: ['text', 'clover']`, `reportsDirectory: 'coverage'`,
including `src/**/*.ts` and excluding `.d.ts` and `.test.ts` — and the order a run scoped to some
source files takes, `sequence.sequencer`, which is the order every mutant's run takes.

Nothing else. What to run is the consumer's business, which is why this is merged rather than
spread. That includes browser mode: a repository with components turns it on in its own config, as
[CONVENTIONS.md](../CONVENTIONS.md) §_Testing_ requires, and that section says why nothing checks
it.

[↑ Back to top](#vitest)

---

## The order a mutant's run takes

**A mutant runs the test file that mirrors the mutated one first.** Stryker's vitest runner runs
each mutant as Vitest's `related` for the mutated file, with `bail: 1`, and a mutant the dry run
could not tie to a test runs every related file. That is every module-level mutant — in a component
library, most of them: the styles, the tokens, a theme's data — and through a barrel the related
files are nearly the whole suite. What a mutant costs is then the time until the first file that
kills it, and Vitest's own order runs the longest files first. `MirrorFirstSequencer` runs the
mirror first, then the files that failed the last time they ran, then the shortest. The tree
mirrors `src/`, so this needs no configuration.

**And `bail` stops a browser run on every run, not only the first.** Vitest 4 clears every cancel
listener when a run starts, and its browser pool registers its own once, when the pool is created.
From the second run in a process, a failure asks for a cancellation nobody hears, and the pool runs
every file it was given. The sequencer is built before the pool and sorts after the clearing, so it
registers again what the first run registered after sorting and never took back — the pool's own. A
browser session takes its listener back when its connection closes, and registered again it would
call the closed connection: an unhandled rejection that ends the worker. The node pool registers its
own on every run, so a suite outside a browser never needed this, and the sequencer leaves it as it
is.

Measured on rak200/ui, over the same 34 mutants and two workers:

| Order                            | Wall time   | Tests a mutant |
| -------------------------------- | ----------- | -------------- |
| Vitest's own                     | 19 min 52 s | 1,000          |
| the mirror first, `bail` unheard | 21 min 22 s | 967            |
| the mirror first, `bail` heard   | 2 min 47 s  | 77             |

Every mutant got the same verdict in all three. `bail` cuts a run short only after a failure, so
the order can change which test kills a mutant, never whether one does. A run with no scope —
`vitest run`, as every verb but `mutation` runs it — is sorted the way Vitest sorts it.

**The `bail` half goes when Vitest registers the browser pool's listener on every run.** Vitest 4.1.11
is the last 4, and this package holds Vitest at 4 for the reason [stryker.md](stryker.md) gives.

[↑ Back to top](#vitest)

---

## Why clover

[`coverage-floor`](coverage-floor.md) reads clover, and it is the same format the PHP side reads —
so one implementation of the floor serves both languages rather than two that can drift.

[↑ Back to top](#vitest)
