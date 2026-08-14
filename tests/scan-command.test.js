import { describe, expect, it } from 'vitest';

import { BINARY, PACKS, REPORT, scanArguments } from '../src/scan-command.js';

describe('scanArguments', () => {
    it('is the command the RFC decided', () => {
        // Asserted whole rather than piecemeal, and that is the point of this file. The
        // command drifted in four repositories because it lived as a string in four
        // manifests with nothing comparing them to the decision. Here a mutant that drops
        // a pack, reorders them, or rewrites a flag has this to answer to.
        expect(scanArguments()).toStrictEqual([
            'semgrep',
            'scan',
            '--config=p/javascript',
            '--config=p/typescript',
            '--error',
            '--sarif',
            '--output=semgrep.sarif',
            '--metrics=off',
            '.',
        ]);
    });

    it('names TypeScript, because this standard is for TypeScript', () => {
        // Named on its own, because losing this pack is the shape of a defect this
        // repository has already produced once: `js.yml` filtered changed files by `\.ts$`
        // and mutated nothing here, since the package that configures TypeScript is itself
        // written in JavaScript. A scanner told only about the language a package happens
        // to be written in repeats that mistake from the other end.
        expect(PACKS).toContain('p/typescript');
        expect(scanArguments()).toContain('--config=p/typescript');
    });

    it('asks for a non-zero exit and not for a severity filter', () => {
        // The two flags that were swapped for each other. `--error` is what turns a
        // finding into an exit code; `--severity` only decides which rules run, so
        // substituting it left the enforcing step comparing a value that could not differ
        // from zero. A gate that cannot fail is the failure this estate keeps finding, and
        // this assertion is the one that would have caught it.
        const argv = scanArguments();

        expect(argv).toContain('--error');

        for (const argument of argv) {
            expect(argument.startsWith('--severity')).toBe(false);
        }
    });

    it('writes the report where the publishing step looks for it', () => {
        // The pipeline's middle step uploads by this exact name, under a `hashFiles()`
        // guard — so a renamed report does not fail, it silently uploads nothing.
        expect(REPORT).toBe('semgrep.sarif');
        expect(scanArguments()).toContain('--output=semgrep.sarif');
    });

    it('leads with the binary the runner spawns', () => {
        // `bin/rak200-scan.js` spawns BINARY and passes the tail. If the head of this list
        // were ever something else, the binary would run one command and print another —
        // and printing the invocation is the only reason a future divergence is readable.
        expect(scanArguments().at(0)).toBe(BINARY);
    });
});
