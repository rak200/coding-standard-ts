#!/usr/bin/env node

/**
 * Layer 2 (TypeScript) — the coverage floor, bound to the `coverage` verb.
 *
 *     coverage-floor [--drop-prefix <path>] [clover-report] [floor-file]
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

import { FloorError, evaluate, sourceFiles } from '../src/coverage-floor.js';

// `--drop-prefix` is read out of argv before the positionals, so the two orders a person
// writes both work. Parsed the same way, and spelled the same way, as rak200-mutate's: a
// repository that vendors a generated tree excludes it from both floors, and typing one
// string twice beats learning two.
const argv = process.argv.slice(2);
/** @type {string[]} */
const drop = [];
/** @type {string[]} */
const positional = [];
for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--drop-prefix' && i + 1 < argv.length) {
        drop.push(argv[i + 1]);
        i += 1;
        continue;
    }
    positional.push(argv[i]);
}

const report = positional[0] ?? 'coverage/clover.xml';
const floorFile = positional[1] ?? '.coverage-floor';

try {
    // The tree the report is checked against, and ONLY when grading the default report. A
    // caller that names one has said nothing about which tree it describes — this package's own
    // suite grades fixtures under a temporary directory — so scanning src/ there would refuse
    // correct input. With the default, the report is this repository's by construction: the
    // pipeline writes it one step earlier.
    const sources = positional[0] === undefined ? sourceFiles('src', drop) : [];
    const { actual, floor, total, covered, rose } = evaluate({ report, floorFile, sources });

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
