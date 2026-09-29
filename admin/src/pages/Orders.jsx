import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../lib/api.js';
import { ErrorBanner, Spinner, formatPrice } from '../components/ui.jsx';

const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-blue-100 text-blue-800',
  shipped: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-600',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/admin/orders', { params: { limit: 100 } });
      setOrders(data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load orders.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (orderId, status) => {
    setError(null);
    try {
      await api.put(`/admin/orders/${orderId}`, { status });
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not update the order.'));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
      <ErrorBanner message={error} onRetry={load} />

      {loading ? (
        <Spinner label="Loading orders" />
      ) : orders.length === 0 ? (
        <div className="card px-6 py-16 text-center text-slate-500">
          No orders yet. Place one from the storefront to see it here.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-900">{order.reference}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(order.created_at).toLocaleString()} - ships to{' '}
                    {order.shipping_name}, {order.shipping_city} {order.shipping_postcode}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`badge ${STATUS_STYLES[order.status]}`}>{order.status}</span>
                  <label className="sr-only" htmlFor={`status-${order.id}`}>Change status</label>
                  <select
                    id={`status-${order.id}`}
                    className="input w-36"
                    value={order.status}
                    onChange={(e) => setStatus(order.id, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <ul className="mt-4 space-y-1 text-sm text-slate-600">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>{item.quantity} x {item.name}</span>
                    <span>{formatPrice(item.line_total)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex justify-end gap-4 border-t border-slate-100 pt-3 text-sm">
                <span className="text-slate-500">Subtotal {formatPrice(order.subtotal)}</span>
                <span className="text-slate-500">Tax {formatPrice(order.tax)}</span>
                <span className="text-slate-500">Shipping {formatPrice(order.shipping)}</span>
                <span className="font-bold text-slate-900">{formatPrice(order.total)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
