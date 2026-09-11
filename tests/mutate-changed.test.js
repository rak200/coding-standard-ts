import { describe, expect, it } from 'vitest';

import {
    baseRef,
    concrete,
    expand,
    forward,
    patterns,
    rangesFor,
    strykerBin,
} from '../src/mutate-changed.js';

/** A unified-diff body with the hunk headers that matter, and nothing else. */
/** @param {string[]} headers */
const hunks = (...headers) => headers.map((h) => `${h} @@`).join('\n');
const never = () => null;
const empty = () => '';

describe('patterns', () => {
    it('splits a comma-separated --mutate value and trims each entry', () => {
        expect(patterns('a.ts, b.ts ,c.ts')).toStrictEqual(['a.ts', 'b.ts', 'c.ts']);
    });

    it('drops empty entries, so a trailing comma cannot become an empty pattern', () => {
        // An empty pattern would survive into `--mutate` and Stryker reads that as the whole
        // library — the exact fallback this module exists to prevent.
        expect(patterns('a.ts,,')).toStrictEqual(['a.ts']);
    });
});

describe('concrete', () => {
    it('accepts a plain path', () => {
        expect(concrete('src/a.ts')).toBe(true);
    });

    it.each([
        ['a glob', 'src/**/*.ts'],
        ['a single-character glob', 'src/a?.ts'],
        ['a negation', '!src/a.ts'],
        ['a range somebody already wrote', 'src/a.ts:1-2'],
    ])('refuses %s, which cannot be expanded and is forwarded as written', (_, pattern) => {
        expect(concrete(pattern)).toBe(false);
    });
});

describe('baseRef', () => {
    it('spells the ref the way the pipeline fetched it', () => {
        expect(baseRef({ GITHUB_BASE_REF: 'master' })).toBe('origin/master');
    });

    it.each([
        ['the variable is absent', {}],
        ['the variable is empty', { GITHUB_BASE_REF: '' }],
    ])('is empty when %s, so a local run expands nothing', (_, env) => {
        // This is the switch between the two halves of the Layer 1 rule: changed lines on a
        // pull request, the whole config off that path.
        expect(baseRef(env)).toBe('');
    });
});

describe('rangesFor', () => {
    it('takes the + side of each hunk, one range per hunk', () => {
        expect(rangesFor('a.ts', hunks('@@ -1,2 +10,3', '@@ -40 +55,1'))).toStrictEqual([
            'a.ts:10-12',
            'a.ts:55-55',
        ]);
    });

    it('reads an absent count as one line, which is the header shorthand', () => {
        expect(rangesFor('a.ts', hunks('@@ -1 +7'))).toStrictEqual(['a.ts:7-7']);
    });

    it('contributes nothing for a hunk that adds no line', () => {
        // A pure deletion is `+c,0`. Emitting it would produce `a.ts:7-6`, a range Stryker
        // cannot read, from a change with nothing in it to mutate.
        expect(rangesFor('a.ts', hunks('@@ -7,3 +7,0'))).toStrictEqual([]);
    });

    it('ignores a @@ that is not at the start of a line', () => {
        // Without the anchor, a diff whose CONTENT quotes a hunk header — this file's own
        // tests, for one — would contribute ranges from a line nobody changed.
        expect(rangesFor('a.ts', '+const sample = "@@ -1 +9,2 @@";')).toStrictEqual([]);
    });

    it('reads multi-digit counts on both sides of the header', () => {
        // `\\d` instead of `\\d+` truncates: `-10,25 +30,12` would read as `+3` and emit a
        // range starting on the wrong line.
        expect(rangesFor('a.ts', hunks('@@ -10,25 +30,12'))).toStrictEqual(['a.ts:30-41']);
    });

    it('is empty for a diff with no hunk header at all', () => {
        expect(rangesFor('a.ts', 'diff --git a/a.ts b/a.ts\nsimilarity index 100%')).toStrictEqual(
            [],
        );
    });
});

describe('expand', () => {
    it('returns the patterns untouched when there is no base ref', () => {
        expect(expand(['src/a.ts'], '', never)).toStrictEqual(['src/a.ts']);
    });

    it('keeps the whole file when git refuses to answer', () => {
        // A base ref that was never fetched is the case this protects: narrowing on a diff
        // nobody could read would quietly mutate less than the convention asks for.
        expect(expand(['src/a.ts'], 'origin/master', never)).toStrictEqual(['src/a.ts']);
    });

    it('forwards a glob untouched and expands the concrete path beside it', () => {
        const read = (file) => (file === 'src/a.ts' ? hunks('@@ -1 +3,2') : null);
        expect(expand(['src/**/*.ts', 'src/a.ts'], 'origin/master', read)).toStrictEqual([
            'src/**/*.ts',
            'src/a.ts:3-4',
        ]);
    });

    it('does not expand without a base ref, even when a diff could be read', () => {
        // The guard is what makes a local run and the workflow_dispatch full run mutate what
        // the config says. Without it they would narrow to whatever HEAD happens to differ by.
        expect(expand(['src/a.ts'], '', () => hunks('@@ -1 +9,2'))).toStrictEqual(['src/a.ts']);
    });

    it('never reads a diff for a glob', () => {
        /** @type {string[]} */
        const seen = [];
        const read = (/** @type {string} */ file) => {
            seen.push(file);
            return hunks('@@ -1 +9,2');
        };
        expect(expand(['src/**/*.ts'], 'origin/master', read)).toStrictEqual(['src/**/*.ts']);
        expect(seen).toStrictEqual([]);
    });

    it('drops a file whose diff has no added line', () => {
        expect(expand(['src/a.ts'], 'origin/master', empty)).toStrictEqual([]);
    });
});

