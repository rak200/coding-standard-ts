// Layer 2 (TypeScript) — the suite. Consumed by a repository as:
//
//     import { defineConfig, mergeConfig } from 'vitest/config';
//     import base from '@rak200/coding-standard-ts/vitest';
//     export default mergeConfig(base, defineConfig({ /* what to look at */ }));
//
// Coverage reports clover because the floor binary reads clover — the same format the
// PHP side reads, so one implementation of the floor serves both languages.

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['text', 'clover'],
            reportsDirectory: 'coverage',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.d.ts', 'src/**/*.test.ts'],
        },
    },
});
