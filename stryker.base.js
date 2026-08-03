/**
 * Layer 2 (TypeScript) — the mutation floor. Consumed by a repository as:
 *
 *     // stryker.config.js
 *     import base from '@rak200/coding-standard-ts/stryker';
 *     export default { ...base };
 *
 * Named `stryker.base.js`, matching `vitest.base.js`, and NOT `stryker.config.js` —
 * which is what it was called until this package grew a suite of its own. Stryker
 * auto-loads `stryker.config.js` from the working directory, so inside this repository
 * the shipped config *was* the repository's config, silently: `stryker run` here read
 * the `mutate` globs written for consumers — TypeScript under `src/` — against a
 * package whose own source is JavaScript, matched nothing, and reported a clean run
 * over zero mutants. The export path `./stryker` is unchanged, so no consumer notices.
 *
 * A JavaScript module, and not the JSON this started as, because **Stryker has no
 * `extends`**. Given `{ "extends": "@rak200/coding-standard-ts/stryker" }` it logs
 * `Unknown stryker config option "extends"` at WARN, ignores the entire shared config,
 * and falls back to `thresholds.break: null` — which means *never fail the build*. The
 * first repository to use it ran a mutation score of 96 against a floor of 100 and
 * exited 0. A quality gate configured through a mechanism the tool does not have is a
 * quality gate that cannot fail.
 */

export default {
    testRunner: 'vitest',

    // NOT `perTest`, and this is the one that costs a day to find. Per-test coverage
    // needs instrumentation that Vitest does not provide in browser mode, so every
    // mutant reports zero covering tests and every mutant times out: 24 of 25 "killed"
    // by timeout, none by an assertion, and a mutation score that means nothing. `all`
    // still skips mutants in code no test reaches, without needing per-test data.
    coverageAnalysis: 'all',

    mutate: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts'],

    // The threshold is never lowered to accommodate a survivor: a survivor is killed by
    // strengthening the test, or excluded at the narrowest possible node with its reason.
    //
    // The asymmetry with the PHP side is real and stated rather than smoothed: Infection
    // has minCoveredMsi, a floor over covered code only, and Stryker has no covered-only
    // break threshold. TypeScript therefore enforces the stricter overall MSI, which a
    // repository built to this standard from day one can hold.
    thresholds: { high: 100, low: 100, break: 100 },

    reporters: ['progress', 'clear-text'],
    tempDirName: '.stryker-tmp',
};
