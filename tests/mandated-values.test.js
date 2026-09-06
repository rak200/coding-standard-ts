import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// The numbers this standard mandates are stated twice: once as prose a human reads, and
// once as configuration a tool executes. Nothing kept the two in step.
//
// The pipeline asserts that a consumer does not weaken these values, and it reads them
// from the configuration in this package — so the configuration is what the estate
// actually enforces, and CONVENTIONS.md is what a reader believes. Change one and not the
// other and the divergence is invisible everywhere else: the fleet follows the config
// while the document keeps stating the old bar.
//
// A test rather than a CI step on purpose. It asserts a relationship between files in this
// repository, needs nothing installed, and runs under `npm test`.

/**
 * @param {string} file
 * @returns {string}
 */
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

/**
 * The first capture of `pattern` in `file`.
 *
 * Throwing on no match rather than returning undefined is the point: a value that stopped
 * being stated is the same defect as one that changed, and undefined compared to undefined
 * would pass on a document that says nothing at all.
 *
 * @param {RegExp} pattern
 * @param {string} file
 * @returns {string}
 */
const matched = (pattern, file) => {
    const found = pattern.exec(read(file));
    if (found === null) {
        throw new Error(`${pattern.source} matches nothing in ${file}`);
    }

    return found[1];
};

describe('the conventions and the config state the same numbers', () => {
    it('states the ESLint tier the base config enables', () => {
        expect(matched(/`(\w+TypeChecked)`/, 'CONVENTIONS.md')).toBe(
            matched(/tseslint\.configs\.(\w+TypeChecked)/, 'eslint.base.js'),
        );
    });

    it('states the mutation floor the base config breaks on', () => {
        expect(matched(/`thresholds\.break:\s*(\d+)`/, 'CONVENTIONS.md')).toBe(
            matched(/thresholds:\s*\{[^}]*break:\s*(\d+)/, 'stryker.base.js'),
        );
    });

    it('states the Node floor the manifest declares', () => {
        // The prose writes the floor as `22.13+` and the manifest as `>=22.13.0`, so the
        // comparison is on the two components the prose commits to. A third component
        // would be a claim the document does not make.
        expect(matched(/\*\*Node (\d+\.\d+)\+\*\*/, 'CONVENTIONS.md')).toBe(
            matched(/"node":\s*">=(\d+\.\d+)/, 'package.json'),
        );
    });
});
