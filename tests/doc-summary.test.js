import { ESLint, RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

import base from '../eslint.base.js';
import rule from '../src/doc-summary.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

/**
 * The report a name gets.
 *
 * @param {string} name
 * @param {number} line
 */
const missing = (name, line) => ({ message: `${name} has no TSDoc summary.`, line });

describe('the configuration a consumer imports', () => {
    it('turns the rule on under src/, and nowhere else', async () => {
        // A rule that is tested and never turned on is enforced by nothing; one turned on over
        // the wrong files is enforced over nothing, and stays green either way.
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: base });

        /** @param {string} file */
        const severity = async (file) => {
            /** @type {unknown} */
            const config = await eslint.calculateConfigForFile(file);

            return /** @type {{ rules: Record<string, unknown> }} */ (config).rules[
                '@rak200/coding-standard-ts/doc-summary'
            ];
        };

        expect(await severity('src/feature.ts')).toStrictEqual([2]);
        expect(await severity('src/nested/feature.js')).toStrictEqual([2]);
        expect(await severity('src/feature.test.ts')).toBeUndefined();
        expect(await severity('src/feature.spec.ts')).toBeUndefined();
        expect(await severity('tests/feature.test.ts')).toBeUndefined();
    });
});

new RuleTester().run('doc-summary, JavaScript', /** @type {never} */ (rule), {
    valid: [
        '/** Does one thing. */\nexport function run() {}',
        '/** Two values. */\nexport const a = 1, b = 2;',
        '/** {@inheritDoc Base} */\nexport class Alias {}',
        '/**\n * Spans\n * two lines.\n *\n * @returns {void}\n */\nexport function run() {}',
        '/** Does one thing. */\n// a line comment between them\nexport function run() {}',
        "export { a } from './a.js';\nexport * from './b.js';",
        'const a = 1;\nexport default a;',
        'function local() {}\nclass Local { run() {} }',
        [
            '/** Documented. */',
            'export class Host {',
            '    /** The count. */',
            '    count = 0;',
            '    #hidden = 1;',
            '    static {}',
            '    /** Builds one. */',
            '    constructor() {}',
            '    /** Runs it. */',
            '    run() {}',
            '    #secret() {}',
            '    /** The size. */',
            '    get size() { return 0; }',
            '}',
        ].join('\n'),
    ],
    invalid: [
        { code: 'export function run() {}', errors: [missing('run', 1)] },
        { code: '/** @returns {void} */\nexport function run() {}', errors: [missing('run', 2)] },
        { code: '/** */\nexport const a = 1;', errors: [missing('a', 2)] },
        { code: '/** * */\nexport const a = 1;', errors: [missing('a', 2)] },
        { code: '/* Not a doc comment. */\nexport const a = 1;', errors: [missing('a', 2)] },
        { code: '// Not a doc comment.\nexport const a = 1;', errors: [missing('a', 2)] },
        {
            code: '//* A line comment, though it opens like a doc comment.\nexport const a = 1;',
            errors: [missing('a', 2)],
        },
        { code: 'export const a = 1, b = 2;', errors: [missing('a, b', 1)] },
        {
            code: 'export const { a, b } = { a: 1, b: 2 };',
            errors: [missing('{ a, b }', 1)],
        },
        { code: 'export default function () {}', errors: [missing('default', 1)] },
        { code: 'export default { a: 1 };', errors: [missing('default', 1)] },
        {
            code: 'export default (class { run() {} });',
            errors: [missing('default', 1), missing('default.run()', 1)],
        },
        {
            code: [
                '/** Documented. */',
                'export class Host {',
                '    count = 0;',
                '    constructor() {}',
                '    run() {}',
                '    get size() { return 0; }',
                '    static make() {}',
                "    'quoted-name'() {}",
                '    [Symbol.iterator]() {}',
                '}',
            ].join('\n'),
            errors: [
                missing('Host.count', 3),
                missing('Host.constructor()', 4),
                missing('Host.run()', 5),
                missing('Host.size', 6),
                missing('Host.make()', 7),
                missing("Host.'quoted-name'()", 8),
                missing('Host.Symbol.iterator()', 9),
            ],
        },
    ],
});

new RuleTester({ languageOptions: { parser: tseslint.parser } }).run(
    'doc-summary, TypeScript',
    /** @type {never} */ (rule),
    {
        valid: [
            [
                '/** A box. */',
                'export interface Box {',
                '    /** Its top. */',
                '    top: number;',
                '    /** Measures it. */',
                '    measure(): number;',
                '    (scale: number): void;',
                '    [key: string]: unknown;',
                '}',
            ].join('\n'),
            '/** A shape. */\nexport type Shape = { /** Its width. */ width: number };',
            '/** A name. */\nexport type Alias = string;',
            '/** A state. */\nexport enum Status { /** Running. */ On, /** Stopped. */ Off }',
            [
                '/** Documented. */',
                'export class Host {',
                '    private secret = 1;',
                '    protected hook(): void {}',
                '    /** Builds it. */',
                '    constructor(private readonly a: number, protected b: string, c: number) {}',
                '}',
            ].join('\n'),
            [
                '/** Documented. */',
                'export class Child extends Base {',
                '    /** {@inheritDoc} */',
                "    override render(): string { return ''; }",
                '}',
            ].join('\n'),
            '/** Documented. */\n@sealed\nexport class Sealed {}',
            '/** Documented. */\nexport @sealed class Sealed {}',
            [
                '/** Documented. */',
                'export class Host {',
                '    /** The label. */',
                "    @property() label = '';",
                '}',
            ].join('\n'),
        ],
        invalid: [
            {
                code: 'export interface Box {\n    top: number;\n    measure(): number;\n}',
                errors: [missing('Box', 1), missing('Box.top', 2), missing('Box.measure()', 3)],
            },
            {
                code: 'export type Shape = { width: number };',
                errors: [missing('Shape', 1), missing('Shape.width', 1)],
            },
            {
                code: 'export enum Status { On }',
                errors: [missing('Status', 1), missing('Status.On', 1)],
            },
            {
                code: [
                    '/** Documented. */',
                    'export class Host {',
                    '    /** Builds it. */',
                    '    constructor(public readonly a: number, readonly b = 1) {}',
                    '}',
                ].join('\n'),
                errors: [missing('Host.a', 4), missing('Host.b', 4)],
            },
            {
                code: [
                    '/** Documented. */',
                    'export class Host {',
                    '    private constructor(public a: number) {}',
                    '}',
                ].join('\n'),
                errors: [missing('Host.a', 3)],
            },
            {
                code: [
                    '/** Documented. */',
                    'export abstract class Child extends Base {',
                    "    override render(): string { return ''; }",
                    '    abstract run(): void;',
                    '    accessor value = 1;',
                    '    value2: string | null = null;',
                    '}',
                ].join('\n'),
                errors: [
                    missing('Child.render()', 3),
                    missing('Child.run()', 4),
                    missing('Child.value', 5),
                    missing('Child.value2', 6),
                ],
            },
            { code: '@sealed\nexport class Sealed {}', errors: [missing('Sealed', 2)] },
        ],
    },
);
