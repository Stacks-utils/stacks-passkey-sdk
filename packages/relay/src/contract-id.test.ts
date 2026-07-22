import { describe, expect, it } from 'vitest';
import { Cl, makeContractCall, randomPrivateKey } from '@stacks/transactions';
import { extractContractCallId } from './contract-id.js';
import { isContractAllowed } from './rate-limit.js';

describe('extractContractCallId', () => {
  it('extracts a string contract id from deserialized contract-call payloads', async () => {
    const tx = await makeContractCall({
      contractAddress: 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ',
      contractName: 'passkey-account-v2',
      functionName: 'register',
      functionArgs: [Cl.buffer(new Uint8Array(33).fill(2))],
      senderKey: randomPrivateKey(),
      sponsored: true,
      fee: 0n,
      network: 'testnet',
    });

    const contractId = extractContractCallId(tx.payload);
    expect(contractId).toBe('ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-account-v2');
    expect(
      isContractAllowed(contractId!, {
        allowedContracts: ['ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ'],
        maxFeeMicroStx: 50_000n,
        rateLimit: { windowMs: 60_000, maxRequests: 100 },
      })
    ).toBe(true);
  });
});
