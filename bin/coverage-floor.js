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
 *
 * This file holds argv, stdio and the exit code, and nothing else. The logic it calls
 * lives in ../src/coverage-floor.js so that it can be measured — see the note there.
 */

import { FloorError, evaluate } from '../src/coverage-floor.js';

const report = process.argv[2] ?? 'coverage/clover.xml';
const floorFile = process.argv[3] ?? '.coverage-floor';

try {
    const { actual, floor, total, covered, rose } = evaluate({ report, floorFile });

    process.stdout.write(
        `coverage ${actual.toFixed(2)}% (${String(covered)}/${String(total)} statements), ` +
            `floor ${floor.toFixed(2)}%\n`,
    );

    if (rose) {
        process.stdout.write(
            `::notice::coverage rose to ${actual.toFixed(2)}% — raise ${floorFile} to match\n`,
        );
    }
} catch (error) {
    if (error instanceof FloorError) {
        process.stderr.write(`::error::coverage floor: ${error.message}\n`);
        process.exit(1);
    }

    throw error;
}
