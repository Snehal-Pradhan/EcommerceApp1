import { useEffect, useState } from 'react';
import api, { errorMessage } from '../lib/api.js';
import { ErrorBanner, Spinner, formatPrice } from '../components/ui.jsx';

function Stat({ label, value, hint, tone = 'default' }) {
  const tones = {
    default: 'text-slate-900',
    warn: 'text-amber-600',
    good: 'text-emerald-600',
  };
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load dashboard.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Spinner label="Loading dashboard" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  const statuses = Object.entries(stats.orders_by_status || {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Revenue" value={formatPrice(stats.revenue)} hint="excludes cancelled" tone="good" />
        <Stat label="Orders" value={stats.total_orders} />
        <Stat label="Customers" value={stats.total_users} />
        <Stat
          label="Low stock"
          value={stats.low_stock_count}
          hint="5 units or fewer"
          tone={stats.low_stock_count > 0 ? 'warn' : 'default'}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Products" value={stats.total_products} hint={`${stats.active_products} listed`} />
        <Stat label="Active products" value={stats.active_products} />
        <Stat label="Inactive products" value={stats.total_products - stats.active_products} />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Orders by status</h2>
        {statuses.length === 0 ? (
          <p className="text-sm text-slate-500">No orders yet.</p>
        ) : (
          <ul className="space-y-2">
            {statuses.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between text-sm">
                <span className="capitalize text-slate-600">{status}</span>
                <span className="font-semibold text-slate-900">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
