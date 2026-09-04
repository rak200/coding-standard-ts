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

## What it leaves to you

`include`, `exclude`, `outDir` and `rootDir` — everything that names a path. A relative path here
would resolve against the installed package.

[↑ Back to top](#tsconfig)
