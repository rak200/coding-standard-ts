/**
 * Layer 2 (TypeScript) — the coverage floor, bound to the `coverage` verb.
 *
 * The logic lives here rather than in `bin/`, and the split is not cosmetic: the
 * binary reads `process.argv`, writes to stdio and calls `process.exit`, so testing it
 * meant spawning a child process — and a child process is invisible to the coverage
 * instrumentation, which would have left this file measured at zero while claiming to
 * enforce a floor on everyone else. The estate's own executable was the one piece of
 * code it never measured.
 *
 * Everything here throws {@link FloorError} instead of exiting. `bin/coverage-floor.js`
 * is the only place that knows about exit codes.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

/**
 * The floor below which no repository may set its own floor. A per-repo `.coverage-floor`
 * ratchets **up** from here; it is never lowered to accommodate a failing suite.
 */
export const HARD_FLOOR = 95;

/**
 * How far above its declared floor a repository may sit without re-declaring it. Beyond
 * this the gate fails, forcing the pull request that won the coverage to record it — the
 * ratchet's second mode.
 */
export const TOLERANCE = 1;

/** A condition the caller should report as a coverage-floor failure. */
export class FloorError extends Error {
    /** @param {string} message */
    constructor(message) {
        super(message);
        this.name = 'FloorError';
    }
}

/**
 * Reads a floor from the text of a `.coverage-floor` file.
 *
 * @param {string} text raw file contents
 * @param {string} label the file's path, for the message
 * @returns {number}
 * @throws {FloorError} when it is not a number, or is below {@link HARD_FLOOR}
 */
export function parseFloor(text, label) {
    // `Number` over a trimmed string, not `parseFloat`. parseFloat stops at the first
    // character it cannot use and returns what it had, so it read 98 out of `98abc` and
    // out of `98%` — a floor file is written by a person or by a ratchet, and either way
    // a trailing tail means the value is not the one someone intended. The PHP twin
    // rejects the same inputs through `is_numeric`; the two binaries answer to one
    // definition of "a number" the way they already answer to one definition of
    // "covered".
    //
    // The `.trim()` is load-bearing under `Number`, where `''` and `'   '` both convert
    // to 0 rather than NaN — the empty file has to be excluded before the conversion,
    // not after it. Under `parseFloat` the same call was redundant, and mutation testing
    // said so by killing nothing when it was removed.
    const trimmed = text.trim();
    const floor = trimmed === '' ? Number.NaN : Number(trimmed);

    if (!Number.isFinite(floor)) {
        throw new FloorError(`${label} does not contain a number`);
    }

    if (floor < HARD_FLOOR) {
        throw new FloorError(
            `${label} says ${String(floor)}, below the hard floor of ${String(HARD_FLOOR)}`,
        );
    }

    return floor;
}

/**
 * Reads statement totals out of a clover report.
 *
 * Clover is the format because the PHP side reads it too — one definition of "covered"
 * across both languages, rather than two that drift.
 *
 * @param {string} xml raw report contents
 * @param {string} label the file's path, for the message
 * @returns {{ total: number, covered: number, percent: number }}
 * @throws {FloorError} when the report has no statement metrics, or reports none
 */
export function parseClover(xml, label) {
    const metrics = /<metrics[^>]*\bstatements="(\d+)"[^>]*\bcoveredstatements="(\d+)"/.exec(xml);

    if (metrics === null) {
        throw new FloorError(`${label} is not a clover report with statement metrics`);
    }

    // `Number`, not `parseInt(x ?? '', 10)`. The groups are `\d+`, so they cannot be
    // absent once the regex matched — but `noUncheckedIndexedAccess` types them as
    // possibly undefined, and the `??` written to satisfy it was a branch no input
    // could reach. Mutation testing found it immediately, as two mutants with no
    // covering test, which is what unreachable code looks like from the outside.
    const total = Number(metrics[1]);
    const covered = Number(metrics[2]);

    if (total === 0) {
        throw new FloorError(`${label} reports zero statements — the suite covered nothing`);
    }

    return { total, covered, percent: Math.round((covered / total) * 10000) / 100 };
}

/**
 * The files a clover report describes, as the report spells them.
 *
 * A report names every file it measured, which is what makes staleness detectable with no
 * clock involved: a source file on disk that the report never heard of proves the report
 * describes a different tree. Paths come back verbatim — they are absolute and rooted
 * wherever the suite ran, so the caller compares basenames rather than paths.
 *
 * `String(...)`, not `?? ''`, for the same reason `parseClover` uses `Number(...)`: the group
 * cannot be absent once the regex matched, and the nullish branch written to satisfy
 * `noUncheckedIndexedAccess` is one no input can reach — which mutation testing reports as an
 * uncovered mutant rather than as the dead code it is.
 *
 * @param {string} xml raw report contents
 * @returns {string[]}
 */
export function cloverFiles(xml) {
    return [...xml.matchAll(/<file\s[^>]*\bname="([^"]*)"/g)].map((match) => String(match[1]));
}

/**
 * The source files a report is missing, by basename.
 *
 * Basenames rather than paths, and the two real formats settle it. PHPUnit writes
 * `name="/app/src/Arr.php"` — the absolute path of wherever the suite ran, which inside a
 * container is not where the caller is looking. Istanbul writes `name="coverage-floor.js"`
 * with the directory in a separate `path` attribute, and that attribute has been observed
 * holding `D:\Ricardo\...` in a report a Linux CI then read. Comparing paths would refuse
 * both. Two source files sharing a basename in
 * different directories collapse into one — accepted, because the alternative is path
 * arithmetic between two roots that need not share a prefix.
 *
 * @param {string[]} sources source files on disk
 * @param {string[]} covered files the report describes
 * @returns {string[]}
 */
