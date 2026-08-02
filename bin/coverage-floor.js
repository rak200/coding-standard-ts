#!/usr/bin/env node

/**
 * Layer 2 (TypeScript) — the coverage floor, bound to the `coverage` verb.
 *
 *     coverage-floor [clover-report] [floor-file]
 *
 * Enforced inside the CI job, from files in the repository, so the required check
 * never waits on a third party — Codecov is reporting only. The floor itself is
 * per-repo state in `.coverage-floor`, never a seed: it is hard-floored at 95 and
 * ratchets up as coverage improves.
 *
 * Deliberately a twin of the PHP binary rather than a shared one: both read the same
 * clover attributes, and a package that had to be installed by both ecosystems to
 * check a number would be worse than forty duplicated lines.
 */

import { readFileSync, existsSync } from 'node:fs';

const HARD_FLOOR = 95;

const report = process.argv[2] ?? 'coverage/clover.xml';
const floorFile = process.argv[3] ?? '.coverage-floor';

/** Writes a message and stops with a failing status. */
function fail(message) {
    process.stderr.write(`::error::coverage floor: ${message}\n`);
    process.exit(1);
}

if (!existsSync(floorFile)) {
    fail(`${floorFile} is missing — the floor is per-repo state and every repository owes one`);
}

if (!existsSync(report)) {
    fail(`${report} is missing — run the suite with --coverage`);
}

const floor = Number.parseFloat(readFileSync(floorFile, 'utf8').trim());

if (!Number.isFinite(floor)) {
    fail(`${floorFile} does not contain a number`);
}

if (floor < HARD_FLOOR) {
    fail(`${floorFile} says ${floor}, below the hard floor of ${HARD_FLOOR}`);
}

const xml = readFileSync(report, 'utf8');
const metrics = /<metrics[^>]*\bstatements="(\d+)"[^>]*\bcoveredstatements="(\d+)"/.exec(xml);

if (metrics === null) {
    fail(`${report} is not a clover report with statement metrics`);
}

const total = Number.parseInt(metrics[1], 10);
const covered = Number.parseInt(metrics[2], 10);

if (total === 0) {
    fail(`${report} reports zero statements — the suite covered nothing`);
}

const actual = Math.round((covered / total) * 10000) / 100;

process.stdout.write(
    `coverage ${actual.toFixed(2)}% (${covered}/${total} statements), floor ${floor.toFixed(2)}%\n`,
);

if (actual < floor) {
    fail(`${actual.toFixed(2)}% is below the floor of ${floor.toFixed(2)}%`);
}

// The ratchet is reported, not enforced: failing a pull request for *improving*
// coverage is a different policy, and it would have to be decided rather than
// inherited from the word "monotonic".
if (actual > floor) {
    process.stdout.write(
        `::notice::coverage rose to ${actual.toFixed(2)}% — raise ${floorFile} to match\n`,
    );
}
