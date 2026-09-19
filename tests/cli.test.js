import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * The binary itself: argv, stdio and the exit code. Everything it decides lives in
 * src/ and is tested there in-process — a child process is invisible to the coverage
 * instrumentation, so these cases prove the wiring rather than the logic.
 */

const bin = fileURLToPath(new URL('../bin/coverage-floor.js', import.meta.url));

/**
 * Runs the binary, returning its output and exit status without throwing.
 *
 * @param {string[]} args
 * @param {string} [cwd] where to run it, for the cases that exercise the tree scan —
 *   which reads `src/` relative to the working directory and only when no report is named
 * @returns {{ status: number, out: string }}
 */
function run(args, cwd = process.cwd()) {
    try {
        return {
            status: 0,
            out: execFileSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' }),
        };
    } catch (error) {
        // Typed as what execFileSync actually attaches on failure, rather than as
        // SpawnSyncReturns: that type declares stdout and stderr non-nullable, which
        // makes the `??` fallbacks below read as dead code to the linter while they
        // are the reason this helper never throws.
        const failure =
            /** @type {{ status: number | null, stdout: string | null, stderr: string | null }} */ (
                /** @type {unknown} */ (error)
            );

        return {
            status: failure.status ?? -1,
            out: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
        };
    }
}

describe('coverage-floor', () => {
    /** @type {string} */
    let dir;
    /** @type {string} */
    let report;
    /** @type {string} */
    let floorFile;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'coverage-floor-cli-'));
        report = join(dir, 'clover.xml');
        floorFile = join(dir, '.coverage-floor');
        writeFileSync(
            report,
            '<coverage><project><metrics statements="100" coveredstatements="99"/></project></coverage>',
        );
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('exits 0 and prints the measurement when the floor is met', () => {
        writeFileSync(floorFile, '99\n');

        const { status, out } = run([report, floorFile]);

        expect(status).toBe(0);
        expect(out).toContain('coverage 99.00% (99/100 statements), floor 99.00%');
    });

    it('emits a notice when coverage has risen inside the tolerance', () => {
        writeFileSync(floorFile, '98.5\n');

        const { status, out } = run([report, floorFile]);

        expect(status).toBe(0);
        expect(out).toContain('::notice::coverage rose to 99.00%');
    });

    it('exits 1 when coverage is more than one point above the floor', () => {
        writeFileSync(floorFile, '95\n');

        const { status, out } = run([report, floorFile]);

        expect(status).toBe(1);
        expect(out).toContain(
            '::error::coverage floor: 99.00% is more than 1.00 points above the floor of 95.00%',
        );
    });

    it('exits 1 with a GitHub error annotation when the floor is missed', () => {
        writeFileSync(floorFile, '99.5\n');

        const { status, out } = run([report, floorFile]);

        expect(status).toBe(1);
        expect(out).toContain('::error::coverage floor: 99.00% is below the floor of 99.50%');
    });

    it('exits 1 when the floor file is absent', () => {
        const { status, out } = run([report, floorFile]);

        expect(status).toBe(1);
        expect(out).toContain('::error::coverage floor:');
    });

    describe('the default report, which is the only one checked against a tree', () => {
        /** @type {string} */
        let repo;

        beforeEach(() => {
            // A repository shaped like rak200/ui: a hand-written source the suite measures, and
            // a generated tree it deliberately does not. `mkdirSync` writes both levels, and
            // every source is stamped older than the report so the mtime half of the staleness
            // check cannot be what decides these cases — it is the file set that must.
            repo = mkdtempSync(join(tmpdir(), 'coverage-floor-repo-'));
            mkdirSync(join(repo, 'src', 'icons'), { recursive: true });
            mkdirSync(join(repo, 'coverage'));
            writeFileSync(join(repo, 'src', 'a.ts'), '//');
            writeFileSync(join(repo, 'src', 'icons', 'g.ts'), '//');
            writeFileSync(join(repo, '.coverage-floor'), '95\n');
            writeFileSync(
                join(repo, 'coverage', 'clover.xml'),
                '<coverage><project><metrics statements="100" coveredstatements="95"/>' +
                    '<file name="/app/src/a.ts"/></project></coverage>',
            );
            utimesSync(join(repo, 'src', 'a.ts'), 1000, 1000);
            utimesSync(join(repo, 'src', 'icons', 'g.ts'), 1000, 1000);
            utimesSync(join(repo, 'coverage', 'clover.xml'), 2000, 2000);
        });

        afterEach(() => {
            rmSync(repo, { recursive: true, force: true });
        });

        it('refuses a report that never measured the generated tree', () => {
            const { status, out } = run([], repo);

            expect(status).toBe(1);
            expect(out).toContain('never measured src/icons/g.ts');
        });

        it('accepts it once that tree is dropped', () => {
            const { status, out } = run(['--drop-prefix', join('src', 'icons')], repo);

            expect(status).toBe(0);
            expect(out).toContain('coverage 95.00% (95/100 statements), floor 95.00%');
        });

        it('exits 1 when the dropped prefix matches nothing', () => {
            const { status, out } = run(['--drop-prefix', 'src/glyphs/'], repo);

            expect(status).toBe(1);
            expect(out).toContain('::error::coverage floor: --drop-prefix src/glyphs/ matched no');
        });
    });
});
