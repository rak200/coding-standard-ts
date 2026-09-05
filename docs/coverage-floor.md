# `coverage-floor`

[← Reference](README.md)

Fails the build when line coverage falls below the number in `.coverage-floor`. Installed on
`node_modules/.bin` and bound to the `coverage` verb.

```bash
coverage-floor [clover-report] [floor-file]
# defaults: coverage/clover.xml  .coverage-floor
```

## Contents

- [What it enforces](#what-it-enforces)
- [The floor file](#the-floor-file)
- [Output and exit code](#output-and-exit-code)
- [The ratchet is reported, not enforced](#the-ratchet-is-reported-not-enforced)

---

## What it enforces

Coverage is read from the clover report's project-level metrics — `statements` and
`coveredstatements` — and compared against the floor. Clover is what [`./vitest`](vitest.md)
reports, and it is the same format the PHP side reads: one implementation of the floor serves both
languages.

It runs **inside the CI job, from files in the repository**, so the required check never waits on a
third party. Codecov is reporting only.

[↑ Back to top](#coverage-floor)

---

## The floor file

`.coverage-floor` is a single number, per-repository state and never a seed. Two bounds apply:

| bound      | value | what happens                                                        |
| ---------- | ----- | ------------------------------------------------------------------- |
| hard floor | `95`  | a floor below it is refused outright, before any report is read     |
| tolerance  | `1`   | how far above the floor coverage may sit before the command says so |

A floor that is not a number, or is below the hard floor, fails with a message naming the file.

[↑ Back to top](#coverage-floor)

---

## Output and exit code

```
coverage 100.00% (47/47 statements), floor 100.00%
```

Exit `0` when coverage meets the floor, non-zero when it does not or when either file is missing or
unreadable as expected. The binary is the only place that knows about exit codes; everything it
calls throws instead.

[↑ Back to top](#coverage-floor)

---

## The ratchet is reported, not enforced

When coverage rises more than the tolerance above the floor, the command emits an annotation:

```
::notice::coverage rose to 98.40% — raise .coverage-floor to match
```

A `::notice::` annotates; it cannot fail a step. Failing a pull request for _improving_ coverage is
a different policy and would have to be decided rather than inherited from the word "monotonic".

[↑ Back to top](#coverage-floor)
