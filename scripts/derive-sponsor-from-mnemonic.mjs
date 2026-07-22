#!/usr/bin/env node
/**
 * Derive a Stacks sponsor private key from a BIP39 mnemonic (Clarinet default path).
 * Usage: node scripts/derive-sponsor-from-mnemonic.mjs [--path "m/44'/5757'/0'/0/0"]
 * Mnemonic is read from stdin (not argv) so it does not land in shell history.
 */
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { mnemonicToSeed, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { compressPrivateKey, getAddressFromPrivateKey } from '@stacks/transactions';
import { bytesToHex } from '@stacks/common';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const KEYFILE = resolve(ROOT, 'packages/relay/sponsor.key');
const DEFAULT_PATH = "m/44'/5757'/0'/0/0";
const NETWORK = process.env.STACKS_NETWORK ?? 'testnet';

const pathArg = process.argv.includes('--path')
  ? process.argv[process.argv.indexOf('--path') + 1]
  : DEFAULT_PATH;

const rl = createInterface({ input, output });
const mnemonic = (await rl.question('Paste 24-word mnemonic: ')).trim();
rl.close();

if (!validateMnemonic(mnemonic, wordlist)) {
  console.error('Invalid BIP39 mnemonic');
  process.exit(1);
}

const seed = await mnemonicToSeed(mnemonic);
const child = HDKey.fromMasterSeed(seed).derive(pathArg);
if (!child.privateKey) {
  console.error(`Could not derive key at ${pathArg}`);
  process.exit(1);
}

const privateKey = compressPrivateKey(bytesToHex(child.privateKey));
const address = getAddressFromPrivateKey(privateKey, NETWORK);

writeFileSync(KEYFILE, privateKey, { mode: 0o600 });
chmodSync(KEYFILE, 0o600);

console.log(`Wrote ${KEYFILE}`);
console.log(`Derivation: ${pathArg}`);
console.log(`Sponsor address (${NETWORK}): ${address}`);

const deployer = JSON.parse(readFileSync(resolve(ROOT, 'config/testnet.json'), 'utf8')).deployer;
if (address !== deployer) {
  console.warn(
    `\nNote: this address differs from config/testnet.json deployer (${deployer}).\n` +
      'That is fine for the relay sponsor — it only needs testnet STX for fees.\n' +
      'Fund this address via https://explorer.hiro.so/sandbox/faucet?chain=testnet'
  );
}
