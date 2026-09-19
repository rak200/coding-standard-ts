# `coverage-floor`

[← Reference](README.md)

Fails the build when line coverage falls below the number in `.coverage-floor`. Installed on
`node_modules/.bin` and bound to the `coverage` verb.

```bash
coverage-floor [--drop-prefix <path>]... [clover-report] [floor-file]
# defaults: coverage/clover.xml  .coverage-floor
```

## Contents

- [What it enforces](#what-it-enforces)
- [The floor file](#the-floor-file)
- [The tree the report has to describe](#the-tree-the-report-has-to-describe)
- [Excluding a generated tree](#excluding-a-generated-tree)
- [Output and exit code](#output-and-exit-code)
- [The ratchet has two modes](#the-ratchet-has-two-modes)

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

## The tree the report has to describe

A report is an artefact of the run that produced it, and **nothing here regenerates it**: the
report path is gitignored, so running the verb on its own grades whatever is on disk. A class added
to `src/` with no test at all once produced `coverage rose … raise .coverage-floor to match` and an
exit code of `0` — not merely a stale number, but advice that was the opposite of correct.

So a report is checked against the tree before it is believed, in two steps and in this order:

| step         | catches                                        | how it reads                                             |
| ------------ | ---------------------------------------------- | -------------------------------------------------------- |
| the file set | a source the report never heard of             | accuses — a file cannot be missing by accident           |
| the mtime    | lines added to a file the report already lists | says _may_ — a rebase moves mtime without moving content |

The file set is compared **by basename**, because the two real formats disagree about paths:
PHPUnit writes the absolute path of wherever the suite ran, and istanbul splits the name from its
directory and has been seen carrying a Windows path into a report a Linux CI then read.

**Only the default report is checked this way.** A caller that names a report has said nothing
about which tree it describes — this package's own suite grades fixtures under a temporary
directory — so both steps stand down, and `sourceFiles` is never asked for a list.

[↑ Back to top](#coverage-floor)

---

## Excluding a generated tree

`--drop-prefix <path>` leaves a subtree out of the scan above. It is for the repository that
vendors generated code: `rak200/ui` carries 2048 glyph modules emitted from a pinned Lucide, and
excludes them from coverage on purpose — the barrel that imports all of them costs seconds on every
run, and `tsc` typechecks the tree instead. Without the option that exclusion and this check
contradict each other, and the only escape was to name the report explicitly, which switches the
whole staleness check off to silence one legitimate exclusion.

```jsonc
// package.json — the same prefix both floors are told to drop
"coverage": "coverage-floor --drop-prefix src/icons/",
"mutation": "rak200-mutate --drop-prefix src/icons/"
```

The option may be repeated, and the prefix is compared against the paths the scan itself builds —
`src/icons/`, relative to the repository root, not a glob and not an absolute path.

**A prefix that matches nothing fails the step.** An exclusion that excludes nothing reads exactly
like one that works, and the tree it names is generated and can be moved or renamed by the script
that emits it — at which point the option would go on narrowing nothing while `package.json` still
claims it does.

```
::error::coverage floor: --drop-prefix src/glyphs/ matched no file under src — drop the option or fix the prefix, because it is excluding nothing
```

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

## The ratchet has two modes

When coverage rises **inside** the tolerance, the command emits an annotation and exits `0`:

```
::notice::coverage rose to 95.40% — raise .coverage-floor to match
```

A `::notice::` annotates; it cannot fail a step, and a fractional gain is not worth a red pull
request.

**Beyond the tolerance it blocks.** A gain of more than a point is a gain worth locking in, and a
floor raised by whoever remembers is a floor that drifts down:

```
::error::coverage floor: 98.40% is more than 1.00 points above the floor of 95.00% — raise the
floor in this pull request, so the gain is locked in by a check rather than by anyone remembering
```

[↑ Back to top](#coverage-floor)
