// This package's own suite, consuming the base config it publishes.
//
// Two overrides, both because this package is not the shape of the packages it
// configures. It is JavaScript rather than TypeScript, and its product lives in `src/`
// as `.js`, so the base config's `src/**/*.ts` globs match nothing here. And it runs in
// Node rather than a browser: there is no DOM to drive, only a file to read.
//
// Coverage measures `src/` alone. `bin/` is argv, stdio and an exit code, exercised by
// tests/cli.test.js in a child process — which the instrumentation cannot see, and
// counting it as uncovered would misreport a file that is in fact tested.

import { defineConfig, mergeConfig } from 'vitest/config';

import base from './vitest.base.js';

export default mergeConfig(
    base,
    defineConfig({
        test: {
            environment: 'node',
            include: ['tests/**/*.test.js'],
            coverage: {
                include: ['src/**/*.js'],
                exclude: [],
            },
        },
    }),
);
