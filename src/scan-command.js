/**
 * Layer 2 (TypeScript) — the security scanner's command line.
 *
 * RFC 0017's *Code scanning* decides this command. It then lived in each repository's own
 * `package.json`, which is per-repo by construction — npm never inherits a dependency's
 * scripts — and nothing anywhere compared the copies to the decision. They drifted to the
 * same wrong shape as the PHP side, and the canary that would have caught it was never
 * fired. `--severity=ERROR` took the place of `--error`, which are unrelated flags with
 * confusable names:
 *
 *   --error            exit non-zero when there are findings. Without it semgrep reports
 *                      and exits 0, so `Scanner findings block the merge` compares a code
 *                      that cannot differ from zero.
 *   --severity=ERROR   filter which rules RUN. It narrows the rule set and drops nothing
 *                      that decides the exit code, because it never touches the exit code.
 *
 * The verb now binds here instead, which is the split the RFC already states — Layer 1
 * owns the vocabulary, Layer 2 owns what each word does — and the same shape the
 * `coverage` verb has used since it started calling {@link evaluate}. What changes is that
 * the decision is now asserted by a suite at a 100% mutation floor: a mutant that drops a
 * pack or a flag has a test to answer to, which a string in a manifest never did.
 *
 * This file holds the arguments and nothing else. `bin/rak200-scan.js` runs them and owns
 * the exit code, for the reason recorded on `src/coverage-floor.js`: a binary reachable
 * only through a child process is invisible to the instrumentation, and the estate's own
 * executables were the code it never measured.
 */

/**
 * The semgrep binary. Named rather than read off the head of {@link scanArguments}, so the
 * caller never indexes a list — `noUncheckedIndexedAccess` types `argv[0]` as possibly
 * undefined, and the guard written to satisfy it would be a branch no input can reach. The
 * PHP twin hit the same wall from the other side, as a `string|null` out of `array_shift`.
 */
export const BINARY = 'semgrep';

/**
 * The registry rule packs, in the order the RFC names them.
 *
 * Both, and not `p/javascript` alone: the product of this repository is TypeScript
 * configuration, its consumers are TypeScript, and a scanner that only knows the language
 * this package happens to be *written* in has the same shape as the defect RFC 0017
 * already recorded here — `js.yml` filtering changed files by `\.ts$` and therefore
 * mutating nothing in a repository written in JavaScript. Names decided what ran, twice.
 *
 * The asymmetry with the PHP side is deliberate rather than an oversight. There the second
 * pack is `p/security-audit`, added because `p/php` is tuned for precision and answered a
 * planted `eval($_POST[…])` with `0 findings`; PHP has no second scanner to fall back on,
 * so the audit pack is where the depth comes from. On JS/TS the depth comes from CodeQL at
 * `security-extended` — interprocedural taint across files, which semgrep OSS structurally
 * cannot do — and semgrep is the local, per-file half of the pair.
 */
export const PACKS = ['p/javascript', 'p/typescript'];

/** Where the SARIF report is written, for the publishing step to upload. */
export const REPORT = 'semgrep.sarif';

/**
 * The full argument list, executable as-is, the binary included.
 *
 * @returns {string[]}
 */
export function scanArguments() {
    return [
        BINARY,
        'scan',
        ...PACKS.map((pack) => `--config=${pack}`),

        // `--error` is the whole gate. Everything else here decides what is looked at and
        // where the report goes; this is the only flag that turns a finding into a
        // non-zero exit, and therefore the only one the enforcing step can observe.
        '--error',

        '--sarif',
        `--output=${REPORT}`,

        // Telemetry off: the scanner runs on every pull request in the estate, and a gate
        // that phones home is a gate with a dependency nobody chose.
        '--metrics=off',

        '.',
    ];
}
