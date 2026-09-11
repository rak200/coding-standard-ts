#!/usr/bin/env node

/**
 * Layer 2 (TypeScript) — the `mutation` verb, narrowed to the lines a pull request changed.
 *
 *     rak200-mutate [--drop-prefix <path>] [-- <stryker arguments>]
 *
 * Runs Stryker with every `--mutate` value rewritten into the ranges the diff touches, which
 * is what Layer 1 asks for and what Stryker has no flag to do itself. Everything it decides
 * lives in ../src/mutate-changed.js, where the suite reaches it — see the note there, and the
 * same note on bin/rak200-scan.js.
 *
 * `--drop-prefix` is for a repository that vendors a generated tree: rak200/ui carries 2048
 * glyph modules, each with its own `// Stryker disable all`, and an ignored mutant is still a
 * created one — Stryker instrumented 2052 files into 4210 mutants and threw all but 113 away,
 * five minutes before the first test ran. Dropping the prefix here costs nothing to drop. It
 * is an option rather than a script so that the consumer stops carrying one.
 *
 * No counterpart in tests/cli.test.js: what this file does beyond src/ is resolve Stryker's
 * bin through its own manifest, spawn it and exit with its code — the same wiring, and the
 * same argument for not testing it, that bin/rak200-scan.js states.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { baseRef, forward, strykerBin } from '../src/mutate-changed.js';

const require = createRequire(import.meta.url);

// Resolved through the manifest rather than hardcoded as ./bin/stryker.js: the path is the
// package's to change, and a hardcoded one breaks on an upgrade with no diagnosis.
/** @returns {string} */
function stryker() {
    const manifest = require.resolve('@stryker-mutator/core/package.json');
    return join(dirname(manifest), strykerBin(readFileSync(manifest, 'utf8'), manifest));
}

// The diff of one file against the base, or null when git refuses — an unfetched base above
// all. src/ turns null into "keep the whole file", because narrowing on a diff that could not
// be read is how a gate goes quiet.
/**
 * @param {string} file
 * @param {string} from
 * @returns {string | null}
 */
function read(file, from) {
    const diff = spawnSync('git', ['diff', '--unified=0', `${from}...HEAD`, '--', file], {
        encoding: 'utf8',
    });
    return diff.status === 0 ? diff.stdout : null;
}

const argv = process.argv.slice(2);
/** @type {string[]} */
const prefixes = [];
/** @type {string[]} */
const rest = [];
for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--drop-prefix' && i + 1 < argv.length) {
        prefixes.push(argv[i + 1]);
        i += 1;
        continue;
    }
    rest.push(argv[i]);
}

const { args, emptied, announced } = forward(rest, baseRef(process.env), read, (pattern) =>
    prefixes.some((prefix) => pattern.startsWith(prefix) || pattern.startsWith(`./${prefix}`)),
);

// Reported before running, for the reason rak200-scan.js gives about its own command line:
// what a run actually covered should be one line of reading afterwards, not an investigation.
if (announced !== '') {
    process.stdout.write(`mutating ranges: ${announced}\n`);
}

if (emptied !== '') {
    process.stdout.write(`mutation: ${emptied} — nothing to mutate\n`);
    process.exit(0);
}

const { status } = spawnSync(process.execPath, [stryker(), 'run', ...args], { stdio: 'inherit' });

// null is a run killed by a signal, and a killed run is not a run that passed.
process.exit(status ?? 1);
