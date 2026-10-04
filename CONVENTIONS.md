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

  **The two compiler options are what hold the rule, so they are what the pipeline compares.**
  Under `NodeNext` a relative import without its extension is a compile error, and under
  `verbatimModuleSyntax` so is a package without `"type": "module"` — which is why `"type"`
  needs no check of its own. Either one, overridden in a repository's tsconfig, lets its failure
  ship on a green pipeline: an import without its extension passes every verb, any bundler
  resolves it, and `dist/` then fails to load in Node. The step _A repository may not weaken a
  mandated value_ resolves every `tsconfig*.json` at the root through `tsc --showConfig` and
  compares `module`, `moduleResolution` and `verbatimModuleSyntax` with this package's
  `tsconfig.base.json`, on the floor leg of every repository calling `js.yml` 2.14.0 or later.

  **No dual builds is checked by nothing.** A second format is a deliberate change to the
  manifest and a second build, which a reviewer sees, not a line that slips in.

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

**The pipeline compares the rules as ESLint resolves them.** In every tracked script, each rule
the base turns on must resolve in the repository's own config to the same severity and options.
A repository may add rules and ignore files; it may not turn one of these off or change it. A
config that leaves the base out was the case that mattered: it passed `eslint .` and every check
that read the config as text, which reported this standard's tier as the one that runs. The step
is _A repository may not weaken a mandated value_, on the floor leg of every repository calling
`js.yml` 2.16.0 or later.

