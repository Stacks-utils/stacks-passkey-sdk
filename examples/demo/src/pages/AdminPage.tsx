import { AdminShell } from '../admin/AdminDashboard.js';
import { WalletProvider } from '../admin/WalletProvider.js';

export function AdminPage() {
  return (
    <WalletProvider>
      <div className="admin-page">
        <AdminShell />
      </div>
    </WalletProvider>
  );
}
