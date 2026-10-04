# `./stryker`

[← Reference](README.md)

The mutation floor. A module the consumer spreads.

```js
// stryker.config.js
import base from '@rak200/coding-standard-ts/stryker';
export default { ...base };
```

## Contents

- [What it sets](#what-it-sets)
- [Why `coverageAnalysis` is `all`](#why-coverageanalysis-is-all)
- [Why a module and not JSON](#why-a-module-and-not-json)
- [The asymmetry with the PHP side](#the-asymmetry-with-the-php-side)

---

## What it sets

| option             | value                                       |
| ------------------ | ------------------------------------------- |
| `testRunner`       | `vitest`                                    |
| `coverageAnalysis` | `all`                                       |
| `mutate`           | `src/**/*.ts`, minus `.d.ts` and `.test.ts` |
| `thresholds`       | `{ high: 100, low: 100, break: 100 }`       |
| `reporters`        | `progress`, `clear-text`, `json`            |

The threshold is never lowered to accommodate a survivor: a survivor is killed by strengthening the
test, or excluded at the narrowest possible node with its reason.

**`json` is not optional in a consumer that runs the verb**: `rak200-mutate` reads the report back and
refuses a run that left a mutant ungraded, or that wrote no report at all —
[rak200-mutate.md](rak200-mutate.md) says why.

[↑ Back to top](#stryker)

---

## Why `coverageAnalysis` is `all`

With this runner, `all` and `perTest` are the same run. `@stryker-mutator/vitest-runner` never reads
the option and collects coverage per test whatever it says, and Stryker then runs, for each mutant,
only the tests that cover it — the whole suite for a static one. Measured on rak200/ui: two files,
45 mutants, and under both values every mutant got the same verdict and the same covering tests,
each one killed by an assertion.

`off` is the one value that changes the run, and only its cost: every mutant runs the whole suite.

`all` is set rather than left to Stryker's default of `perTest` because, by Stryker's own
definition, it asks a runner only whether a mutant is covered, not by which test. If a runner ever
starts to honour the option, the standard is already on the value that asks less of it.

[↑ Back to top](#stryker)

---

## Why a module and not JSON

**Stryker has no `extends`.** Given `{ "extends": "@rak200/coding-standard-ts/stryker" }` it logs
`Unknown stryker config option "extends"` at WARN, ignores the entire shared config, and falls back
to `thresholds.break: null` — which means _never fail the build_. The first repository to use it ran
a mutation score of 96 against a floor of 100 and reported success.

The file is named `stryker.base.js` and not `stryker.config.js` for a neighbouring reason: Stryker
auto-loads `stryker.config.js` from the working directory, so inside this package the shipped
config _was_ this package's config, silently. The export path `./stryker` is unchanged.

[↑ Back to top](#stryker)

---

## The asymmetry with the PHP side

Infection has `minCoveredMsi`, a floor over covered code only. Stryker has no covered-only break
threshold, so TypeScript enforces the stricter **overall** MSI. It is real, and stated rather than
smoothed: a repository built to this standard from day one can hold it.

[↑ Back to top](#stryker)
