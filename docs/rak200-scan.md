# `rak200-scan`

[← Reference](README.md)

Runs semgrep with the command the estate decides, and exits with semgrep's own code. Installed on
`node_modules/.bin` and bound to the `scan` verb.

```bash
rak200-scan
```

## Contents

- [The command it runs](#the-command-it-runs)
- [`--error` is not `--severity=ERROR`](#--error-is-not---severityerror)

---

## The command it runs

| part   | value                                              |
| ------ | -------------------------------------------------- |
| binary | `semgrep`                                          |
| packs  | `p/javascript`, `p/typescript`                     |
| report | `semgrep.sarif`, uploaded by the pipeline as SARIF |

[↑ Back to top](#rak200-scan)

---

## `--error` is not `--severity=ERROR`

They are unrelated flags with confusable names, and substituting one for the other leaves a scanner
that finds, reports and never fails:

| flag               | what it does                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `--error`          | exit non-zero **when there are findings**. This is the whole gate                        |
| `--severity=ERROR` | filter which rules **run**. It narrows the rule set and drops nothing from the exit code |

The command lived in each repository's own `package.json` scripts, which is per-repo by
construction, and all four copies drifted to the same wrong shape with the canary that would have
caught it never fired. It is a binary now, and the arguments live in `src/` so a test can assert
them.

[↑ Back to top](#rak200-scan)
