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

    // `all` and `perTest` are the same run with this runner. The vitest runner never
    // reads the option: it collects coverage per test whatever the setting, and Stryker
    // then runs, for each mutant, only the tests that cover it — the whole suite for a
    // static one. Measured on rak200/ui, mutant by mutant: the same verdict and the same
    // covering tests under both. `off` is the one value that changes the run, and only
    // its cost: every mutant runs the whole suite.
    //
    // `all` rather than Stryker's default of `perTest`, because by Stryker's own
    // definition it asks a runner only whether a mutant is covered, not by which test —
    // so a runner that one day honours the option starts from the setting that asks less.
    coverageAnalysis: 'all',

    // **Vitest is held at 4 in this package's manifest, and this gate is why.** Against
    // Vitest 5, `@stryker-mutator/vitest-runner@10` runs ZERO tests per mutant in a
    // consumer whose suite is in browser mode, and reports every mutant as survived
    // without an error: the floor reads 0.00 and the pipeline stays green everywhere
    // else. Measured on rak200/ui, same file and same config — 36.85 tests per mutant
    // and 100.00 on Vitest 4, 0.00 and 33 survived on 5.0.1.
    //
    // This package's own suite runs in node and scores 100.00 on Vitest 5, so the break
    // is invisible from here. That is the trap rather than a mitigation: what this
    // package owes a consumer is a working verb, not a green run of its own.
    //
    // Ruled out rather than assumed: `vitest.related: false` does not restore it, and the
    // separator change upstream reports is present in 5.0.0 and 5.0.1 alike. There is no
    // released runner that fixes it — 10.0.0 predates the report.
    //
    // **The `overrides` entry in `package.json` belongs to this decision too.** The runner
    // declares its peer as `vitest: ">=2.0.0"`, unbounded above, so with the root at 4 npm
    // resolves that peer to 5, pulls in its own peers, and the resolver CRASHES —
    // `Cannot read properties of null (reading 'edgesOut')`, measured on npm 10.9.8, where
    // the same manifest at Vitest 5 resolves in thirteen seconds. The override says the
    // whole tree uses the Vitest this package declares, which is what the unbounded range
    // fails to say. It goes when the pin goes.
    //
    // Lift both when Stryker publishes a runner that drives Vitest 5, not when Vitest 5
    // merely looks stable: stryker-mutator/stryker-js#6210, with #6214 and #6220 open.
    // Dependabot will keep proposing the major and this package's own pipeline will keep
    // passing it, so refusing it is a reader's job until then.

    mutate: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts'],

    // The threshold is never lowered to accommodate a survivor: a survivor is killed by
    // strengthening the test, or excluded at the narrowest possible node with its reason.
    //
    // The asymmetry with the PHP side is real and stated rather than smoothed: Infection
    // has minCoveredMsi, a floor over covered code only, and Stryker has no covered-only
    // break threshold. TypeScript therefore enforces the stricter overall MSI, which a
    // repository built to this standard from day one can hold.
    thresholds: { high: 100, low: 100, break: 100 },

    // `json` for two readers, and the first is a gate. `rak200-mutate` reads the report back
    // after a run Stryker passed and refuses one that left a mutant ungraded: a `RuntimeError`
    // is out of the score entirely, so without this the floor can read 100.00 over mutants
    // nobody scored. The second is whoever has to find out which: `clear-text` prints how many
    // mutants errored in each file and not which ones, so without the report the answer lasts
    // only as long as the terminal that printed the count.
    //
    // A consumer that overrides `reporters` has to keep it, and `--reporters` on the command
    // line replaces this list rather than adding to it: the verb refuses a run with no report
    // at all, rather than reading its absence as a clean one.
    reporters: ['progress', 'clear-text', 'json'],
    tempDirName: '.stryker-tmp',
};
