/**
 * Layer 2 (TypeScript) — narrowing the `mutation` verb to the lines a pull request changed.
 *
 * Layer 1 says mutation runs over the **changed lines** on a pull request. `js.yml` computes
 * `git diff --name-only` and hands the verb whole **files**, because Stryker has no diff flag
 * of its own — where Infection has `--git-diff-lines` and the PHP pipeline calls it directly.
 * Somebody has to translate a diff into `--mutate` ranges, and that translator is
 * tool-specific, so it belongs to this package rather than to the shared pipeline or to each
 * consumer separately. rak200/coding-standard-ts#68
 *
 * Measured on rak200/ui#126: one changed line in `src/tooltip.ts` and two in `src/field.ts`
 * produced 241 of that run's 350 mutants — 69% of a job that then passed the pipeline's
 * 20-minute timeout and was killed at 87%, with zero survivors. The gate blocked on time
 * rather than on a defect, which is the required check people learn to route around. Narrowed
 * to the ranges the diff touches, the same pull request is 38 mutants at the same 100.00%.
 *
 * **Nothing is excluded and no threshold moves.** A mutant outside the diff is not *ignored*,
 * which would count as dead and lift the score without a test; it is never created, and the
 * floor applies to what was created. `--ignoreStatic` reaches the same mutants far more
 * cheaply and is refused for exactly that reason.
 *
 * **The trade is Layer 1's, not a new one.** A change in one place can stop a test from
 * killing a mutant elsewhere in the same file, and per pull request that mutant goes
 * unverified. The convention makes that trade one paragraph above the sentence this
 * implements, and names the compensating control: the full run off the pull-request path.
 *
 * Everything that decides anything lives here, where the suite reaches it under a 100%
 * mutation floor. `bin/rak200-mutate.js` is spawn, print and exit — the same split as
 * `scan-command.js` and for the reason its docblock gives: a decision that lives in a
 * manifest string has nothing to answer to.
 */

/**
 * The patterns of one `--mutate` value, which is comma-separated.
 *
 * @param {string} value the raw argument
 * @returns {string[]}
 */
export function patterns(value) {
    return value
        .split(',')
        .map((pattern) => pattern.trim())
        .filter((pattern) => pattern !== '');
}

/**
 * Whether a pattern is a plain path rather than a glob or an existing range.
 *
 * Only a concrete path can be expanded: a glob names files that are not resolved yet, and a
 * pattern that already carries `:` is a range somebody wrote deliberately. Both are forwarded
 * untouched rather than guessed at.
 *
 * @param {string} pattern one `--mutate` entry
 * @returns {boolean}
 */
export function concrete(pattern) {
    return /^[^*?:!]+$/.test(pattern);
}

/**
 * The base ref, spelled the way the pipeline fetches it, or '' off the pull-request path.
 *
 * `GITHUB_BASE_REF` is set by GitHub on a `pull_request` event and by nothing locally, so a
 * run by hand and the `workflow_dispatch` full run expand nothing and mutate what the config
 * says. That is the whole switch between the two halves of the Layer 1 rule.
 *
 * @param {Record<string, string | undefined>} env the process environment
 * @returns {string}
 */
export function baseRef(env) {
    const ref = env['GITHUB_BASE_REF'] ?? '';
    return ref === '' ? '' : `origin/${ref}`;
}

/**
 * The `+` side of every hunk header in a unified diff, as `file:start-end`.
 *
 * A hunk with a `+c,0` count contributes nothing: a pure deletion adds no line to mutate, and
 * emitting `file:5-4` would be a range Stryker cannot read. An absent count means one line,
 * which is the header's own shorthand.
 *
 * @param {string} file the path the ranges are for
 * @param {string} diff output of `git diff --unified=0`
 * @returns {string[]}
 */
export function rangesFor(file, diff) {
    const found = [];
    for (const line of diff.split('\n')) {
        const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
        if (hunk === null) {
            continue;
        }
        const start = Number(hunk[1]);
        const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
        if (count > 0) {
            found.push(`${file}:${String(start)}-${String(start + count - 1)}`);
        }
    }
    return found;
}

