# Reference

What this package exposes to a repository that installs it. For installation and an overview, see
the [top-level README](../README.md); for the rules themselves, [CONVENTIONS.md](../CONVENTIONS.md).

| Unit             | Doc                                    | What it covers                                                 |
| ---------------- | -------------------------------------- | -------------------------------------------------------------- |
| `coverage-floor` | [coverage-floor.md](coverage-floor.md) | the `coverage` verb                                            |
| `rak200-scan`    | [rak200-scan.md](rak200-scan.md)       | the `scan` verb                                                |
| `./eslint`       | [eslint.md](eslint.md)                 | type-aware linting, and why ESLint rather than a faster linter |
| `./tsconfig`     | [tsconfig.md](tsconfig.md)             | the compiler settings, the one config shared as JSON           |
| `./prettier`     | [prettier.md](prettier.md)             | the formatter, and where indentation comes from                |
| `./stryker`      | [stryker.md](stryker.md)               | the mutation floor                                             |
| `./vitest`       | [vitest.md](vitest.md)                 | the suite and its coverage reporter                            |

## Two shapes, and the rule that separates them

**Four of the five configs are JavaScript modules, and only TypeScript's is JSON.** ESLint, Vitest,
Stryker and Prettier share configuration only through a module a consumer imports; none of their
JSON forms has a working `extends` that resolves a package specifier. `tsconfig.json` is the
exception — its `extends` resolves one natively.

**The consumer owns _what to look at_, every time.** No `files`, `include`, `ignores` or `paths`
are set in any shared config here. A relative path in a shared config resolves against the file
that declares it, which is inside the installed package.

## What is not here, and why

**`src/` is implementation, not API.** `package.json`'s `exports` lists the five entry points above
and nothing else, so `src/` is unreachable by import — it ships only because `bin/` requires it at
runtime. The binaries hold `process.argv`, stdio and the exit code; the logic lives in `src/` so
that it can be measured, because a child process is invisible to coverage instrumentation.
`parseFloor`, `parseClover` and `evaluate` are exported because the binaries and the tests reach
them, not because a consumer can.
