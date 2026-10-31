'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const readline = require('readline');

const CERTS_DIR = path.join(__dirname, '..', '.certs');
const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const KEY_SIZE_BITS = 2048;
const CERT_VALIDITY_DAYS = 365;

function assertOpensslAvailable() {
  try {
    execFileSync('openssl', ['version'], { stdio: 'pipe' });
  } catch {
    throw new Error(
      'openssl was not found on your PATH. This script shells out to the ' +
        'system openssl binary to generate a self-signed certificate - ' +
        'install it (e.g. `brew install openssl` on macOS) and try again.'
    );
  }
}

// Reads answers via the readline interface's async iterator rather than
// repeated rl.question() calls - question() races a fresh one-time 'line'
// listener against the stream, which can silently drop an answer when
// piped (non-TTY) input delivers multiple lines in one burst. Iterating
// pulls from an internal queue instead, so no answer is ever lost
// regardless of how the input is delivered.
function createPrompter(rl, lines) {
  return async function ask(promptText) {
    process.stdout.write(promptText);
    const { value, done } = await lines.next();
    if (done) {
      throw new Error('Input ended before an answer was given.');
    }
    return value.trim();
  };
}

async function promptIntegrationName(ask) {
  for (;;) {
    const answer = await ask(
      'Which integration record is this for? ' +
        '(e.g. your-integration-name, used to name the key files): '
    );

    if (NAME_PATTERN.test(answer)) {
      return answer;
    }

    console.log(
      'Please use only letters, numbers, "-", and "_" (max 64 chars), ' +
        'starting with a letter or number.'
    );
  }
}

async function confirmOverwrite(ask, existingPaths) {
  console.log('These file(s) already exist and would be overwritten:');
  existingPaths.forEach((p) => console.log(`  ${p}`));
  const answer = (await ask('Overwrite them? [y/N]: ')).toLowerCase();
  return answer === 'y' || answer === 'yes';
}

async function main() {
  assertOpensslAvailable();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = createPrompter(rl, rl[Symbol.asyncIterator]());

  try {
    const name = await promptIntegrationName(ask);

    const keyPath = path.join(CERTS_DIR, `${name}.private-key.pem`);
    const certPath = path.join(CERTS_DIR, `${name}.certificate.pem`);

    const existing = [keyPath, certPath].filter((p) => fs.existsSync(p));
    if (existing.length > 0) {
      const proceed = await confirmOverwrite(ask, existing);
      if (!proceed) {
        console.log('Aborted - no files were changed.');
        return;
      }
    }

    fs.mkdirSync(CERTS_DIR, { recursive: true });

    console.log(`\nGenerating a ${KEY_SIZE_BITS}-bit RSA private key...`);
    execFileSync('openssl', ['genrsa', '-out', keyPath, String(KEY_SIZE_BITS)], {
      stdio: 'pipe',
    });
    fs.chmodSync(keyPath, 0o600);

    console.log(
      `Generating a self-signed certificate (valid ${CERT_VALIDITY_DAYS} days)...`
    );
    execFileSync(
      'openssl',
      [
        'req',
        '-new',
        '-x509',
        '-key',
        keyPath,
        '-out',
        certPath,
        '-days',
        String(CERT_VALIDITY_DAYS),
        '-subj',
        `/CN=${name}`,
      ],
      { stdio: 'pipe' }
    );

    console.log('\nDone. Both files are already covered by .gitignore (.certs/).\n');
    console.log(`Private key (keep secret):  ${keyPath}`);
    console.log(`Public certificate:         ${certPath}`);
    console.log('\nNext steps (see docs/NETSUITE_SETUP.md):');
    console.log(
      '  1. Upload the public certificate above as the "Certificate" on the ' +
        'OAuth 2.0 Client Credentials (M2M) Setup record (step 4).'
    );
    console.log(
      `  2. Set NETSUITE_PRIVATE_KEY_PATH=${keyPath} in your .env (step 6).`
    );
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exitCode = 1;
});
