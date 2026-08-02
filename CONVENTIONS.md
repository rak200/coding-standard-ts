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
  linter moves, and raising it is a major (Layer 1, _Versioning_).
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

| Verb       | Binding                                                                           |
| ---------- | --------------------------------------------------------------------------------- |
| `validate` | `npm run build && publint --strict`                                               |
| `lint`     | `prettier --check .`                                                              |
| `fix`      | `prettier --write . && eslint --fix .`                                            |
| `analyse`  | `tsc --noEmit && eslint .`                                                        |
| `test`     | `vitest run`                                                                      |
| `coverage` | `coverage-floor` — this package's binary, clover report against `.coverage-floor` |
| `scan`     | `semgrep scan --config=p/typescript --severity=ERROR --sarif -o semgrep.sarif`    |
| `mutation` | `stryker run`                                                                     |

**`validate` is declared here and must not be declared in PHP.** Composer ships a native command
of that name and skips any script that shadows it; npm has no such collision, because
`npm run <verb>` always runs the script. The carve-out on the PHP side is a fact about Composer,
not a rule of the vocabulary — and the two languages diverging on one line, for a stated reason,
is the vocabulary working rather than failing.

**`validate` builds first, and that is not scope creep.** `publint` checks that what the manifest
says it publishes actually exists — `main`, `types`, every `exports` entry. In a language with a
build step those files do not exist until something builds them, so a `validate` that skips the
build validates a claim it cannot see. Layer 1's vocabulary has no `build` verb because PHP has no
build; TypeScript folds it into the verb that needs it rather than opening the closed set.

**`analyse` is two tools because static analysis is two questions.** `tsc --noEmit` answers _does
it typecheck_; `eslint` answers _is it well-formed under rules that read those types_. PHPStan
answers both at once, which is a property of PHPStan, not of the step.

## Static analysis

**`strictTypeChecked` + `stylisticTypeChecked`** — the strictest consolidated pair
`typescript-eslint` publishes — over `src/` _and_ the tests. This is the TypeScript answer to
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

**Prettier**, and no arguments: 100 columns, single quotes, trailing commas everywhere, LF.
A repository gets them by re-exporting `@rak200/coding-standard-ts/prettier` from its own
`prettier.config.js` — Prettier's JSON config has no `extends`, so a `.prettierrc.json` in a
consumer replaces this standard instead of extending it, silently and while `lint` stays green. Style
is not a place to spend judgement, and every rule that could disagree with the formatter is turned
off in the ESLint config rather than fought.

**Indentation is four spaces, not the two a JavaScript developer expects**, and that is deliberate
rather than an oversight: Prettier reads the repository's `.editorconfig`, which is a Layer 1 seed
shared with every other language in the ecosystem. One indent width across the estate beats each
language's local habit — and the width is not a decision worth a per-language exception.

## Testing

Layer 1 sets the policy — mirrored trees, one file per unit, contract assertions. In TypeScript:

- **Vitest**, with the suite beside the source it covers.
- **Component tests run in a real browser** (Vitest browser mode over Playwright), not in a DOM
  emulator. A custom element that only ever runs under jsdom is a component nobody has tested:
  shadow DOM, focus, layout and event ordering are exactly where the emulator and the browser
  disagree, and exactly what a UI library exists to get right.
- **Mutation: `thresholds.break: 100`.** The asymmetry with the PHP side is real and stated
  rather than smoothed: Infection has `minCoveredMsi`, a floor over covered code only, and Stryker
  has **no covered-only break threshold**. So TypeScript enforces the stricter _overall_ MSI,
  which a repository built to this standard from day one can hold. **The threshold is never
  lowered to accommodate a survivor.**
- **`coverageAnalysis` is `all`, never `perTest`.** Per-test coverage needs instrumentation Vitest
  does not provide in browser mode, and Stryker's failure mode is not an error: every mutant
  reports zero covering tests and times out, so they count as _killed_ and the score comes out
  high and meaningless. `all` still skips mutants in code no test reaches.
- **A mutant on a module-level side effect cannot be killed, and that is a third category.**
  Stryker switches mutants at runtime inside a warm process, so a statement that runs once at
  import — `customElements.define(...)` above all — has already run with the original value by the
  time any mutant is active. This is neither a weak test nor an equivalent mutant: it is outside
  the runner's reach. Exclude it at the narrowest node with a `// Stryker disable next-line`
  carrying that reason, and never widen the exclusion to the file.

## Documentation form

Layer 1 mandates that documentation exists; this is what it looks like in TypeScript.

- Every exported symbol carries a TSDoc summary. `@param` / `@returns` / `@throws` are added
  **only when they convey something beyond the type signature** — units, semantics, edge-case
  behaviour, the condition of a throw. The signature is already published; repeating it is noise.
- **Reference pages** live in `docs/`, sized by unit: an index (`docs/README.md`) and one page per
  unit that a reader would look up on its own. CI asserts that every exported symbol appears
  somewhere in `docs/`.