export function absentFrom(sources, covered) {
    const known = new Set(covered.map((path) => basename(path)));

    return sources.filter((path) => !known.has(basename(path)));
}

/**
 * Compares a clover report against a repository's floor.
 *
 * @param {{ report: string, floorFile: string, sources?: string[] }} paths `sources` are the
 *   source files the report must describe; omitted or empty skips the staleness checks, which
 *   is what a caller with nothing to compare against should get rather than a guess
 * @returns {{ actual: number, floor: number, total: number, covered: number, rose: boolean }}
 * @throws {FloorError} when either file is missing, unreadable as expected, or the
 *   measured coverage is below the floor or more than {@link TOLERANCE} points above it
 */
export function evaluate({ report, floorFile, sources = [] }) {
    if (!existsSync(floorFile)) {
        throw new FloorError(
            `${floorFile} is missing — the floor is per-repo state and every repository owes one`,
        );
    }

    if (!existsSync(report)) {
        throw new FloorError(`${report} is missing — run the suite with --coverage`);
    }

    // The floor read needs no exclusion: `parseFloor` calls `.trim()`, Buffer has none,
    // and blanking the encoding therefore throws. That is worth stating because it was
    // the other way round one revision ago — the `.trim()` was redundant then, its
    // removal exposed this mutant, and tightening the parser put a real one back. A
    // mutant surviving on the presence of dead code is not the same as a mutant killed
    // by a deliberate one, and only the second is worth having.
    const floor = parseFloor(readFileSync(floorFile, 'utf8'), floorFile);

    // Stryker disable next-line StringLiteral: blanking this encoding makes readFileSync
    // return a Buffer rather than throwing, and `RegExp.exec` coerces one to exactly the
    // same string — the mutant is behaviourally equivalent, and killing it would mean
    // asserting a type the compiler already guarantees.
    const xml = readFileSync(report, 'utf8');
    const { total, covered, percent } = parseClover(xml, report);

    // A report is an artefact of the run that produced it, and nothing regenerates it: the
    // report path is gitignored, so `coverage` on its own grades whatever is on disk.
    // Measured on the PHP twin, whose binary is the same shape: a class added to src/ with
    // no test at all, and the verb printed `coverage rose … raise .coverage-floor to match`
    // and exited 0 — not merely a stale number, but advice that was the opposite of correct.
    // CI never sees this, because the step before it writes the report, which is the bad
    // half: the verb means one thing in the pipeline and a weaker thing on the machine where
    // someone would use it as a pre-push check. rak200/coding-standard-php#52
    // Stryker disable next-line ConditionalExpression,EqualityOperator: with an empty list
    // both checks are no-ops anyway — `absentFrom([], …)` is empty and the mtime scan leaves
    // `newest` at 0, which no report is older than. The guard is here to say that a caller
    // with nothing to compare gets the old behaviour, not to change the outcome.
    if (sources.length > 0) {
        // FIRST the file set, because it accuses precisely and without a clock: a source file
        // the report never mentions cannot be explained by a rebase or a checkout.
        const absent = absentFrom(sources, cloverFiles(xml));
        if (absent.length > 0) {
            const named = absent.slice(0, 3).join(', ');
            const rest = absent.length > 3 ? ` and ${String(absent.length - 3)} more` : '';
            throw new FloorError(
                `${report} describes a different tree — it never measured ${named}${rest}. Re-run the suite with coverage`,
            );
        }

        // THEN mtime, for what the file set cannot see: lines added to a file the report
        // already lists. A heuristic, and it says `may` rather than accusing — a rebase moves
        // mtime without moving content.
        let newest = 0;
        // Stryker disable next-line StringLiteral: the seed is only read when the throw
        // below fires, and that needs a source newer than the report — which means the loop
        // assigned. No input reaches the message with the seed still in it.
        let newestFile = '';
        for (const source of sources) {
            // `throwIfNoEntry: false` rather than a bare stat: the list is scanned a moment
            // earlier, and a file deleted in between is a race the check should survive
            // rather than report as ENOENT from inside a coverage gate.
            const at = statSync(source, { throwIfNoEntry: false })?.mtimeMs ?? 0;
            if (at > newest) {
                newest = at;
                newestFile = source;
            }
        }

        if (newest > statSync(report).mtimeMs) {
            throw new FloorError(
                `${report} is older than ${newestFile}, so it may describe a tree that has since changed. Re-run the suite with coverage`,
            );
        }
    }

    if (percent < floor) {
        throw new FloorError(`${percent.toFixed(2)}% is below the floor of ${floor.toFixed(2)}%`);
    }

    // The ratchet is enforced above the tolerance, and this comment used to say the
    // opposite: "reported, not enforced … it would have to be decided rather than
    // inherited from the word monotonic". It had been decided — RFC 0017, *Testing policy
    // and the coverage floor*, states the one-point band and the reason for it — and
    // neither side read the other, so the estate carried a rule in prose and a refusal to
    // implement it in code, each with its own argument. Both twins carried it, five hours
    // apart, which is how the same hole grows in two languages.
    //
    // Rounded before comparing, not compared directly. `percent` is already rounded to two
    // places while `floor` is whatever the file says, so `percent - floor` lands a few ulps
    // above 1 at exactly the boundary and would fail a repository sitting precisely one
    // point over — the one value the rule declares acceptable.
    if (Math.round((percent - floor) * 100) / 100 > TOLERANCE) {
        throw new FloorError(
            `${percent.toFixed(2)}% is more than ${TOLERANCE.toFixed(2)} points above the floor of ${floor.toFixed(2)}% — raise the floor in this pull request, so the gain is locked in by a check rather than by anyone remembering`,
        );
    }

    return { actual: percent, floor, total, covered, rose: percent > floor };
}
