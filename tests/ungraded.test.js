import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { report, ungraded } from '../src/ungraded.js';

/**
 * As much of Stryker's options schema as the test reads.
 *
 * @typedef {{ definitions: { jsonReporterOptions: { properties: { fileName: { default: string } } } } }} Schema
 */

/**
 * One mutant in the report's own shape, `Killed` unless told otherwise.
 *
 * @param {Partial<{ status: string, statusReason: string, mutatorName: string, line: number, column: number }>} [overrides]
 */
const mutant = ({
    status = 'Killed',
    statusReason,
    mutatorName = 'ConditionalExpression',
    line = 1,
    column = 1,
} = {}) => ({
    mutatorName,
    status,
    location: { start: { line, column }, end: { line, column: column + 1 } },
    ...(statusReason === undefined ? {} : { statusReason }),
});

/** @param {Record<string, ReturnType<typeof mutant>[]>} files */
const text = (files) =>
    JSON.stringify({
        schemaVersion: '2',
        files: Object.fromEntries(
            Object.entries(files).map(([file, mutants]) => [file, { mutants }]),
        ),
    });

describe('report', () => {
    it("is where Stryker's json reporter writes by default", () => {
        // Read out of the schema the installed Stryker ships, so a default that moves upstream
        // reds here — in the package that can change this line — rather than as a refusal in
        // every consumer that finds no report where the verb looks.
        const manifest = createRequire(import.meta.url).resolve(
            '@stryker-mutator/core/package.json',
        );
        const raw = /** @type {unknown} */ (
            JSON.parse(
                readFileSync(join(dirname(manifest), 'schema', 'stryker-schema.json'), 'utf8'),
            )
        );
        const schema = /** @type {Schema} */ (raw);

        expect(report).toBe(schema.definitions.jsonReporterOptions.properties.fileName.default);
    });
});

describe('ungraded', () => {
    it('is empty when every mutant was graded, whatever the verdict', () => {
        // `CompileError` among them, and deliberately: the mutated program does not
        // typecheck, which is a verdict — there is no behaviour for a test to catch.
        const graded = ['Killed', 'Survived', 'NoCoverage', 'Timeout', 'Ignored', 'CompileError'];

        expect(
            ungraded(text({ 'src/a.ts': graded.map((status) => mutant({ status })) }), report),
        ).toStrictEqual([]);
    });

    it('names each mutant the run errored on — where it is, what it was, and why', () => {
        const found = ungraded(
            text({
                'src/a.ts': [
                    mutant(),
                    mutant({
                        status: 'RuntimeError',
                        statusReason: 'An error occurred outside of a test run: Error: boom',
                        mutatorName: 'ArithmeticOperator',
                        line: 85,
                        column: 72,
                    }),
                ],
                'src/b.ts': [
                    mutant({
                        status: 'RuntimeError',
                        statusReason: 'Error: two',
                        line: 3,
                        column: 9,
                    }),
                ],
            }),
            report,
        );

        expect(found).toStrictEqual([
            'src/a.ts:85:72 ArithmeticOperator — An error occurred outside of a test run: Error: boom',
            'src/b.ts:3:9 ConditionalExpression — Error: two',
        ]);
    });

    it('keeps the first line of the reason, which is the one that names the failure', () => {
        // A browser runner's reason is a whole action log; the pipeline's output needs the
        // line at the top of it, and a reason that opens on a blank line still has one.
        const found = ungraded(
            text({
                'src/a.ts': [
                    mutant({
                        status: 'RuntimeError',
                        statusReason:
                            '\n  Error: Failed to connect\n    at Timeout._onTimeout (cli-api.js:465:33)\n',
                    }),
                ],
            }),
            report,
        );

        expect(found).toStrictEqual([
            'src/a.ts:1:1 ConditionalExpression — Error: Failed to connect',
        ]);
    });

    it.each([
        ['absent', undefined],
        ['blank', ' \n '],
    ])(
        'says so when the reason is %s, rather than printing nothing after the dash',
        (_, statusReason) => {
            const found = ungraded(
                text({ 'src/a.ts': [mutant({ status: 'RuntimeError', statusReason })] }),
                report,
            );

            expect(found).toStrictEqual([
                'src/a.ts:1:1 ConditionalExpression — no reason recorded',
            ]);
        },
    );

    it.each([
        ['a number', '1'],
        ['null', 'null'],
        ['an object with no files', '{}'],
        ['files that are not an object', '{"files": 1}'],
        ['files that are null', '{"files": null}'],
    ])('refuses %s, naming the file it read', (_, raw) => {
        // Refused rather than read as empty: a report with nothing in it would pass every
        // run, which is the silence this module exists to end.
        expect(() => ungraded(raw, 'somewhere/report.json')).toThrow(
            'somewhere/report.json is not a mutation report — it has no files to read',
        );
    });
});
