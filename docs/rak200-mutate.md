# `rak200-mutate`

[← Reference](README.md)

Runs Stryker over what a pull request changed, then refuses a run that left any mutant ungraded.
Installed on `node_modules/.bin` and bound to the `mutation` verb.

```bash
rak200-mutate [--drop-prefix <path>] [-- <stryker arguments>]
```

## Contents

- [What it mutates](#what-it-mutates)
- [A mutant the run could not grade fails it](#a-mutant-the-run-could-not-grade-fails-it)

---

## What it mutates

Layer 1 runs mutation over the **changed lines** on a pull request and in full off that path.
Stryker has no diff flag, so the verb supplies one:

| input                                          | what reaches Stryker                                |
| ---------------------------------------------- | --------------------------------------------------- |
| a plain path in `--mutate`, on a pull request  | the line ranges the diff against the base touched   |
| a plain path, off the pull-request path        | the path, unchanged — the full run                  |
| a glob, a negation, or a range already written | the pattern, unchanged                              |
| a path whose diff git could not read           | the whole file — narrowing on nothing is not a pass |
| a path under a `--drop-prefix`                 | nothing                                             |
| nothing left after all of the above            | no run, and `nothing to mutate` on a green step     |

The switch is `GITHUB_BASE_REF`, which GitHub sets on a `pull_request` event and nothing sets
locally. **No mutant is ignored and no threshold moves**: a mutant outside the diff is never
created, and the floor applies to what was.

`--drop-prefix` is for a generated tree that carries its own `// Stryker disable all`. An ignored
mutant is still a created one, so dropping the path before Stryker sees it is what saves the time.

[↑ Back to top](#rak200-mutate)

---

## A mutant the run could not grade fails it

Stryker scores `(killed + timeout) / (killed + timeout + survived + no coverage)`. A mutant whose
run **errored** — `RuntimeError` — is in neither half, so a run can read 100.00 and exit 0 over
mutants nobody scored. After a run Stryker passed, the verb reads `reports/mutation/mutation.json`
and exits 1 on any, naming each with the first line of whatever reason the runner recorded:

```text
mutation: 1 mutant(s) ungraded — the run errored rather than failed, and the score leaves them out:
  src/tooltip.ts:619:13 ConditionalExpression — An error occurred outside of a test run: [object Object]
```

**No report is a refusal too**, with its own message: a consumer whose `reporters` leaves out
`json`, or whose `jsonReporter.fileName` moves it, gets told so rather than a check that quietly
read nothing. The file is removed before each run, so a stale one cannot pass for this run's.

The vitest runner calls a run `RuntimeError` when it recorded **no failed test and at least one
unhandled error**. Two different things produce that, and neither is a mutant that escaped:

- **The suite.** The mutant made the component throw where no test was watching: inside a listener,
  which reports to the window rather than to whoever dispatched the event, or in a teardown that
  runs outside every test. Capture it inside the test that causes it and assert on it, and the same
  mutant is killed.
- **The machine.** The runner could not reach its browser in time, and no test ran.

**Running the mutant again, alone, is what tells them apart** — pass the line the refusal names as a
range, `--mutate src/tooltip.ts:619-619`. The suite reproduces; the machine does not.

**The recorded reason usually cannot**, and that is upstream rather than here. An error raised in
the page reaches the runner as a plain serialized object rather than an `Error`, and Stryker's
`errorToString` prints anything that is not an `Error` as `[object Object]` — measured, as the whole
of the reason a browser-mode suite error came back with. The line still names the mutant, which is
the part the next step needs. Reported as
[stryker-mutator/stryker-js#6233](https://github.com/stryker-mutator/stryker-js/issues/6233); once a
runner release fixes it, the reason becomes the error's own message and this paragraph goes.

`CompileError` is not refused: the mutated program does not typecheck, which is a verdict rather
than the absence of one. It arises only under a checker plugin, which this standard does not
configure.

[↑ Back to top](#rak200-mutate)
