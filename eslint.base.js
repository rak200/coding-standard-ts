// Layer 2 (TypeScript) — static analysis. Consumed by a repository as:
//
//     import base from '@rak200/coding-standard-ts/eslint';
//     export default [...base, { ignores: ['dist/**'] }];
//
// What to look at is the consumer's business, so nothing here narrows it. Two blocks
// do name paths, and both resolve against the consumer's own eslint.config.js rather
// than this package — flat config reads every `files` pattern from the directory of
// the config ESLint loaded, unlike the PHP standard's two configs, whose paths
// resolved against the installed package and made them unusable in the repository
// that first imported them. One names the config files below; the other names `src/`,
// where the code that travels lives, for the documentation rule.
//
// The preset is `strictTypeChecked` + `stylisticTypeChecked` — the strictest
// consolidated pair typescript-eslint publishes, and the reason ESLint is here at all
// rather than a faster syntactic linter. PHPStan at `level: max` is a type-aware
// analyser; matching that bar in TypeScript means rules that read the type checker,
// which Biome and oxlint do not have.

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

import docSummary from './src/doc-summary.js';

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            // Type-aware rules need a program. `projectService` builds it from the
            // consumer's own tsconfig without this file naming one.
            parserOptions: { projectService: true },
        },
    },
    // Config files are JavaScript, they are not the product, and type-aware linting of
    // them buys nothing. The first repository to import this config hit the other end
    // of that: `projectService` could not find eslint.config.js or vitest.config.js in
    // the consumer's program — they are not under `include` — and `allowDefaultProject`
    // did not help, because its globs resolve against a `tsconfigRootDir` that a config
    // living in node_modules cannot know. Excluding them is both simpler and correct.
    {
        files: ['*.js', '*.mjs', '*.cjs', '**/*.config.js'],
        extends: [tseslint.configs.disableTypeChecked],
    },
    // Every exported symbol, and every public member of one, carries a TSDoc summary: the
    // documentation a package carries inside itself, kept in the `.d.ts` the compiler emits
    // and shown by a consumer's editor over a call. Under `src/`, and not in a test written
    // beside the code. The plugin is registered for every file, so a repository whose code
    // lives elsewhere turns `rak200/doc-summary` on for that directory in a block of its own.
    { plugins: { rak200: { rules: { 'doc-summary': docSummary } } } },
    {
        files: ['src/**'],
        ignores: ['src/**/*.test.*', 'src/**/*.spec.*'],
        rules: { 'rak200/doc-summary': 'error' },
    },
    // Last, always: turns off every rule that would argue with the formatter. Two tools
    // disagreeing about the same line is a fight nobody wins.
    prettier,
);
