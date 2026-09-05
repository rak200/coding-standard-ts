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
- [Why clover](#why-clover)

---

## What it sets

Coverage only — `provider: 'v8'`, `reporter: ['text', 'clover']`, `reportsDirectory: 'coverage'`,
including `src/**/*.ts` and excluding `.d.ts` and `.test.ts`.

Nothing else. What to run is the consumer's business, which is why this is merged rather than
spread.

[↑ Back to top](#vitest)

---

## Why clover

[`coverage-floor`](coverage-floor.md) reads clover, and it is the same format the PHP side reads —
so one implementation of the floor serves both languages rather than two that can drift.

[↑ Back to top](#vitest)
