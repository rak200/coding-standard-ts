// Layer 2 (TypeScript) — static analysis. Consumed by a repository as:
//
//     import base from '@rak200/coding-standard-ts/eslint';
//     export default [...base, { ignores: ['dist/**'] }];
//
// No `files` or `ignores` are set here, deliberately: what to look at is the
// consumer's business, and a path baked into a shared config resolves against the
// installed package rather than the consumer — the mistake that made the PHP
// standard's two configs unusable in the repository that first imported them.
//
// The preset is `strictTypeChecked` + `stylisticTypeChecked` — the strictest
// consolidated pair typescript-eslint publishes, and the reason ESLint is here at all
// rather than a faster syntactic linter. PHPStan at `level: max` is a type-aware
// analyser; matching that bar in TypeScript means rules that read the type checker,
// which Biome and oxlint do not have.

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

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
    // Last, always: turns off every rule that would argue with the formatter. Two tools
    // disagreeing about the same line is a fight nobody wins.
    prettier,
);
