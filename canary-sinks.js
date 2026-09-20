/**
 * Canary fixture — three sinks the scanner is expected to refuse.
 *
 * Nothing imports this file and nothing runs it: it exists so `npm run scan` has
 * something to find. It sits at the repository root on purpose — `src/` is what the
 * coverage floor scans, and an uncovered file there would redden the step before the
 * scanner ever runs, masking the canary this fixture is.
 */

import { exec } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * @param {string} pattern
 * @returns {RegExp}
 */
export function compile(pattern) {
    return new RegExp(pattern);
}

/**
 * @param {string} command
 * @returns {void}
 */
export function run(command) {
    exec(command, () => undefined);
}

/**
 * @param {string} name
 * @returns {string}
 */
export function read(name) {
    return readFileSync(`/var/data/${name}`, 'utf8');
}
