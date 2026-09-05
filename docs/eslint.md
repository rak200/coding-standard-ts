# `./eslint`

[← Reference](README.md)

Type-aware linting. A flat-config array the consumer spreads and extends.

```js
// eslint.config.js
import base from '@rak200/coding-standard-ts/eslint';
export default [...base, { ignores: ['dist/**'] }];
```

## Contents

- [The preset](#the-preset)
- [Why ESLint and not a faster linter](#why-eslint-and-not-a-faster-linter)
- [What it excludes, and why](#what-it-excludes-and-why)

---

## The preset

`eslint.configs.recommended`, then typescript-eslint's `strictTypeChecked` and
`stylisticTypeChecked` — the strictest consolidated pair it publishes — then
`eslint-config-prettier` **last, always**, which turns off every rule that would argue with the
formatter.

Type-aware rules need a program. `parserOptions.projectService` builds one from the consumer's own
`tsconfig.json`, so this file never names one.

[↑ Back to top](#eslint)

---

## Why ESLint and not a faster linter

PHPStan at `level: max` is a type-aware analyser. Matching that bar in TypeScript means rules that
read the type checker, which Biome and oxlint do not have. Speed is not the axis being optimised.

[↑ Back to top](#eslint)

---

## What it excludes, and why

Config files — `*.js`, `*.mjs`, `*.cjs`, `**/*.config.js` — get `disableTypeChecked`. They are
JavaScript, they are not the product, and type-aware linting of them buys nothing.

It is also the only thing that works. `projectService` cannot find `eslint.config.js` or
`vitest.config.js` in the consumer's program — they are not under `include` — and
`allowDefaultProject` does not help, because its globs resolve against a `tsconfigRootDir` that a
config living in `node_modules` cannot know.

**No `files` or `ignores` are set here.** What to look at is the consumer's business, and a path
baked into a shared config resolves against the installed package rather than the consumer.

[↑ Back to top](#eslint)
