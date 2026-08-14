#!/usr/bin/env node

/**
 * Layer 2 (TypeScript) — the security scanner, bound to the `scan` verb.
 *
 *     rak200-scan
 *
 * Runs semgrep with the command RFC 0017 decides, and exits with semgrep's own code so the
 * pipeline's enforcing step has something that can differ from zero. The arguments live in
 * ../src/scan-command.js so that they can be measured — see the note there, and the same
 * note on bin/coverage-floor.js.
 *
 * A twin of the PHP binary rather than a shared one, for the reason coverage-floor.js
 * already gives: a package that had to be installed by both ecosystems to spawn a process
 * would be worse than the lines it saved.
 *
 * No counterpart in tests/cli.test.js, and the omission is deliberate: this file's two
 * outcomes are "semgrep ran" and "semgrep is not on PATH", and a test can only pin one of
 * them by depending on the state of the machine — which is the opposite of what the other
 * CLI cases do. In CI semgrep is installed, so the absent-scanner branch cannot be
 * observed there; locally it usually is not, so the other branch cannot. The wiring is
 * spawn, print and exit, and everything it decides lives in src/ where it is measured.
 */

import { spawnSync } from 'node:child_process';

import { BINARY, scanArguments } from '../src/scan-command.js';

const argv = scanArguments();

// Reported before running, because the whole defect this binary exists to fix was a
// command nobody could see. The CI log now carries the exact invocation next to its
// result, so a future divergence is one line of reading rather than an investigation.
process.stdout.write(`scan: ${argv.join(' ')}\n`);

// `stdio: 'inherit'`, not a captured buffer: semgrep's own output IS the diagnosis, and
// swallowing it to re-print a summary is how a scanner becomes a number nobody can act on.
// No shell, so nothing here is parsed as one — the arguments reach the process as written.
const { status, error } = spawnSync(BINARY, argv.slice(1), { stdio: 'inherit' });

// Node reports a missing executable as an ENOENT error rather than as the 127 a shell
// would return, so the two twins detect the same condition through different channels and
// say the same thing. Saying it matters: a scanner that never ran is not a scanner that
// found nothing, and without this line the difference is an empty log.
if (/** @type {NodeJS.ErrnoException | undefined} */ (error)?.code === 'ENOENT') {
    process.stderr.write(
        `::error::${BINARY} is not installed — \`scan\` cannot run, and a scanner that is absent is not a scanner that found nothing\n`,
    );
    process.exit(127);
}

// `status` is null when the process died on a signal. Exiting 0 there would report a
// killed scanner as a clean one, which is the failure this whole file is against.
process.exit(status ?? 1);