/**
 * Every kept pattern, expanded where there is a diff to expand it against.
 *
 * `read` returns the diff text, or null when git refused to answer — a base ref that was never
 * fetched, above all. **A file whose diff could not be read keeps the whole file**: narrowing
 * on a diff nobody could read is how a gate goes quiet.
 *
 * @param {string[]} kept the patterns that survived any prefix filter
 * @param {string} from the base ref, or '' off the pull-request path
 * @param {(file: string, from: string) => string | null} read the diff of one file
 * @returns {string[]}
 */
export function expand(kept, from, read) {
    if (from === '') {
        return kept;
    }
    return kept.flatMap((pattern) => {
        if (!concrete(pattern)) {
            return [pattern];
        }
        const diff = read(pattern, from);
        return diff === null ? [pattern] : rangesFor(pattern, diff);
    });
}

/**
 * The argument list to hand Stryker, and the reason it is empty when it is.
 *
 * `--mutate` is accepted in three spellings and all three are rewritten, because a consumer
 * that passes the one this missed would silently get the unnarrowed run.
 *
 * **An empty list is never forwarded.** `--mutate` with nothing in it falls back to the
 * config's whole library, so a pull request that touched almost nothing would mutate
 * everything — the opposite of this file's purpose, arriving silently.
 *
 * @param {string[]} args the arguments meant for Stryker
 * @param {string} from the base ref, or '' off the pull-request path
 * @param {(file: string, from: string) => string | null} read the diff of one file
 * @param {(pattern: string) => boolean} [drop] whether a pattern is dropped before narrowing
 * @returns {{ args: string[], emptied: string, announced: string }}
 */
// Stryker disable next-line ArrowFunction: the default is mutated to `() => undefined`, which
// is falsy exactly as `false` is — every pattern is kept either way, and no input distinguishes
// them. Equivalent, so killed by argument rather than by a test that could not exist.
export function forward(args, from, read, drop = () => false) {
    const out = [];
    let emptied = '';
    let announced = '';
    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        const separate = (arg === '--mutate' || arg === '-m') && i + 1 < args.length;
        const joined = arg.startsWith('--mutate=');
        if (!separate && !joined) {
            out.push(arg);
            continue;
        }
        const value = separate ? args[i + 1] : arg.slice('--mutate='.length);
        if (separate) {
            i += 1;
        }
        const kept = patterns(value).filter((pattern) => !drop(pattern));
        if (kept.length === 0) {
            emptied = 'every changed file is dropped by --drop-prefix';
            continue;
        }
        const narrowed = expand(kept, from, read);
        if (narrowed.length === 0) {
            emptied = 'the diff adds no line to any mutable file';
            continue;
        }
        announced = from === '' ? '' : narrowed.join(',');
        if (separate) {
            out.push(arg, narrowed.join(','));
        } else {
            out.push(`--mutate=${narrowed.join(',')}`);
        }
    }
    return { args: out, emptied, announced };
}

/**
 * Stryker's own bin path, read out of its manifest rather than hardcoded.
 *
 * `./bin/stryker.js` is the package's to change, and a hardcoded copy breaks on an upgrade
 * with no diagnosis. Parsed here rather than in the binary because this is a decision — what
 * counts as a usable manifest — and decisions live where the suite can reach them.
 *
 * @param {string} text raw package.json contents
 * @param {string} label the manifest's path, for the message
 * @returns {string}
 * @throws {Error} when the manifest declares no string `bin.stryker`
 */
export function strykerBin(text, label) {
    const parsed = /** @type {unknown} */ (JSON.parse(text));
    if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'bin' in parsed &&
        typeof parsed.bin === 'object' &&
        parsed.bin !== null &&
        'stryker' in parsed.bin &&
        typeof parsed.bin.stryker === 'string'
    ) {
        return parsed.bin.stryker;
    }
    throw new Error(`${label} declares no bin.stryker — the mutation verb has nothing to run`);
}
