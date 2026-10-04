# `./tsconfig`

[← Reference](README.md)

The compiler settings. The one config in this package shared as JSON, because `tsconfig.json`'s
`extends` resolves a package specifier natively.

```jsonc
// tsconfig.json
{
  "extends": "@rak200/coding-standard-ts/tsconfig",
  "include": ["src", "tests"],
}
```

## Contents

- [What it sets](#what-it-sets)
- [What a repository may not override](#what-a-repository-may-not-override)
- [What it leaves to you](#what-it-leaves-to-you)

---

## What it sets

**Target** — `target: ES2023`, `lib: ["ES2023", "DOM", "DOM.Iterable"]`, `module` and
`moduleResolution` both `NodeNext`.

**Strictness** — `strict`, plus the ones it does not imply: `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`,
`noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`,
`useUnknownInCatchVariables`.

**Module hygiene** — `isolatedModules`, `verbatimModuleSyntax`, `forceConsistentCasingInFileNames`,
`skipLibCheck`.

**Output** — `declaration`, `declarationMap`, `sourceMap`.

[↑ Back to top](#tsconfig)

---

## What a repository may not override

Every option above except `declaration`, `declarationMap` and `sourceMap`. The pipeline resolves
every `tsconfig*.json` at the repository's root through `tsc --showConfig`, and fails when one of
them differs from this file — overridden, or lost with `extends`. The three output options decide
what a build writes rather than what the compiler accepts, and stay the repository's: rak200/ui
turns two of them off for its generated icons.

Two of them hold ESM only: under `NodeNext` a relative import without its extension is a compile
error, and under `verbatimModuleSyntax` so is a package without `"type": "module"`. The rest are
the strictness: turning one off is a compile that still passes, and the type-aware lint notices
only where the code happens to depend on the option. Compared from `js.yml` 2.14.0 for the module
options and 2.15.0 for the others.

[↑ Back to top](#tsconfig)

---

## What it leaves to you

`include`, `exclude`, `outDir` and `rootDir` — everything that names a path. A relative path here
would resolve against the installed package.

[↑ Back to top](#tsconfig)