The compiler is configured past `strict`, because `strict` is a floor and not a ceiling:
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`,
`noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`,
`noUnusedParameters`. Each of these turns a silent wrong answer into a compile error.

**The pipeline compares every option the base sets**, as `tsc --showConfig` resolves it in each
`tsconfig*.json` at the root, so one that drops `extends` loses them and fails. Turning one off is
a compile that still passes, and the type-aware lint notices only where the code depends on the
option — `noUncheckedIndexedAccess: false` turned 27 guards in rak200/ui into
`no-unnecessary-condition` errors — so the comparison is what holds all of them. `declaration`,
`declarationMap` and `sourceMap` are left to the repository, because they decide what a build
writes rather than what the compiler accepts. From `js.yml` 2.15.0.

**Never `any`, and never a bare `@ts-expect-error`.** A genuinely unknown value is `unknown` and
gets narrowed. Where a suppression is unavoidable it carries a description on the same line, and
`@ts-expect-error` is preferred over `@ts-ignore` because it fails when the underlying problem is
fixed — a suppression that outlives its cause is worse than the error it hid.

## Code style

**Prettier**, and no arguments: 100 columns, single quotes, trailing commas everywhere, LF.
A repository gets them by re-exporting `@rak200/coding-standard-ts/prettier` from its own
`prettier.config.js` — Prettier's JSON config has no `extends`, so a `.prettierrc.json` in a
consumer replaces this standard instead of extending it. Style is not a place to spend judgement,
and every rule that could disagree with the formatter is turned off in the ESLint config rather
than fought.

**Nothing checks for a replacement, and that is a judgement about cost.** In a repository already
formatted to this standard one is loud: `lint` reds on every file it reformats until a wholesale
`fix`, and that reformat is a diff no reviewer misses. It is silent only where the code already
matches it — a repository formatted under the replacement from the start, which is how the first
consumer ran Prettier's defaults with `lint` clean, or a verbatim copy of these options, which
passes everything and stops following this standard from then on.

**Indentation is four spaces, not the two a JavaScript developer expects**, and that is deliberate
rather than an oversight: Prettier reads the repository's `.editorconfig`, which is a Layer 1 seed
shared with every other language in the ecosystem. One indent width across the estate beats each
language's local habit — and the width is not a decision worth a per-language exception.

## Testing

Layer 1 sets the policy — mirrored trees, one file per unit, contract assertions. In TypeScript:

- **Vitest**, over a `tests/` tree mirroring `src/` — Layer 1's mirrored trees, read literally,
  and the same shape the PHP side has. Colocating `button.test.ts` beside `button.ts` is the
  tempting JavaScript habit and it costs two things a suffix cannot buy back: the test files sit
  inside the published `src/` tree, where `export-ignore` cannot reach them by directory, and
  every tool that must not see them — the build, coverage, the mutation engine, the pipeline's
  changed-file filter — carves them out by filename instead. A file named `*.spec.ts` then becomes
  published product and mutable source, on a green pipeline.
- **Component tests run in a real browser** (Vitest browser mode over Playwright), not in a DOM
  emulator. A custom element that only ever runs under jsdom is a component nobody has tested:
  shadow DOM, focus, layout and event ordering are exactly where the emulator and the browser
  disagree, and exactly what a UI library exists to get right.

  **Nothing checks the configuration, and the suite is what holds the rule.** A test that imports
  `vitest/browser` — the page and user-event APIs — refuses to load outside Browser Mode, so a
  repository whose tests use it cannot move to an emulator without rewriting them: measured on
  rak200/ui, with browser mode off and happy-dom installed, 15 of its 17 test files failed. The
  two that passed import no browser-only API, and that is the limit — a suite written without one
  could move silently, while the pipeline went on installing a browser nothing used.

- **Mutation: `thresholds.break: 100`.** The asymmetry with the PHP side is real and stated
  rather than smoothed: Infection has `minCoveredMsi`, a floor over covered code only, and Stryker
  has **no covered-only break threshold**. So TypeScript enforces the stricter _overall_ MSI,
  which a repository built to this standard from day one can hold. **The threshold is never
  lowered to accommodate a survivor.**

  **The pipeline compares the floor as Stryker resolves it**, by importing `stryker.config.js`
  the way Stryker loads it. A config that leaves the base out restates nothing and runs on
  Stryker's own default, `thresholds.break: null`, which never fails; a missing config fails for
  the same reason. From `js.yml` 2.15.0, on the floor leg.

- **A mutant the run could not grade fails the floor.** Stryker leaves a `RuntimeError` out of
  the score — neither caught nor escaped — so a run can read 100.00 over mutants nobody scored.
  `rak200-mutate` reads the JSON report back after a run Stryker passed and exits 1 on any, and on
  a run that wrote no report; that is why `json` is among the base config's reporters. **Its reach
  is the verb**: a bare `stryker run` checks nothing, and that is this package's own `mutation`
  verb.
- **A mutant on a module-level side effect cannot be killed, and that is a third category.**
  Stryker switches mutants at runtime inside a warm process, so a statement that runs once at
  import — `customElements.define(...)` above all — has already run with the original value by the
  time any mutant is active. This is neither a weak test nor an equivalent mutant: it is outside
  the runner's reach. Exclude it at the narrowest node with a `// Stryker disable next-line`
  carrying that reason, and never widen the exclusion to the file.

## Documentation form

Layer 1 mandates that documentation exists; this is what it looks like in TypeScript.

- Every exported symbol, and every public member of one, carries a TSDoc summary. A public member
  is a method, a constructor, a property, an accessor, a constructor parameter that declares a
  property, an enum member, and a named member of an exported interface or object type. An
  override is a member like any other, and `{@inheritDoc}` is how it says that it adds nothing to
  what it overrides. `@param` / `@returns` / `@throws` are added **only when they convey something
  beyond the type signature** — units, semantics, edge-case behaviour, the condition of a throw.
  The signature is already published; repeating it is noise.

  **ESLint enforces it**, as `@rak200/coding-standard-ts/doc-summary`: a rule this package
  ships, which `eslint.base.js` turns on under `src/`, so every repository that imports the base
  config runs it from 0.5.0. A doc comment on exported code is the documentation that travels
  with it: the compiler keeps it in the `.d.ts`, and a consumer's editor shows it over a call.
  The rule reads the declaration the `export` keyword is written on; one exported later by name,
  in an `export { a }` list or as `export default a`, is not followed. It can ask that a summary
  is there — the doc comment's first text is prose, not a tag — never that it says the right
  thing.

- **Reference pages** live in `docs/`, sized by unit: an index (`docs/README.md`) and one page per
  unit that a reader would look up on its own. CI asserts that every exported symbol appears
  somewhere in `docs/`.
