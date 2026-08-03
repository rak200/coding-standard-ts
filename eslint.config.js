// This package's own lint run, consuming the base config it publishes — which is the
// point of the split. Until this repository grew a suite, the shipped `eslint.config.js`
// *was* the config ESLint auto-loaded here, so the product and the repository's own
// settings were one file and could not disagree even when they should. Stryker had the
// same collision, with worse consequences: it read consumer globs, matched nothing, and
// reported a clean run over zero mutants.
//
// The five shipped configs are now `*.base.*` and the five here are the ordinary
// consumer-side ones. The package eats exactly what it serves.

import globals from 'globals';

import base from './eslint.base.js';

export default [
    ...base,
    {
        // Node, not a browser: this package's product is a CLI and a set of config
        // modules. The base config sets no globals deliberately — a browser package
        // must not inherit `process` from the standard that configures it.
        languageOptions: { globals: globals.node },
    },
    { ignores: ['coverage/**', '.stryker-tmp/**', 'reports/**'] },
];
