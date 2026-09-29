import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../lib/api.js';
import { useCart } from '../context/CartContext.jsx';
import { ErrorBanner, formatPrice } from '../components/ui.jsx';

const TAX_RATE = 0.08;
const SHIPPING_FLAT = 9.99;
const FREE_SHIPPING_THRESHOLD = 100;

export default function Checkout() {
  const { cart, refresh } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', line1: '', city: '', postcode: '', country: 'US',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const subtotal = Number(cart.subtotal || 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  const total = Math.round((subtotal + tax + shipping) * 100) / 100;

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post('/orders', {
        shipping_address: {
          name: form.name,
          line1: form.line1,
          city: form.city,
          postcode: form.postcode,
          country: form.country,
        },
      });
      await refresh();
      navigate(`/orders?placed=${data.id}`);
    } catch (err) {
      setError(errorMessage(err, 'Could not place your order.'));
      setSubmitting(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="card px-6 py-16 text-center">
        <p className="text-slate-500">Your cart is empty.</p>
        <Link to="/products" className="btn-primary mt-4">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={submit} className="card space-y-4 p-6 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Shipping address</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">Full name</label>
            <input id="name" required className="input" value={form.name} onChange={update('name')} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="line1">Address</label>
            <input id="line1" required className="input" value={form.line1} onChange={update('line1')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="city">City</label>
              <input id="city" required className="input" value={form.city} onChange={update('city')} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="postcode">Postcode</label>
              <input id="postcode" required className="input" value={form.postcode} onChange={update('postcode')} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="country">Country</label>
              <input id="country" required className="input" value={form.country} onChange={update('country')} />
            </div>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Placing order...' : `Place order - ${formatPrice(total)}`}
          </button>
        </form>

        <div className="card h-fit space-y-3 p-5">
          <h2 className="font-semibold text-slate-900">Summary</h2>
          {cart.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm text-slate-600">
              <span className="truncate pr-2">
                {item.quantity} x {item.name}
              </span>
              <span>{formatPrice(item.line_total)}</span>
            </div>
          ))}
          <hr className="border-slate-200" />
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span>Tax (8%)</span><span>{formatPrice(tax)}</span></div>
          <div className="flex justify-between text-sm">
            <span>Shipping</span>
            <span>{shipping === 0 ? 'Free' : formatPrice(shipping)}</span>
          </div>
          <hr className="border-slate-200" />
          <div className="flex justify-between font-bold text-slate-900">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
