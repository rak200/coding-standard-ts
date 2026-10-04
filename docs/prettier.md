# `./prettier`

[← Reference](README.md)

Code style. A module, re-exported by the consumer.

```js
// prettier.config.js
export { default } from '@rak200/coding-standard-ts/prettier';
```

## Contents

- [What it sets](#what-it-sets)
- [Where indentation comes from](#where-indentation-comes-from)
- [Why a module and not `.prettierrc.json`](#why-a-module-and-not-prettierrcjson)

---

## What it sets

| option          | value    |
| --------------- | -------- |
| `printWidth`    | `100`    |
| `singleQuote`   | `true`   |
| `trailingComma` | `all`    |
| `semi`          | `true`   |
| `arrowParens`   | `always` |
| `endOfLine`     | `lf`     |

[↑ Back to top](#prettier)

---

## Where indentation comes from

Not from here, deliberately. Prettier reads the repository's `.editorconfig`, a Layer 1 seed shared
with every other language, and one indent width across the estate beats each language's local
habit.

[↑ Back to top](#prettier)

---

## Why a module and not `.prettierrc.json`

**Prettier's JSON config has no `extends`.** A consumer that writes one gets its own file and
silently loses every decision here. The first repository to import this standard formatted its
entire source with Prettier's defaults, double quotes and all, while `lint` reported everything
clean.

Nothing checks for one. In a repository already formatted to this standard a replacement is loud —
`{ "printWidth": 120 }` turned `lint` red on 2137 files of rak200/ui — and the reformat that makes
it pass is a diff nobody misses. It stays silent where the code already matches it, which is the
case above, and for a verbatim copy of these options, which passes and stops following this file.

[↑ Back to top](#prettier)
