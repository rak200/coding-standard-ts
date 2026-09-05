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
- [`coverageAnalysis: 'all'`, not `perTest`](#coverageanalysis-all-not-pertest)
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
| `reporters`        | `progress`, `clear-text`                    |

The threshold is never lowered to accommodate a survivor: a survivor is killed by strengthening the
test, or excluded at the narrowest possible node with its reason.

[↑ Back to top](#stryker)

---

## `coverageAnalysis: 'all'`, not `perTest`

Per-test coverage needs instrumentation Vitest does not provide in browser mode, so every mutant
reports zero covering tests and every mutant times out — measured: 24 of 25 "killed" by timeout,
none by an assertion, and a mutation score that means nothing. `all` still skips mutants in code no
test reaches, without needing per-test data.

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
