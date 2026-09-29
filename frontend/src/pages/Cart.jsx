import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useCart } from '../context/CartContext.jsx';
import { errorMessage } from '../lib/api.js';
import { EmptyState, ErrorBanner, formatPrice } from '../components/ui.jsx';

export default function Cart() {
  const { cart, updateItem, removeItem, clear, loading } = useCart();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  const run = async (fn) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err, 'Could not update your cart.'));
    }
  };

  if (loading) return <p className="py-12 text-center text-slate-500">Loading cart...</p>;

  if (cart.items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Once you add something it will show up here."
        action={<Link to="/products" className="btn-primary">Browse products</Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your cart</h1>
        <button type="button" onClick={() => run(clear)} className="text-sm text-rose-600 hover:underline">
          Clear cart
        </button>
      </div>

      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card divide-y divide-slate-200 lg:col-span-2">
          {cart.items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 p-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <Link to={`/products/${item.product_id}`} className="font-medium text-slate-900 hover:text-brand-700">
                  {item.name}
                </Link>
                <p className="text-sm text-slate-500">{formatPrice(item.price)} each</p>
                {item.quantity > item.stock && (
                  <p className="text-xs text-rose-600">Only {item.stock} left in stock</p>
                )}
              </div>

              <label className="sr-only" htmlFor={`qty-${item.product_id}`}>Quantity</label>
              <input
                id={`qty-${item.product_id}`}
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => run(() => updateItem(item.product_id, Number(e.target.value) || 1))}
                className="input w-20"
              />

              <span className="w-24 text-right font-semibold text-slate-900">
                {formatPrice(item.line_total)}
              </span>

              <button
                type="button"
                onClick={() => run(() => removeItem(item.product_id))}
                className="text-sm text-slate-400 hover:text-rose-600"
                aria-label={`Remove ${item.name}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="card h-fit space-y-3 p-5">
          <h2 className="font-semibold text-slate-900">Summary</h2>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal ({cart.item_count} items)</span>
            <span>{formatPrice(cart.subtotal)}</span>
          </div>
          <p className="text-xs text-slate-400">Tax and shipping are calculated at checkout.</p>
          <button
            type="button"
            onClick={() => navigate('/checkout')}
            className="btn-primary w-full"
          >
            Proceed to checkout
          </button>
        </div>
      </div>
    </div>
  );
}
