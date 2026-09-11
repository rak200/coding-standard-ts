// This package's own mutation run, consuming the base config it publishes.
//
// One override of the globs, for the same reason vitest.config.js overrides its own: this
// package is JavaScript, and its product lives in `src/**/*.js` rather than the
// `src/**/*.ts` its consumers have. `bin/` is deliberately not mutated — it is argv, stdio
// and an exit code, driven from a child process that the runner cannot observe, so every
// mutant there would survive for want of a witness rather than for want of a test.
//
// THE RUNNER IS THE COMMAND RUNNER HERE, AND THAT IS NOT A PREFERENCE. The vitest runner
// instruments the mutants and then runs almost no test against them in this repository:
// measured on `master`, 89 mutants, `0.06 tests per mutant`, **5.62%** against a threshold
// of 100. The same suite under the command runner kills all 89 — `100.00`, zero survivors.
// The floor was being met the whole time and the instrument could not see it, which is the
// estate's own `looks green, enforces nothing` with the sign reversed: a gate that cannot
// pass is as useless as one that cannot fail, and it had already produced a proposal to
// weaken Layer 1 on the strength of a number that was wrong. rak200/coding-standard-ts#82
//
// `rak200/ui` keeps the vitest runner and must: there it works, at 170.05 tests per mutant
// in browser mode. So this belongs here and never in `stryker.base.js`, which every
// consumer inherits — the defect is this repository's, and so is the workaround.
//
// `coverageAnalysis: 'off'` is required by the command runner and is the cost: the whole
// suite runs per mutant rather than the tests that cover it. Measured at `--concurrency 2`,
// 89 mutants in 4m50s against the pipeline's 20-minute timeout, and a pull request mutates
// only what it changed.

import base from './stryker.base.js';

export default {
    ...base,
    mutate: ['src/**/*.js'],
    testRunner: 'command',
    commandRunner: { command: 'npx vitest run' },
    coverageAnalysis: 'off',
};
