import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    FloorError,
    HARD_FLOOR,
    evaluate,
    parseClover,
    parseFloor,
} from '../src/coverage-floor.js';

/**
 * A clover report with the given statement totals, trimmed to what the parser reads.
 *
 * @param {number} total
 * @param {number} covered
 * @returns {string}
 */
const clover = (total, covered) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<coverage generated="1"><project timestamp="1"><metrics files="1" loc="10" ncloc="10" ` +
    `classes="1" methods="1" coveredmethods="1" conditionals="0" coveredconditionals="0" ` +
    `statements="${String(total)}" coveredstatements="${String(covered)}" elements="1" ` +
    `coveredelements="1"/></project></coverage>`;

describe('parseFloor', () => {
    it('reads a number', () => {
        expect(parseFloor('98\n', '.coverage-floor')).toBe(98);
    });

    it('reads a fractional floor', () => {
        expect(parseFloor(' 97.5 ', '.coverage-floor')).toBe(97.5);
    });

    it.each([
        ['a word', 'high\n'],
        ['empty', ''],
        ['whitespace only', '   \n'],
        // parseFloat read 98 out of both of these and the floor passed. The PHP twin
        // rejects them through `is_numeric`, and one estate should not hold two opinions
        // about what a `.coverage-floor` file may contain.
        ['a number with a tail', '98abc'],
        ['a percentage sign', '98%'],
    ])('rejects %s, naming the file', (_case, text) => {
        expect(() => parseFloor(text, 'the/floor')).toThrow(FloorError);
        expect(() => parseFloor(text, 'the/floor')).toThrow(
            /^the\/floor does not contain a number$/,
        );
    });

    it('throws an error identifying itself as a FloorError', () => {
        // `name` is what a caller matches on when it cannot use instanceof — across a
        // process boundary, or after serialisation. Asserted because nothing else did:
        // mutation testing blanked the assignment and every test still passed.
        expect(() => parseFloor('high', '.coverage-floor')).toThrow(
            expect.objectContaining({ name: 'FloorError' }),
        );
    });

    it('rejects a floor below the hard floor, and reports both numbers', () => {
        expect(() => parseFloor('94.99', '.coverage-floor')).toThrow(
            /says 94.99, below the hard floor of 95/,
        );
    });

    it('accepts exactly the hard floor', () => {
        expect(parseFloor(String(HARD_FLOOR), '.coverage-floor')).toBe(HARD_FLOOR);
    });
});

describe('parseClover', () => {
    it('reads statement totals and computes a percentage', () => {
        expect(parseClover(clover(200, 197), 'coverage/clover.xml')).toStrictEqual({
            total: 200,
            covered: 197,
            percent: 98.5,
        });
    });

    it('rounds to two decimals rather than truncating', () => {
        // 1624/1659 is 97.8902…, the real figure that first exposed the pcov/xdebug
        // one-statement discrepancy on rak200/utils.
        expect(parseClover(clover(1659, 1624), 'r.xml').percent).toBe(97.89);
    });

    it('rejects a document with no metrics element', () => {
        expect(() => parseClover('<coverage/>', 'r.xml')).toThrow(
            /is not a clover report with statement metrics/,
        );
    });

    it('rejects a report of zero statements rather than dividing by it', () => {
        expect(() => parseClover(clover(0, 0), 'r.xml')).toThrow(/reports zero statements/);
    });

    it('reads the first metrics element, which is the project total', () => {
        const xml = `${clover(10, 10)}${clover(999, 0)}`;
        expect(parseClover(xml, 'r.xml').total).toBe(10);
    });

    it('tolerates other attributes between the two it reads', () => {
        // Clover writers are free to order attributes as they like, and the two this
        // parser needs are not required to be adjacent. Asserted because the fixtures
        // above happen to put them side by side: a mutant narrowing the gap between
        // them to a single character survived every one of those tests.
        const xml =
            '<metrics files="1" statements="200" elements="7" coveredelements="7" ' +
            'coveredstatements="197"/>';

        expect(parseClover(xml, 'r.xml')).toMatchObject({ total: 200, covered: 197 });
    });
});

describe('evaluate', () => {
    /** @type {string} */
    let dir;
    /** @type {string} */
    let report;
    /** @type {string} */
    let floorFile;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'coverage-floor-'));
        report = join(dir, 'clover.xml');
        floorFile = join(dir, '.coverage-floor');
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('passes when coverage is above the floor and reports the rise', () => {
        writeFileSync(floorFile, '95\n');
        writeFileSync(report, clover(100, 99));

        expect(evaluate({ report, floorFile })).toStrictEqual({
            actual: 99,
            floor: 95,
            total: 100,
            covered: 99,
            rose: true,
        });
    });

    it('passes when coverage exactly meets the floor, and does not report a rise', () => {
        writeFileSync(floorFile, '95\n');
        writeFileSync(report, clover(100, 95));

        expect(evaluate({ report, floorFile })).toMatchObject({ actual: 95, rose: false });
    });

    it('fails when coverage is below the floor, naming both numbers', () => {
        writeFileSync(floorFile, '99\n');
        writeFileSync(report, clover(100, 98));

        expect(() => evaluate({ report, floorFile })).toThrow(
            /98.00% is below the floor of 99.00%/,
        );
    });

    it('fails when the floor file is absent, before looking at the report', () => {
        writeFileSync(report, clover(100, 100));

        expect(() => evaluate({ report, floorFile })).toThrow(
            /is missing — the floor is per-repo state/,
        );
    });

    it('fails when the report is absent', () => {
        writeFileSync(floorFile, '95\n');

        expect(() => evaluate({ report, floorFile })).toThrow(/is missing — run the suite/);
    });
});
