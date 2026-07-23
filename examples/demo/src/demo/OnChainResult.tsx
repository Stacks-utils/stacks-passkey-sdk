import { useEffect, useState } from 'react';
import { STACKS_TESTNET } from '@stacks/network';
import { txExplorerUrl } from '../explorer.js';
import { StatusBadge } from '../components/ui.js';

type TxEvent = { event_type: string; contract_log?: { contract_id?: string; value?: { repr?: string } } };

export function OnChainResult({
  txid,
  status,
  label,
}: {
  txid?: string;
  status?: string;
  label?: string;
}) {
  const [blockHeight, setBlockHeight] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);

  const isConfirmed = status === 'success';

  useEffect(() => {
    if (!txid || txid === 'already-registered' || !isConfirmed) {
      setBlockHeight(null);
      setEvents([]);
      return;
    }
    const id = txid.startsWith('0x') ? txid.slice(2) : txid;
    void fetch(`${STACKS_TESTNET.client.baseUrl}/extended/v1/tx/${id}`)
      .then((r) => r.json())
      .then((data: { block_height?: number; events?: TxEvent[] }) => {
        setBlockHeight(data.block_height != null ? String(data.block_height) : null);
        const reps =
          data.events
            ?.filter((e) => e.event_type === 'smart_contract_log')
            .map((e) => e.contract_log?.value?.repr ?? '')
            .filter(Boolean)
            .slice(0, 4) ?? [];
        setEvents(reps);
      })
      .catch(() => {
        setBlockHeight(null);
        setEvents([]);
      });
  }, [txid, isConfirmed]);

  if (!txid || txid === 'already-registered') {
    return (
      <div className="onchain-card onchain-empty">
        <h3>On-chain result</h3>
        <p>Run an SDK action to see transaction details and nested contract events here.</p>
      </div>
    );
  }

  return (
    <div className="onchain-card">
      <div className="onchain-head">
        <h3>On-chain result</h3>
        <StatusBadge status={status} />
      </div>
      {label && <p className="onchain-label">{label}</p>}
      {!isConfirmed && (
        <p className="onchain-pending">Transaction is confirming on testnet. Block and events appear once confirmed.</p>
      )}
      <dl className="onchain-meta">
        <div>
          <dt>Tx ID</dt>
          <dd>
            <a href={txExplorerUrl(txid)} target="_blank" rel="noreferrer">
              {txid.slice(0, 10)}…{txid.slice(-8)}
            </a>
          </dd>
        </div>
        {blockHeight && (
          <div>
            <dt>Block</dt>
            <dd>{blockHeight}</dd>
          </div>
        )}
      </dl>
      {events.length > 0 && (
        <div className="onchain-events">
          <strong>Events</strong>
          <ul>
            {events.map((ev, i) => (
              <li key={i}>
                <code>{ev.length > 120 ? `${ev.slice(0, 120)}…` : ev}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
      <a className="btn btn-outline btn-sm" href={txExplorerUrl(txid)} target="_blank" rel="noreferrer">
        View on explorer →
      </a>
    </div>
  );
}
