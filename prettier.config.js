// This package's own formatting, consuming the base config it publishes. A pass-through
// today, and deliberately still a file: the four other tools each needed a repo-side
// config, and a lone `prettier.config.js` that was secretly the shipped one is the exact
// ambiguity this split removes.

export { default } from './prettier.base.js';
