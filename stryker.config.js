// This package's own mutation run, consuming the base config it publishes.
//
// One override, for the same reason vitest.config.js overrides its globs: this package
// is JavaScript, and its product lives in `src/**/*.js` rather than the `src/**/*.ts`
// its consumers have. `bin/` is deliberately not mutated — it is argv, stdio and an
// exit code, driven from a child process that the runner cannot observe, so every
// mutant there would survive for want of a witness rather than for want of a test.

import base from './stryker.base.js';

export default {
    ...base,
    mutate: ['src/**/*.js'],
};
