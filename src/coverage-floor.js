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

import { existsSync, readFileSync } from 'node:fs';

/**
 * The floor below which no repository may set its own floor. A per-repo `.coverage-floor`
 * ratchets **up** from here; it is never lowered to accommodate a failing suite.
 */
export const HARD_FLOOR = 95;

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
 * Compares a clover report against a repository's floor.
 *
 * @param {{ report: string, floorFile: string }} paths
 * @returns {{ actual: number, floor: number, total: number, covered: number, rose: boolean }}
 * @throws {FloorError} when either file is missing, unreadable as expected, or the
 *   measured coverage is below the floor
 */
export function evaluate({ report, floorFile }) {
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
    const { total, covered, percent } = parseClover(readFileSync(report, 'utf8'), report);

    if (percent < floor) {
        throw new FloorError(`${percent.toFixed(2)}% is below the floor of ${floor.toFixed(2)}%`);
    }

    // The ratchet is reported, not enforced: failing a pull request for *improving*
    // coverage is a different policy, and it would have to be decided rather than
    // inherited from the word "monotonic".
    return { actual: percent, floor, total, covered, rose: percent > floor };
}
