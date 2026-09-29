import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../lib/api.js';
import { EmptyState, ErrorBanner, Spinner, formatPrice } from '../components/ui.jsx';

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
  const [searchParams] = useSearchParams();
  const justPlaced = searchParams.get('placed');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/orders');
      setOrders(data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your orders.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Spinner label="Loading orders" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Your orders</h1>

      {justPlaced && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Order placed successfully. A confirmation is below.
        </p>
      )}
      <ErrorBanner message={error} onRetry={load} />

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Your order history will appear here after your first checkout."
          action={<a href="/products" className="btn-primary">Browse products</a>}
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-900">{order.reference}</p>
                  <p className="text-xs text-slate-500">
                    Placed {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
                <span className={`badge capitalize ${STATUS_STYLES[order.status] || 'bg-slate-100 text-slate-700'}`}>
                  {order.status}
                </span>
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
