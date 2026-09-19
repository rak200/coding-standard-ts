import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    FloorError,
    HARD_FLOOR,
    evaluate,
    parseClover,
    parseFloor,
    absentFrom,
    cloverFiles,
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

/** A clover report naming the files it measured, at 95 of 100 statements — inside the band. */
/** @param {string[]} files */
const cloverWithFiles = (...files) =>
    `<?xml version="1.0" encoding="UTF-8"?><coverage><project>` +
    // The project metrics come FIRST, as istanbul writes them — `parseClover` takes the
    // document's first `<metrics>`, and a fixture in the other order would measure a file.
    `<metrics statements="100" coveredstatements="95"/>` +
    files
        .map((f) => `<file name="${f}"><metrics statements="1" coveredstatements="1"/></file>`)
        .join('') +
    `</project></coverage>`;

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

    it('passes when coverage rises inside the tolerance and reports the rise', () => {
        writeFileSync(floorFile, '98.5\n');
        writeFileSync(report, clover(100, 99));

        expect(evaluate({ report, floorFile })).toStrictEqual({
            actual: 99,
            floor: 98.5,
            total: 100,
            covered: 99,
            rose: true,
        });
    });

    it('passes at exactly the tolerance', () => {
        // The boundary the rule declares acceptable, and the reason `evaluate` rounds the
        // difference before comparing it: 99 - 98 is not 1 in binary floating point, and a
        // direct `> TOLERANCE` fails this case while every other test passes.
        writeFileSync(floorFile, '98\n');
        writeFileSync(report, clover(100, 99));

        expect(evaluate({ report, floorFile })).toMatchObject({ actual: 99, rose: true });
    });

    it('rounds the excess to two places and not to one', () => {
        // 1.04 over the floor. At two places that is 1.04 and the gate fires; at one it
        // is 1.00 and it does not. `Math.floor` gives 1 here and also does not, so this
        // pins the rounding function on that side too. Carried over from the PHP twin,
        // where Infection escaped four mutants on exactly this — the 2 becoming a 1 or a
        // 3, and `round` becoming `floor` or `ceil` — because the boundary case above
        // gives the same answer under every one of them. Stryker did not ask for these,
        // and they are here anyway: the twins answer to one definition of the rule, so
        // they owe the same assertions rather than the ones each mutator happens to want.
        writeFileSync(floorFile, '97.96\n');
        writeFileSync(report, clover(100, 99));

        expect(() => evaluate({ report, floorFile })).toThrow(FloorError);
    });

    it('rounds the excess to two places and not to three', () => {
        // The other side, and it has to pass: 1.004 over the floor is 1.00 at two places
        // and inside the tolerance, 1.004 at three and outside it. `Math.ceil` gives 2
        // and would fire, which pins the function in the direction the case above cannot.
        writeFileSync(floorFile, '97.996\n');
        writeFileSync(report, clover(100, 99));

        expect(evaluate({ report, floorFile })).toMatchObject({ actual: 99, rose: true });
    });

    it('fails more than one point above the floor, naming all three numbers', () => {
        writeFileSync(floorFile, '95\n');
        writeFileSync(report, clover(100, 99));

        // The whole message: the two numbers alone read as a complaint about improving
        // coverage. The instruction is the half that makes it actionable, and a mutant
        // dropping it leaves a gate nobody knows how to satisfy.
        expect(() => evaluate({ report, floorFile })).toThrow(
            '99.00% is more than 1.00 points above the floor of 95.00% — raise the floor in this pull request, so the gain is locked in by a check rather than by anyone remembering',
        );
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

    it('refuses a report that never measured a source file', () => {
        // The defect this exists for: a class added to src/ with no test, and the verb
        // printed `coverage rose` and exited 0 because the report on disk predated it.
        writeFileSync(floorFile, '95\n');
        writeFileSync(report, cloverWithFiles('/app/src/a.js'));

        expect(() => evaluate({ report, floorFile, sources: ['src/a.js', 'src/new.js'] })).toThrow(
            /describes a different tree — it never measured src\/new\.js/,
        );
    });

    it('names at most three absent files and counts the rest', () => {
        writeFileSync(floorFile, '95\n');
        // The report measures something none of the sources name, so all four are absent.
        writeFileSync(report, cloverWithFiles('/app/src/measured.js'));

        expect(() =>
            evaluate({ report, floorFile, sources: ['a.js', 'b.js', 'c.js', 'd.js'] }),
        ).toThrow(/a\.js, b\.js, c\.js and 1 more/);
    });

    it('says and one more only when there is a fourth', () => {
        // Exactly three names all three and counts nothing: `> 3` rather than `>= 3`, which
        // would append "and 0 more".
        writeFileSync(floorFile, '95\n');
        writeFileSync(report, cloverWithFiles('/app/src/measured.js'));

        expect(() => evaluate({ report, floorFile, sources: ['a.js', 'b.js', 'c.js'] })).toThrow(
            /never measured a\.js, b\.js, c\.js\. Re-run/,
        );
    });

    it('compares basenames, so a report written elsewhere still matches', () => {
        // The report records where the suite ran — inside a container, `/app/src/a.js` — and
        // the caller is looking at `src/a.js`. Comparing paths would refuse every report.
        writeFileSync(floorFile, '95\n');
        writeFileSync(report, cloverWithFiles('/app/src/a.js'));

        expect(evaluate({ report, floorFile, sources: ['src/a.js'] }).floor).toBe(95);
    });

    it('refuses a report older than a source file it already measured', () => {
        // What the file set cannot see: lines added to a file the report already lists.
        const source = join(dir, 'a.js');
        writeFileSync(floorFile, '95\n');
        writeFileSync(report, cloverWithFiles('/app/a.js'));
        writeFileSync(source, '//');
        utimesSync(report, 1000, 1000);
        utimesSync(source, 2000, 2000);

        expect(() => evaluate({ report, floorFile, sources: [source] })).toThrow(/is older than/);
    });

    it('names the first of two sources sharing the newest time', () => {
        // `>` rather than `>=` in the scan: with two files at the same mtime the message
        // names the first. The message is the whole value of this check.
        const first = join(dir, 'a.js');
        const second = join(dir, 'b.js');
        writeFileSync(floorFile, '95\n');
        writeFileSync(report, cloverWithFiles('/app/a.js', '/app/b.js'));
        writeFileSync(first, '//');
        writeFileSync(second, '//');
        utimesSync(report, 1000, 1000);
        utimesSync(first, 2000, 2000);
        utimesSync(second, 2000, 2000);

        expect(() => evaluate({ report, floorFile, sources: [first, second] })).toThrow(
            `is older than ${first},`,
        );
    });

    it('accepts a report exactly as old as its newest source', () => {
        // The boundary: a report written in the same moment as the last edit is the report of
        // that edit, and `>=` would refuse the run the pipeline itself produces.
        const source = join(dir, 'a.js');
        writeFileSync(floorFile, '95\n');
        writeFileSync(report, cloverWithFiles('/app/a.js'));
        writeFileSync(source, '//');
        utimesSync(source, 2000, 2000);
        utimesSync(report, 2000, 2000);

        expect(evaluate({ report, floorFile, sources: [source] }).floor).toBe(95);
    });

    it('skips both staleness checks when given no sources', () => {
        writeFileSync(floorFile, '95\n');
        writeFileSync(report, cloverWithFiles('/app/src/a.js'));
        utimesSync(report, 1000, 1000);

        expect(evaluate({ report, floorFile }).floor).toBe(95);
    });
});

