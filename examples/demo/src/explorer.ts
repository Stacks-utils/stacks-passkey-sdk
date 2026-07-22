export type ExplorerNetwork = 'testnet' | 'mainnet';

export function txExplorerUrl(txid: string, network: ExplorerNetwork = 'testnet'): string {
  const id = txid.startsWith('0x') ? txid.slice(2) : txid;
  return `https://explorer.hiro.so/txid/${id}?chain=${network}`;
}

export function contractExplorerUrl(contractId: string, network: ExplorerNetwork = 'testnet'): string {
  return `https://explorer.hiro.so/address/${contractId}?chain=${network}`;
}

export function addressExplorerUrl(address: string, network: ExplorerNetwork = 'testnet'): string {
  return `https://explorer.hiro.so/address/${address}?chain=${network}`;
}