describe('forward', () => {
    const read = () => hunks('@@ -1 +9,2');

    it.each([
        ['--mutate x', ['--mutate', 'src/a.ts'], ['--mutate', 'src/a.ts:9-10']],
        ['-m x', ['-m', 'src/a.ts'], ['-m', 'src/a.ts:9-10']],
        ['--mutate=x', ['--mutate=src/a.ts'], ['--mutate=src/a.ts:9-10']],
    ])('rewrites the %s spelling', (_, given, expected) => {
        // All three, because a consumer passing the one this missed would silently get the
        // unnarrowed run — which looks like a slow gate, not like a broken one.
        expect(forward(given, 'origin/master', read).args).toStrictEqual(expected);
    });

    it('leaves every other argument in place and in order', () => {
        expect(
            forward(
                ['--concurrency', '3', '--mutate', 'src/a.ts', '--dry-run'],
                'origin/master',
                read,
            ).args,
        ).toStrictEqual(['--concurrency', '3', '--mutate', 'src/a.ts:9-10', '--dry-run']);
    });

    it('forwards a trailing --mutate with no value as an ordinary argument', () => {
        expect(forward(['--mutate'], 'origin/master', read).args).toStrictEqual(['--mutate']);
    });

    it('announces nothing off the pull-request path', () => {
        const { args, announced } = forward(['--mutate', 'src/a.ts'], '', never);
        expect(args).toStrictEqual(['--mutate', 'src/a.ts']);
        expect(announced).toBe('');
    });

    it('announces the ranges it narrowed to', () => {
        expect(forward(['--mutate', 'src/a.ts'], 'origin/master', read).announced).toBe(
            'src/a.ts:9-10',
        );
    });

    it('joins multiple ranges with commas, in both spellings', () => {
        // One range per hunk, and the separator matters: `--mutate a:1-2b:5-6` is one
        // unreadable pattern, so Stryker would fall back to the config's whole library.
        const two = () => hunks('@@ -1 +9,2', '@@ -50 +80,1');
        expect(forward(['--mutate', 'src/a.ts'], 'origin/master', two).args).toStrictEqual([
            '--mutate',
            'src/a.ts:9-10,src/a.ts:80-80',
        ]);
        expect(forward(['--mutate=src/a.ts'], 'origin/master', two).args).toStrictEqual([
            '--mutate=src/a.ts:9-10,src/a.ts:80-80',
        ]);
        expect(forward(['--mutate', 'src/a.ts'], 'origin/master', two).announced).toBe(
            'src/a.ts:9-10,src/a.ts:80-80',
        );
    });

    it('does not swallow the argument after the joined spelling', () => {
        // `--mutate=x` carries its value; skipping the next argument as well would drop a
        // flag silently — and a dropped `--concurrency` is a slower gate nobody can explain.
        expect(
            forward(['--mutate=src/a.ts', '--dry-run'], 'origin/master', read).args,
        ).toStrictEqual(['--mutate=src/a.ts:9-10', '--dry-run']);
    });

    it('keeps every pattern when no drop is given', () => {
        expect(forward(['--mutate', 'src/icons/a.ts'], '', never).args).toStrictEqual([
            '--mutate',
            'src/icons/a.ts',
        ]);
    });

    it('reports no reason and no ranges when there is nothing to narrow', () => {
        const { args, emptied, announced } = forward(['--dry-run'], '', never);
        expect(args).toStrictEqual(['--dry-run']);
        expect(emptied).toBe('');
        expect(announced).toBe('');
    });

    it('empties rather than forwarding an empty --mutate when no line was added', () => {
        const { args, emptied } = forward(['--mutate', 'src/a.ts'], 'origin/master', empty);
        // Forwarding `--mutate` with nothing in it falls back to the config's whole library:
        // a pull request that touched almost nothing would mutate everything, silently.
        expect(args).toStrictEqual([]);
        expect(emptied).toBe('the diff adds no line to any mutable file');
    });

    it('empties when every pattern is dropped by prefix', () => {
        const { args, emptied } = forward(
            ['--mutate', 'src/icons/a.ts'],
            'origin/master',
            read,
            (pattern) => pattern.startsWith('src/icons/'),
        );
        expect(args).toStrictEqual([]);
        expect(emptied).toBe('every changed file is dropped by --drop-prefix');
    });

    it('keeps the patterns the prefix does not drop', () => {
        expect(
            forward(['--mutate', 'src/icons/a.ts,src/b.ts'], 'origin/master', read, (pattern) =>
                pattern.startsWith('src/icons/'),
            ).args,
        ).toStrictEqual(['--mutate', 'src/b.ts:9-10']);
    });
});

describe('strykerBin', () => {
    it('reads the declared bin path', () => {
        expect(strykerBin('{"bin":{"stryker":"./bin/stryker.js"}}', 'p.json')).toBe(
            './bin/stryker.js',
        );
    });

    it.each([
        ['the manifest is not an object', 'null'],
        ['there is no bin field', '{}'],
        ['bin is not an object', '{"bin":"x"}'],
        ['bin is null', '{"bin":null}'],
        ['the manifest is an array', '[]'],
        ['the manifest is a string', '"x"'],
        ['the manifest is a number', '42'],
        ['bin declares no stryker', '{"bin":{}}'],
        ['bin.stryker is not a string', '{"bin":{"stryker":1}}'],
    ])('refuses when %s', (_, text) => {
        // Hardcoding ./bin/stryker.js was the alternative, and it breaks on an upgrade with
        // no diagnosis. This says which file disappointed it.
        expect(() => strykerBin(text, 'p.json')).toThrow(/p\.json declares no bin\.stryker/);
    });
});
