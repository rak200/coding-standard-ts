/**
 * Layer 2 (TypeScript) — code style. Consumed by a repository as:
 *
 *     // prettier.config.js
 *     export { default } from '@rak200/coding-standard-ts/prettier';
 *
 * A module, not the `.prettierrc.json` this started as, and the reason generalises:
 * **Prettier's JSON config has no `extends`.** A consumer that writes one gets its own
 * file and silently loses every decision here — the first repository to import this
 * standard formatted its entire source with Prettier's defaults, double quotes and all,
 * while `lint` reported everything clean.
 *
 * That is now four tools in a row: eslint, vitest, stryker and prettier all share only
 * through a module. TypeScript is the exception — `tsconfig.json`'s `extends` resolves a
 * package specifier natively — which is why tsconfig.base.json stays JSON.
 *
 * Indentation is deliberately absent: Prettier reads the repository's `.editorconfig`,
 * a Layer 1 seed shared with every other language, and one indent width across the
 * estate beats each language's local habit.
 */

export default {
    printWidth: 100,
    singleQuote: true,
    trailingComma: 'all',
    semi: true,
    arrowParens: 'always',
    endOfLine: 'lf',
};
