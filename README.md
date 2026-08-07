# @rak200/coding-standard-ts

[![Latest tag](https://img.shields.io/github/v/tag/rak200/coding-standard-ts?sort=semver)](https://github.com/rak200/coding-standard-ts/tags)
[![node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-6.0-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Layer 2 of the rak200 baseline, for TypeScript**: the enforcing configuration and the prose that
documents it, versioned together so a repository cannot have one without the other.

Layer 1 — versioning, commits, the pipeline shape, testing and documentation _policy_, repository
hygiene — is language-agnostic and lives in
[rak200/workflow](https://github.com/rak200/workflow), imported alongside this package.

## Install

```bash
npm install --save-dev github:rak200/coding-standard-ts#0.1.0
```

Not published to npm: the ecosystem's tooling resolves from git, the same way the PHP standard
resolves as a Composer VCS package. The registry is for artifacts outside consumers need — see
`rak200/ui` — not for the configuration that builds them.

It brings the compiler, linter, formatter, test runner, browser driver, mutation engine and the
coverage-floor binary with it, so a repository's `devDependencies` cannot drift from its siblings'.
Those tools are declared under `dependencies` rather than `devDependencies`, deliberately: npm does
not install a dependency's dev dependencies, so declaring them there would ship a standard that
enforces nothing.

## Use

```js
// eslint.config.js
import base from '@rak200/coding-standard-ts/eslint';
export default [...base, { ignores: ['dist/**'] }];
```

```jsonc
// tsconfig.json
{
  "extends": "@rak200/coding-standard-ts/tsconfig",
  "include": ["src", "tests"],
}
```

```js
// vitest.config.js
import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@rak200/coding-standard-ts/vitest';
export default mergeConfig(base, defineConfig({/* what to look at */}));
```

```js
// stryker.config.js
import base from '@rak200/coding-standard-ts/stryker';
export default { ...base };
```

```js
// prettier.config.js
export { default } from '@rak200/coding-standard-ts/prettier';
```

```markdown
<!-- CLAUDE.md -->

@.rak200/CONVENTIONS.md
@node_modules/@rak200/coding-standard-ts/CONVENTIONS.md
```

**Every shared config is a module, and only TypeScript's is not.** ESLint, Vitest, Stryker and
Prettier share configuration only through a JavaScript module a consumer imports; none of their
JSON forms has a working `extends` that resolves a package. Stryker ignores the key with a WARN
and silently disables its own threshold; Prettier has no such key at all, so a consumer's JSON
file simply replaces this one. `tsconfig.json` is the exception — its `extends` resolves a package
specifier natively — which is why `tsconfig.base.json` stays JSON.

**The consumer owns _what to look at_, every time.** No `files`, `include`, `ignores` or `paths`
are set in any shared config here — a relative path in a shared config resolves against the file
that declares it, which is inside the installed package. The PHP standard shipped that mistake in
two configs and both were unusable in the first repository that imported them.

## What it fixes in place

| Config               | The decision it carries                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| `eslint.config.js`   | `strictTypeChecked` + `stylisticTypeChecked`, then `eslint-config-prettier` |
| `tsconfig.base.json` | `strict`, plus the eight options `strict` does not include                  |
| `prettier.config.js` | 100 columns, single quotes, trailing commas, LF                             |
| `stryker.config.js`  | `thresholds.break: 100`; a survivor is killed, never accommodated           |
| `vitest.base.js`     | v8 coverage reported as clover, which the floor binary reads                |
| `bin/coverage-floor` | the `coverage` verb: a clover report against the repo's `.coverage-floor`   |

**TypeScript is pinned at 6.0 and that is a ceiling, not a floor.** `typescript-eslint` accepts
`>=4.8.4 <6.1.0`, so TypeScript 7 — released and stable — cannot be adopted without giving up
type-aware linting, which is the whole reason ESLint is in this stack rather than a faster
syntactic linter. The pin moves when the linter moves.

## Versioning

Bare SemVer tags. Raising the Node or TypeScript floor, tightening the compiler, or adding a lint
rule that reddens existing code is a **major**: it can turn a green repository red without a line
of its own changing.
