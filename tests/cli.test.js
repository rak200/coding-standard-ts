import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
 * @returns {{ status: number, out: string }}
 */
function run(args) {
    try {
        return {
            status: 0,
            out: execFileSync(process.execPath, [bin, ...args], { encoding: 'utf8' }),
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
});
