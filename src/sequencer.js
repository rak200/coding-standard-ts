/**
 * Layer 2 (TypeScript) — the order a scoped run takes, and the `bail` that stops it.
 *
 * **A scoped run is what a mutant gets.** `@stryker-mutator/vitest-runner` runs each mutant as
 * Vitest's `related` for the mutated file, with `bail: 1`. A mutant the dry run could not tie to
 * a test runs every related file, and that is every module-level mutant: in a component library,
 * most of them — the styles, the tokens, a theme's data. Through a barrel the related files are
 * nearly the whole suite, so what a mutant costs is the time until the first file that kills it,
 * and Vitest's own order runs the longest files first. The tree mirrors `src/`, so the file most
 * likely to kill a mutant is known without configuring anything.
 *
 * **`bail` stops a browser run once per process, and only once.** `runFiles()` clears every
 * cancel listener at the start of a run, and the browser pool registers its own once, when it is
 * created. From the second run on, a failure asks for a cancellation nobody hears, and the pool
 * runs every file it was given. Measured on Vitest 4.1.11, which is the last 4.
 *
 * Measured on rak200/ui, over the same 34 mutants and two workers:
 *
 * | order | wall time | tests a mutant |
 * | --- | --- | --- |
 * | Vitest's own | 19 min 52 s | 1,000 |
 * | the mirror first, `bail` unheard | 21 min 22 s | 967 |
 * | the mirror first, `bail` heard | 5 min 58 s | 80 |
 *
 * Every mutant got the same verdict in all three runs. `bail` cuts a run short only after a
 * failure, so an order can change which test kills a mutant, never whether one does.
 *
 * An unscoped run, `vitest run` as every verb but `mutation` runs it, is sorted the way Vitest
 * sorts it.
 */

import { extname, relative, sep } from 'node:path';

import { BaseSequencer } from 'vitest/node';

/** @typedef {import('vitest/node').TestSpecification} TestSpecification */
/** @typedef {import('vitest/node').Vitest} Vitest */
/** @typedef {Parameters<Vitest['onCancel']>[0]} CancelListener */

/** @param {string} path a path in the platform's separators, as `relative()` gives one */
function slashed(path) {
    return path.split(sep).join('/');
}

/**
 * The test file that mirrors a source file, relative to `root`: `src/a/b.ts` is
 * `tests/a/b.test.ts`, as Layer 1's mirrored trees have it.
 *
 * @param {string} root the run's root
 * @param {string} file an absolute path
 * @returns {string | undefined} undefined for a file outside `src/`, which no test mirrors
 */
export function mirrorOf(root, file) {
    const path = slashed(relative(root, file));
    if (!path.startsWith('src/')) {
        return undefined;
    }

    const extension = extname(path);

    return `tests/${path.slice('src/'.length, path.length - extension.length)}.test${extension}`;
}

/**
 * Sorts a run scoped to some source files: the files that mirror them first, then the files that
 * failed the last time they ran, then the shortest. Hears `bail` on every run.
 */
export class MirrorFirstSequencer extends BaseSequencer {
    /** The longest each file has taken in this process, which a run cut short does not lower. */
    #longest = /** @type {Map<string, number>} */ (new Map());

    /** The cancel listeners registered since the last sort, or since this was built. */
    #since = /** @type {CancelListener[]} */ ([]);

    /** How many a run registers before it sorts, which every run registers again. */
    #before = 0;

    /** What the first run registered after it sorted — the browser pool's own among them. */
    #heard = /** @type {CancelListener[]} */ ([]);

    #sorts = 0;

    /**
     * Built before the pool is, which is what lets it see what the pool registers.
     *
     * @param {Vitest} ctx the instance whose runs it sorts
     */
    constructor(ctx) {
        super(ctx);

        const onCancel = ctx.onCancel.bind(ctx);
        ctx.onCancel = (listener) => {
            this.#since.push(listener);

            return onCancel(listener);
        };
    }

    /**
     * Registers again what the first run heard, then sorts — the files that mirror the run's
     * scope first, then the files that failed, then the shortest. A run with no scope is sorted
     * as Vitest sorts it.
     *
     * A run starts by clearing every listener and registers its own before it sorts, so what
     * the first run registered after sorting is what the second finds missing: the listeners
     * since the first sort, less as many as a run registers before sorting, which by then are
     * the second run's own.
     *
     * @override
     * @param {TestSpecification[]} files the files the run was given
     * @returns {Promise<TestSpecification[]>} the same files, in the order to run them
     */
    async sort(files) {
        this.#sorts += 1;
        if (this.#sorts === 1) {
            this.#before = this.#since.length;
        } else if (this.#sorts === 2) {
            this.#heard = this.#since.slice(0, this.#since.length - this.#before);
        }

        this.#since = [];

        for (const listener of this.#heard) {
            this.ctx.onCancel(listener);
        }

        const { root, related } = this.ctx.config;
        if (related === undefined || related.length === 0) {
            // Not `super.sort()`: Stryker cannot place a mutant on a call through `super`, and
            // refuses the whole file — measured, as `could not place mutants with type(s):
            // "MethodExpression"`.
            return BaseSequencer.prototype.sort.call(this, files);
        }

        const cache = this.ctx.cache;
        /** @param {TestSpecification} spec */
        const key = (spec) => `${spec.project.name}:${relative(root, spec.moduleId)}`;

        for (const spec of files) {
            const duration = cache.getFileTestResults(key(spec))?.duration;
            if (duration !== undefined) {
                this.#longest.set(key(spec), Math.max(this.#longest.get(key(spec)) ?? 0, duration));
            }
        }

        const mirrors = new Set(related.map((file) => mirrorOf(root, file)));
        /** @param {TestSpecification} spec */
        const rank = (spec) => {
            if (mirrors.has(slashed(relative(root, spec.moduleId)))) {
                return 0;
            }

            return cache.getFileTestResults(key(spec))?.failed === true ? 1 : 2;
        };
        /** @param {TestSpecification} spec */
        const cost = (spec) => this.#longest.get(key(spec)) ?? 0;

        return [...files].sort((a, b) => rank(a) - rank(b) || cost(a) - cost(b));
    }
}
