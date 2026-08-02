# rak200 — TypeScript conventions (Layer 2)

How we write TypeScript, for every rak200 TypeScript project. The language-agnostic half —
versioning, commits, the pipeline shape, testing policy, documentation policy, repository hygiene
— is **Layer 1**, in [`rak200/workflow`](https://github.com/rak200/workflow), imported alongside
this file. Nothing here repeats it.

Import both from a project's `CLAUDE.md`:

```markdown
@.rak200/CONVENTIONS.md
@node_modules/@rak200/coding-standard-ts/CONVENTIONS.md
```

## Baseline

- **Node 22.13+** as the floor, with the next major in the CI matrix. ESLint 10 and Vitest 4 both
  set that floor; the ecosystem does not go below what its own tools require.
- **TypeScript 6.0**, and the ceiling is not a preference. `typescript-eslint` accepts
  `>=4.8.4 <6.1.0`, so TypeScript 7 — released and stable — **cannot be used** without giving up
  type-aware linting, which is the entire reason ESLint is in this stack. The floor moves when the
  linter moves, and raising it is a major (Layer 1, *Versioning*).
- **ESM only** — `"type": "module"`, `verbatimModuleSyntax`, `NodeNext` resolution. No dual
  builds: a package that ships both formats ships two behaviours and debugs three.
- **One dev dependency**: this package. It brings the compiler, the linter, the formatter, the
  test runner, the browser driver, the mutation engine and the coverage-floor binary with it, so a
  repository's `devDependencies` does not drift from its siblings'. Because npm does not install a
  dependency's dev dependencies, the toolchain is declared under `dependencies` here — that is not
  a mistake, it is what makes one install enough.
  The one tool it cannot bring is the security scanner: `semgrep` is a Python tool, installed
  outside npm and explicitly in CI.

## The verbs, bound

Layer 1 fixes the vocabulary; here is what each word does in TypeScript. A repository declares all
eight in `package.json`; CI asserts their presence.

| Verb | Binding |
| --- | --- |
| `validate` | `publint --strict` |
| `lint` | `prettier --check .` |
| `fix` | `prettier --write . && eslint --fix .` |
| `analyse` | `tsc --noEmit && eslint .` |
| `test` | `vitest run` |
| `coverage` | `coverage-floor` — this package's binary, clover report against `.coverage-floor` |
| `scan` | `semgrep scan --config=p/typescript --severity=ERROR --sarif -o semgrep.sarif` |
| `mutation` | `stryker run` |

**`validate` is declared here and must not be declared in PHP.** Composer ships a native command
of that name and skips any script that shadows it; npm has no such collision, because
`npm run <verb>` always runs the script. The carve-out on the PHP side is a fact about Composer,
not a rule of the vocabulary — and the two languages diverging on one line, for a stated reason,
is the vocabulary working rather than failing.

**`analyse` is two tools because static analysis is two questions.** `tsc --noEmit` answers *does
it typecheck*; `eslint` answers *is it well-formed under rules that read those types*. PHPStan
answers both at once, which is a property of PHPStan, not of the step.

## Static analysis

**`strictTypeChecked` + `stylisticTypeChecked`** — the strictest consolidated pair
`typescript-eslint` publishes — over `src/` *and* the tests. This is the TypeScript answer to
PHPStan at `level: max`, and it is the reason the linter is ESLint: matching that bar needs rules
that read the type checker, which Biome and oxlint do not have. `eslint-config-prettier` comes
last and turns off everything that would argue with the formatter.

The compiler is configured past `strict`, because `strict` is a floor and not a ceiling:
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`,
`noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`,
`noUnusedParameters`. Each of these turns a silent wrong answer into a compile error.

**Never `any`, and never a bare `@ts-expect-error`.** A genuinely unknown value is `unknown` and
gets narrowed. Where a suppression is unavoidable it carries a description on the same line, and
`@ts-expect-error` is preferred over `@ts-ignore` because it fails when the underlying problem is
fixed — a suppression that outlives its cause is worse than the error it hid.

## Code style

**Prettier**, and no arguments: 100 columns, single quotes, trailing commas everywhere, LF. Style
is not a place to spend judgement, and every rule that could disagree with the formatter is turned
off in the ESLint config rather than fought.

## Testing

Layer 1 sets the policy — mirrored trees, one file per unit, contract assertions. In TypeScript:

- **Vitest**, with the suite beside the source it covers.
- **Component tests run in a real browser** (Vitest browser mode over Playwright), not in a DOM
  emulator. A custom element that only ever runs under jsdom is a component nobody has tested:
  shadow DOM, focus, layout and event ordering are exactly where the emulator and the browser
  disagree, and exactly what a UI library exists to get right.
- **Mutation: `thresholds.break: 100`.** The asymmetry with the PHP side is real and stated
  rather than smoothed: Infection has `minCoveredMsi`, a floor over covered code only, and Stryker
  has **no covered-only break threshold**. So TypeScript enforces the stricter *overall* MSI,
  which a repository built to this standard from day one can hold. **The threshold is never
  lowered to accommodate a survivor.**

## Documentation form

Layer 1 mandates that documentation exists; this is what it looks like in TypeScript.

- Every exported symbol carries a TSDoc summary. `@param` / `@returns` / `@throws` are added
  **only when they convey something beyond the type signature** — units, semantics, edge-case
  behaviour, the condition of a throw. The signature is already published; repeating it is noise.
- **Reference pages** live in `docs/`, sized by unit: an index (`docs/README.md`) and one page per
  unit that a reader would look up on its own. CI asserts that every exported symbol appears
  somewhere in `docs/`.
