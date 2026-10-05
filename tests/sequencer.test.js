import { describe, expect, it } from 'vitest';
import { BaseSequencer } from 'vitest/node';

import { MirrorFirstSequencer, mirrorOf } from '../src/sequencer.js';

/** @typedef {import('vitest/node').TestSpecification} TestSpecification */
/** @typedef {import('vitest/node').Vitest} Vitest */
/** @typedef {Parameters<Vitest['onCancel']>[0]} CancelListener */

const root = '/repo';

/**
 * A test file as a sequencer is handed one: its path, and the one project it belongs to.
 *
 * @param {string} path relative to the root
 * @returns {TestSpecification}
 */
const spec = (path) =>
    /** @type {TestSpecification} */ (
        /** @type {unknown} */ ({
            moduleId: `${root}/${path}`,
            project: { name: '', config: { sequence: { groupOrder: 0 }, isolate: true } },
        })
    );

/**
 * A Vitest instance as far as a sequencer reads one: the scope of the run, what the last runs of
 * each file left in the cache, and the cancel listeners — cleared at the start of every run, as
 * `runFiles()` clears them.
 *
 * @param {{ related?: string[], results?: Record<string, { duration: number, failed: boolean }>, sizes?: Record<string, number> }} [state]
 */
function vitest({ related, results = {}, sizes = {} } = {}) {
    /** @type {Set<CancelListener>} */
    const listeners = new Set();
    const ctx = {
        config: { root, related },
        cache: {
            /** @param {string} key */
            getFileTestResults: (key) => results[key.slice(1)],
            /** @param {string} key */
            getFileStats: (key) => {
                const size = sizes[key.slice(1)];
                return size === undefined ? undefined : { size };
            },
        },
        /** @param {CancelListener} listener */
        onCancel(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };

    return { ctx: /** @type {Vitest} */ (/** @type {unknown} */ (ctx)), state: ctx, listeners };
}

/** @param {TestSpecification[]} sorted */
const paths = (sorted) => sorted.map((file) => file.moduleId.slice(root.length + 1));

/** A listener that does nothing, distinct from every other one. */
const listener = () => /** @type {CancelListener} */ (() => undefined);

describe('mirrorOf', () => {
    it.each([
        ['src/a.ts', 'tests/a.test.ts'],
        ['src/deep/a.js', 'tests/deep/a.test.js'],
        // Only the last dot is the extension.
        ['src/a.b.ts', 'tests/a.b.test.ts'],
    ])('mirrors %s with %s', (source, test) => {
        expect(mirrorOf(root, `${root}/${source}`)).toBe(test);
    });

    it('mirrors nothing outside src/', () => {
        expect(mirrorOf(root, `${root}/bin/a.js`)).toBeUndefined();
        expect(mirrorOf(root, `${root}/a/src/b.js`)).toBeUndefined();
    });
});

describe('MirrorFirstSequencer', () => {
    const files = ['tests/long.test.ts', 'tests/a.test.ts', 'tests/short.test.ts'];
    /** @type {Record<string, { duration: number, failed: boolean }>} */
    const results = {
        'tests/long.test.ts': { duration: 30, failed: false },
        'tests/a.test.ts': { duration: 20, failed: false },
        'tests/short.test.ts': { duration: 10, failed: false },
    };

    it.each([
        ['no scope', undefined],
        ['an empty one', []],
    ])('sorts a run with %s as Vitest sorts it', async (_, related) => {
        const options = related === undefined ? { results } : { related, results };
        const { ctx } = vitest(options);
        const specs = files.map(spec);

        expect(paths(await new MirrorFirstSequencer(ctx).sort(specs))).toEqual(
            paths(await new BaseSequencer(ctx).sort(specs)),
        );
        // And Vitest runs the longest first, which is the order a scoped run must not take.
        expect(paths(await new BaseSequencer(ctx).sort(specs))[0]).toBe('tests/long.test.ts');
    });

    it('runs the mirror of the scope first, then the shortest', async () => {
        const { ctx } = vitest({ related: [`${root}/src/a.ts`], results });

        expect(paths(await new MirrorFirstSequencer(ctx).sort(files.map(spec)))).toEqual([
            'tests/a.test.ts',
            'tests/short.test.ts',
            'tests/long.test.ts',
        ]);
    });

    it('runs what failed last time after the mirror and before the rest', async () => {
        const { ctx } = vitest({
            related: [`${root}/src/a.ts`],
            results: { ...results, 'tests/long.test.ts': { duration: 30, failed: true } },
        });

        expect(paths(await new MirrorFirstSequencer(ctx).sort(files.map(spec)))).toEqual([
            'tests/a.test.ts',
            'tests/long.test.ts',
            'tests/short.test.ts',
        ]);
    });

    it('runs a file it has no time for before the ones it has', async () => {
        const { ctx } = vitest({
            related: [`${root}/src/none.ts`],
            results: { 'tests/long.test.ts': { duration: 30, failed: false } },
        });

        expect(
            paths(
                await new MirrorFirstSequencer(ctx).sort(
                    ['tests/long.test.ts', 'tests/short.test.ts'].map(spec),
                ),
            ),
        ).toEqual(['tests/short.test.ts', 'tests/long.test.ts']);
    });

    it('keeps the longest a file has taken, which a run cut short does not lower', async () => {
        const { ctx, state } = vitest({ related: [`${root}/src/none.ts`], results });
        const sequencer = new MirrorFirstSequencer(ctx);

        await sequencer.sort(files.map(spec));
        // Cut short by bail after a second: still the longest.
        state.cache.getFileTestResults = (key) =>
            key.slice(1) === 'tests/long.test.ts'
                ? { duration: 1, failed: false }
                : results[key.slice(1)];

        expect(paths(await sequencer.sort(files.map(spec)))).toEqual([
            'tests/short.test.ts',
            'tests/a.test.ts',
            'tests/long.test.ts',
        ]);
    });

    describe('bail, heard on every run', () => {
        /**
         * One run as Vitest makes it: every listener cleared, the run's own registered before it
         * sorts, and whatever `after` holds registered once it has sorted — the browser pool
         * registers its own there, and only in the first run.
         *
         * @param {ReturnType<typeof vitest>} instance
         * @param {MirrorFirstSequencer} sequencer
         * @param {CancelListener[]} [after]
         * @returns {Promise<CancelListener>} the run's own listener
         */
        async function run({ ctx, listeners }, sequencer, after = []) {
            listeners.clear();
            const own = listener();
            ctx.onCancel(own);
            await sequencer.sort(files.map(spec));
            for (const registered of after) {
                ctx.onCancel(registered);
            }

            return own;
        }

        it('registers again, on every later run, what the first run registered after sorting', async () => {
            const instance = vitest({ related: [`${root}/src/a.ts`], results });
            const sequencer = new MirrorFirstSequencer(instance.ctx);
            const pool = listener();

            const first = await run(instance, sequencer, [pool]);

            expect([...instance.listeners], 'the first run').toEqual([first, pool]);

            const second = await run(instance, sequencer);

            expect([...instance.listeners], 'the second').toEqual([second, pool]);

            const third = await run(instance, sequencer);

            expect([...instance.listeners], 'the third').toEqual([third, pool]);
        });

        it("keeps no run's own, and nothing a later run registers", async () => {
            const instance = vitest({ related: [`${root}/src/a.ts`], results });
            const sequencer = new MirrorFirstSequencer(instance.ctx);
            const pool = listener();
            const late = listener();

            await run(instance, sequencer, [pool]);
            await run(instance, sequencer, [late]);
            const third = await run(instance, sequencer);

            expect([...instance.listeners]).toEqual([third, pool]);
        });

        it('keeps nothing registered before it was built', async () => {
            const instance = vitest({ related: [`${root}/src/a.ts`], results });
            instance.ctx.onCancel(listener());
            const sequencer = new MirrorFirstSequencer(instance.ctx);

            await run(instance, sequencer);
            const second = await run(instance, sequencer);

            expect([...instance.listeners]).toEqual([second]);
        });

        it('forgets what Vitest takes back, as a browser session does when it closes', async () => {
            const instance = vitest({ related: [`${root}/src/a.ts`], results });
            const sequencer = new MirrorFirstSequencer(instance.ctx);
            const pool = listener();
            const session = listener();

            await run(instance, sequencer, [pool]);
            instance.ctx.onCancel(session)();
            const second = await run(instance, sequencer);

            expect([...instance.listeners]).toEqual([second, pool]);
        });

        it('forgets it whenever it is taken back, after the first run too', async () => {
            const instance = vitest({ related: [`${root}/src/a.ts`], results });
            const sequencer = new MirrorFirstSequencer(instance.ctx);
            const pool = listener();

            await run(instance, sequencer, [pool]);
            const session = listener();
            const close = instance.ctx.onCancel(session);
            const second = await run(instance, sequencer);

            expect([...instance.listeners], 'still open').toEqual([second, pool, session]);

            close();
            const third = await run(instance, sequencer);

            expect([...instance.listeners], 'closed').toEqual([third, pool]);
        });

        it('still hands back what removes a listener', () => {
            const instance = vitest();
            new MirrorFirstSequencer(instance.ctx);
            const registered = listener();

            instance.ctx.onCancel(registered)();

            expect(instance.listeners.has(registered)).toBe(false);
        });
    });
});
