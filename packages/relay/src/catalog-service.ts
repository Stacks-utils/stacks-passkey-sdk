import {
  Cl,
  broadcastTransaction,
  fetchCallReadOnlyFunction,
  makeContractCall,
  cvToValue,
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import type { RelayConfig } from './types.js';
import type { CatalogStore } from './catalog.js';
import type { GasTankStore } from './gas-tank.js';
import { broadcastWithNonceRetry, runWithDeployerLock } from './registrar-queue.js';
import { runWithSponsorLock } from './sponsor-lock.js';
import { fetchStxBalanceMicro } from './on-chain-balance.js';

const REGISTRATION_FEE_MULTIPLIER = 3n;

export interface EnsureResult {
  contractId: string;
  registered: boolean;
  alreadyRegistered: boolean;
  registrationTxid?: string;
  functions: string[];
}

function getNetwork(name: RelayConfig['network']) {
  return name === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

function parseContractId(contractId: string): { address: string; name: string } {
  const dot = contractId.indexOf('.');
  if (dot === -1) throw new Error('contractId must be address.name');
  return { address: contractId.slice(0, dot), name: contractId.slice(dot + 1) };
}

export class CatalogService {
  constructor(
    private readonly config: RelayConfig,
    private readonly catalog: CatalogStore,
    private readonly gasTank?: GasTankStore
  ) {}

  async ensureContract(projectId: string, contractId: string): Promise<EnsureResult> {
    const limits = {
      maxContracts: Number(process.env.CATALOG_MAX_CONTRACTS_PER_PROJECT ?? '50'),
      maxRegistrationsPerDay: Number(process.env.CATALOG_MAX_REGISTRATIONS_PER_DAY ?? '5'),
    };

    const cached = this.catalog.find(projectId, contractId);
    if (cached?.registrationTxid) {
      return {
        contractId,
        registered: true,
        alreadyRegistered: true,
        registrationTxid: cached.registrationTxid,
        functions: cached.functions,
      };
    }

    if (this.gasTank) {
      if (this.catalog.countContracts(projectId) >= limits.maxContracts && !cached) {
        throw new Error(`Project exceeded max registered contracts (${limits.maxContracts})`);
      }
      if (this.catalog.countRegistrationsToday(projectId) >= limits.maxRegistrationsPerDay) {
        throw new Error(`Project exceeded daily registration limit (${limits.maxRegistrationsPerDay})`);
      }
    }

    const functions = await this.fetchPublicFunctions(contractId);
    if (!functions.includes('passkey-exec')) {
      throw new Error('Contract must implement public passkey-exec (passkey-exec-trait)');
    }

    const adapterAddress = process.env.PASSKEY_ADAPTER_ADDRESS;
    const adapterName = process.env.PASSKEY_ADAPTER_NAME ?? 'passkey-adapter';
    if (!adapterAddress) {
      throw new Error('PASSKEY_ADAPTER_ADDRESS is not configured on relay');
    }

    const network = getNetwork(this.config.network);
    const alreadyOnChain = await this.isRegisteredOnChain(adapterAddress, adapterName, contractId);
    let registrationTxid = cached?.registrationTxid;

    if (!alreadyOnChain) {
      registrationTxid = await runWithDeployerLock(() =>
        this.submitRegistration(projectId, adapterAddress, adapterName, contractId)
      );
      this.catalog.incrementRegistrationsToday(projectId);
    }

    this.catalog.save({
      contractId,
      projectId,
      functions,
      registeredAt: new Date().toISOString(),
      registrationTxid,
    });

    return {
      contractId,
      registered: true,
      alreadyRegistered: alreadyOnChain,
      registrationTxid,
      functions,
    };
  }

  private async fetchPublicFunctions(contractId: string): Promise<string[]> {
    const network = getNetwork(this.config.network);
    const { address, name } = parseContractId(contractId);
    const url = `${network.client.baseUrl}/v2/contracts/interface/${address}/${name}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Unable to fetch contract interface for ${contractId}: ${res.status}`);
    }
    const body = (await res.json()) as { functions?: Array<{ name: string; access: string }> };
    return (body.functions ?? [])
      .filter((f) => f.access === 'public')
      .map((f) => f.name);
  }

  private async isRegisteredOnChain(
    adapterAddress: string,
    adapterName: string,
    contractId: string
  ): Promise<boolean> {
    const network = getNetwork(this.config.network);
    const { address, name } = parseContractId(contractId);
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: adapterAddress,
        contractName: adapterName,
        functionName: 'is-registered',
        functionArgs: [Cl.contractPrincipal(address, name)],
        network,
        senderAddress: adapterAddress,
      });
      const parsed = cvToValue(result) as boolean | { value?: boolean };
      return parsed === true || (typeof parsed === 'object' && parsed?.value === true);
    } catch {
      return false;
    }
  }

  private async submitRegistration(
    projectId: string,
    adapterAddress: string,
    adapterName: string,
    contractId: string
  ): Promise<string> {
    const network = getNetwork(this.config.network);
    const { address, name } = parseContractId(contractId);
    const fee = this.config.policy.maxFeeMicroStx * REGISTRATION_FEE_MULTIPLIER;

    let creds: { sponsorPrivateKey: string; sponsorAddress: string } | null = null;
    if (this.gasTank) {
      const sponsor = this.gasTank.getSponsorCredentials(projectId);
      if (!sponsor) throw new Error('Wallet not found');
      const onChain = await fetchStxBalanceMicro(sponsor.sponsorAddress, this.config.network);
      const available = this.gasTank.availableBalance(onChain, sponsor.wallet);
      if (available < fee) {
        throw new Error(
          `Insufficient gas tank balance for contract registration. Deposit STX to ${sponsor.sponsorAddress}`
        );
      }
      this.gasTank.reserveGas(projectId, fee);
      creds = sponsor;
    }

    const senderKey = creds?.sponsorPrivateKey ?? this.config.registrarPrivateKey ?? this.config.sponsorPrivateKey;
    const lockAddress = creds?.sponsorAddress;

    const submit = async (): Promise<string> => {
      let reserved = fee;
      try {
        const txid = await broadcastWithNonceRetry(
          async () => ({
            transaction: await makeContractCall({
              contractAddress: adapterAddress,
              contractName: adapterName,
              functionName: 'register-contract',
              functionArgs: [Cl.contractPrincipal(address, name)],
              senderKey,
              network,
              fee,
            }),
          }),
          async (tx) =>
            broadcastTransaction({
              transaction: tx as Awaited<ReturnType<typeof makeContractCall>>,
              network,
            }) as Promise<{
              txid?: string;
              error?: string;
              reason?: string;
            }>
        );
        if (this.gasTank) {
          this.gasTank.recordSponsor(projectId, fee, txid, 'gasless', undefined, reserved);
          reserved = 0n;
        }
        return txid;
      } finally {
        if (reserved > 0n && this.gasTank) {
          this.gasTank.releaseReservation(projectId, reserved);
        }
      }
    };

    if (lockAddress) {
      return runWithSponsorLock(lockAddress, submit);
    }
    return submit();
  }
}