describe('cloverFiles', () => {
    it('names every file the report measured', () => {
        expect(cloverFiles(cloverWithFiles('/app/src/a.js', '/app/src/b.js'))).toStrictEqual([
            '/app/src/a.js',
            '/app/src/b.js',
        ]);
    });

    it('matches a file element rather than anything beginning with those letters', () => {
        // `<file\s`, not `<file`: without the space a `<filename=` attribute elsewhere in the
        // document would be read as a measured file, and the check would then accuse a
        // correct report of missing something.
        expect(cloverFiles('<filename="a.js"/><file name="b.js"/>')).toStrictEqual(['b.js']);
    });

    it('takes the name attribute rather than one ending in it', () => {
        // `\bname=`, not `name=`: `surname="…"` ends in `name=` and would win, because it
        // comes first.
        expect(cloverFiles('<file surname="a.js" name="b.js"/>')).toStrictEqual(['b.js']);
    });

    it('is empty when the report names no file', () => {
        expect(cloverFiles(clover(100, 100))).toStrictEqual([]);
    });
});

describe('absentFrom', () => {
    it('is empty when every source is measured, by basename', () => {
        expect(absentFrom(['src/a.js'], ['/app/src/a.js'])).toStrictEqual([]);
    });

    it('names the sources the report never measured', () => {
        expect(absentFrom(['src/a.js', 'src/new.js'], ['/app/src/a.js'])).toStrictEqual([
            'src/new.js',
        ]);
    });
});
