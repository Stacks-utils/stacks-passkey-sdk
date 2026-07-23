import type { StacksNetwork } from '@stacks/network';
import {
  ClarityVersion,
  makeContractDeploy,
  type ClarityVersion as ClarityVersionType,
} from '@stacks/transactions';
import type { RelayClient } from './relay-client.js';
import { bufferToHex } from './crypto.js';
import { normalizeTxId } from './broadcast.js';
import { withNonceRetry } from './nonce.js';
import type { FeeOptions } from './fee.js';

export interface ContractDeployParams {
  contractName: string;
  codeBody: string;
  originPrivateKey: string;
  network: StacksNetwork;
  clarityVersion?: ClarityVersionType;
}

async function buildOriginSignedDeployTx(params: ContractDeployParams) {
  return makeContractDeploy({
    contractName: params.contractName,
    codeBody: params.codeBody,
    senderKey: params.originPrivateKey,
    sponsored: true,
    fee: 0n,
    network: params.network,
    clarityVersion: params.clarityVersion ?? ClarityVersion.Clarity5,
  });
}

export async function broadcastContractDeploy(
  params: ContractDeployParams,
  relay: RelayClient
): Promise<string> {
  return withNonceRetry(async () => {
    const tx = await buildOriginSignedDeployTx(params);
    const txHex = `0x${bufferToHex(tx.serializeBytes())}`;
    const sponsored = await relay.sponsorTransaction(txHex, { billingMode: 'gasless' });
    return normalizeTxId(sponsored.txid);
  });
}

export async function isContractDeployed(
  network: StacksNetwork,
  contractAddress: string,
  contractName: string
): Promise<boolean> {
  const res = await fetch(`${network.client.baseUrl}/v2/contracts/interface/${contractAddress}/${contractName}`);
  return res.ok;
}

export { buildOriginSignedDeployTx };
