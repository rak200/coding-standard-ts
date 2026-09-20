/**
 * Canary fixture — sinks the scanner is expected to refuse.
 *
 * Nothing imports this file and nothing runs it: it exists so `npm run scan` has
 * something to find. It sits at the repository root on purpose — `src/` is what the
 * coverage floor scans, and an uncovered file there would redden the step before the
 * scanner ever runs, masking the canary this fixture is.
 *
 * Seven shapes rather than one. Round 1 planted three and semgrep reported 0 findings
 * over 68 rules: the anonymous subset of `p/javascript` and `p/typescript` does not carry
 * the eslint-plugin-security ports that round assumed. A fixture nothing matches is a
 * canary that proves nothing.
 */

import { exec } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request } from 'node:https';
import { join } from 'node:path';

/**
 * @param {string} expression
 * @returns {unknown}
 */
export function evaluate(expression) {
    return eval(expression);
}

/**
 * @param {string} body
 * @returns {unknown}
 */
export function build(body) {
    return new Function(body)();
}

/**
 * @param {string} directory
 * @returns {void}
 */
export function list(directory) {
    exec('ls ' + directory, () => undefined);
}

/**
 * @param {string} pattern
 * @returns {RegExp}
 */
export function compile(pattern) {
    return new RegExp(pattern);
}

/**
 * @param {string} name
 * @returns {string}
 */
export function read(name) {
    return readFileSync(join('/var/data', name), 'utf8');
}

/**
 * @param {string} password
 * @returns {string}
 */
export function digest(password) {
    return createHash('md5').update(password).digest('hex');
}

/**
 * @param {string} url
 * @returns {void}
 */
export function fetchInsecurely(url) {
    request(url, { rejectUnauthorized: false }).end();
}
