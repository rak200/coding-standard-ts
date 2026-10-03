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
- [The rule it ships](#the-rule-it-ships)

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

**Patterns name the consumer's paths.** What to look at is the consumer's business, so nothing
here narrows it. Two blocks do name paths — the config files above, and `src/` for the rule below
— and flat config reads every `files` pattern from the directory of the config ESLint loaded, so
both resolve against the consumer's `eslint.config.js`, never against this package in
`node_modules`.

[↑ Back to top](#eslint)

---

## The rule it ships

`@rak200/coding-standard-ts/doc-summary` — every exported symbol, and every public member of one,
carries a TSDoc summary. On under `src/`, and not in a test written beside the code there. The
namespace is the package's own name, which is where the rule comes from.

```ts
export function run(): void {} // run has no TSDoc summary.

/** @returns the total */
export function sum(): number {} // reported: the first text is a tag

/** A box on the page. */
export interface Box {
  top: number; // Box.top has no TSDoc summary.
}

/** A button. */
export class UiButton extends LitElement {
  override render() {} // UiButton.render() has no TSDoc summary.

  /** {@inheritDoc} */
  override updated() {} // not reported: an inline tag is text

  private helper() {} // not reported: not public
}
```

A public member is a method, a constructor, a property, an accessor, a constructor parameter that
declares a property, an enum member, and a named member of an exported interface or object type.
The summary is the doc comment's first text, so a doc comment that opens with a tag has none. A
decorator written before `export` is read past: the doc comment goes above the decorator.

It reads the declaration the `export` keyword is written on. One exported later by name — in an
`export { a }` list, or as `export default a` — is not followed.

The plugin is registered for every file, so a repository whose code lives outside `src/` turns the
rule on there in a block of its own:

```js
export default [
  ...base,
  { files: ['lib/**'], rules: { '@rak200/coding-standard-ts/doc-summary': 'error' } },
];
```

Why the rule exists is in [CONVENTIONS.md](../CONVENTIONS.md), §_Documentation form_.

[↑ Back to top](#eslint)
