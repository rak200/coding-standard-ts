// Layer 2 (TypeScript) — the suite. Consumed by a repository as:
//
//     import { defineConfig, mergeConfig } from 'vitest/config';
//     import base from '@rak200/coding-standard-ts/vitest';
//     export default mergeConfig(base, defineConfig({ /* what to look at */ }));
//
// Coverage reports clover because the floor binary reads clover — the same format the
// PHP side reads, so one implementation of the floor serves both languages.

import { defineConfig } from 'vitest/config';

import { MirrorFirstSequencer } from './src/sequencer.js';

export default defineConfig({
    test: {
        // The order a run scoped to some source files takes — which is every mutant's run: the
        // test file that mirrors the mutated one first, and a failure that stops the run on
        // every run rather than on the first. `src/sequencer.js` carries the measurement; a run
        // with no scope is sorted as Vitest sorts it.
        sequence: { sequencer: MirrorFirstSequencer },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'clover'],
            reportsDirectory: 'coverage',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.d.ts', 'src/**/*.test.ts'],
        },
    },
});
