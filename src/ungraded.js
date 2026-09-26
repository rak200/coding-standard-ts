/**
 * Layer 2 (TypeScript) — the mutants a run could not grade, which the `mutation` verb refuses.
 *
 * Stryker scores `(killed + timeout) / (killed + timeout + survived + no coverage)`. A mutant
 * whose run **errored** — `RuntimeError` — is in neither half: not caught, not escaped, left
 * out. So a run can read 100.00 and exit 0 over mutants nobody scored, and a floor that passes
 * on a number it did not measure is a floor that reports and does not decide. Measured on
 * rak200/ui: the first full run over its `src/` left nine mutants out this way, and nothing
 * said so beyond a column in the summary table.
 *
 * **The vitest runner calls a run `RuntimeError` when it recorded no failed test and at least
 * one unhandled error**, and two different things produce that — neither of them a mutant that
 * escaped. The suite: the mutant made the component throw where no test was watching, inside a
 * listener or in a teardown that runs outside every test. The machine: a browser session that
 * could not be reached in time is zero tests and one error. What either needs is a person
 * looking at the mutant, so this prints where each one is and whatever reason the runner
 * recorded — which for an error raised in the page is `[object Object]`, and
 * `docs/rak200-mutate.md` says why and what to do instead.
 *
 * **`CompileError` is not refused, and that is a verdict rather than an omission**: the mutated
 * program does not typecheck, so there is no behaviour for a test to catch. It arises only
 * under a checker plugin, which this standard does not configure.
 *
 * The decision lives here, where the suite reaches it; `bin/rak200-mutate.js` reads the file,
 * prints and exits — the split `mutate-changed.js` states.
 */

/**
 * Where the report is read from: the `json` reporter's own default `fileName`.
 *
 * Not configured in `stryker.base.js`, and not read from a consumer's config either — a
 * consumer that moves it gets a refusal that names this path, rather than a check that
 * quietly reads nothing. `tests/ungraded.test.js` compares it with the default Stryker's
 * schema declares, so an upstream move reds here instead of in every consumer.
 */
export const report = 'reports/mutation/mutation.json';

/**
 * Every mutant the run could not grade, one line each: where it is, what the mutation was,
 * and the first line of the reason the runner recorded.
 *
 * @param {string} text raw contents of a Stryker JSON report
 * @param {string} label the report's path, for the message
 * @returns {string[]} empty when every mutant was graded
 * @throws {Error} when the text is not a mutation report — no `files` object to read
 */
export function ungraded(text, label) {
    const parsed = /** @type {unknown} */ (JSON.parse(text));
    if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('files' in parsed) ||
        typeof parsed.files !== 'object' ||
        parsed.files === null
    ) {
        throw new Error(`${label} is not a mutation report — it has no files to read`);
    }

    const files = /** @type {Record<string, { mutants: Mutant[] }>} */ (parsed.files);
    const found = [];
    for (const [file, { mutants }] of Object.entries(files)) {
        for (const mutant of mutants) {
            if (mutant.status !== 'RuntimeError') {
                continue;
            }
            const { line, column } = mutant.location.start;
            // The first line only: a browser runner's reason is a whole action log, and the
            // line that names the failure is the one a reader needs in a pipeline's output.
            const first = (mutant.statusReason ?? '').trim().replace(/\n[\s\S]*/, '');
            const reason = first === '' ? 'no reason recorded' : first;
            found.push(
                `${file}:${String(line)}:${String(column)} ${mutant.mutatorName} — ${reason}`,
            );
        }
    }
    return found;
}

/**
 * As much of one mutant as a refusal names — the report schema's own field names.
 *
 * @typedef {object} Mutant
 * @property {string} mutatorName
 * @property {string} status
 * @property {string} [statusReason]
 * @property {{ start: { line: number, column: number } }} location
 */
