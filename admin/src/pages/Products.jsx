import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../lib/api.js';
import { ErrorBanner, Spinner, formatPrice } from '../components/ui.jsx';

const EMPTY = {
  sku: '', name: '', description: '', price: '', category: '', stock: '0', image_url: '',
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);   // null = list mode, object = create mode
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/admin/products', { params: { limit: 100 } });
      setProducts(data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load products.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/admin/products', {
        sku: form.sku,
        name: form.name,
        description: form.description || '',
        price: form.price || '0.00',
        category: form.category,
        stock: Number(form.stock) || 0,
        image_url: form.image_url || null,
      });
      setForm(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not create the product.'));
    } finally {
      setBusy(false);
    }
  };

  const updateStock = async (product, stock) => {
    setError(null);
    try {
      await api.put(`/admin/products/${product.id}`, { stock: Number(stock) || 0 });
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not update stock.'));
    }
  };

  const toggleActive = async (product) => {
    setError(null);
    try {
      await api.put(`/admin/products/${product.id}`, { is_active: !product.is_active });
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not update the product.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Products</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setForm(form ? null : { ...EMPTY })}
        >
          {form ? 'Cancel' : 'New product'}
        </button>
      </div>

      <ErrorBanner message={error} onRetry={load} />

      {form && (
        <form onSubmit={create} className="card grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="sku">SKU</label>
            <input id="sku" required pattern="[A-Za-z0-9._-]+" className="input"
                   value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">Name</label>
            <input id="name" required className="input"
                   value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="category">Category</label>
            <input id="category" required className="input"
                   value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="price">Price</label>
              <input id="price" required inputMode="decimal" className="input"
                     value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="stock">Stock</label>
              <input id="stock" type="number" min="0" required className="input"
                     value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="description">Description</label>
            <textarea id="description" rows="2" className="input"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="image_url">Image URL</label>
            <input id="image_url" type="url" className="input"
                   value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Creating...' : 'Create product'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <Spinner label="Loading products" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.id} className={product.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-mono text-xs">{product.sku}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{product.name}</td>
                  <td className="px-4 py-3 text-slate-600">{product.category}</td>
                  <td className="px-4 py-3 text-slate-900">{formatPrice(product.price)}</td>
                  <td className="px-4 py-3">
                    <label className="sr-only" htmlFor={`stock-${product.id}`}>Stock</label>
                    <input
                      id={`stock-${product.id}`}
                      type="number"
                      min="0"
                      defaultValue={product.stock}
                      onBlur={(e) => {
                        if (Number(e.target.value) !== product.stock) {
                          updateStock(product, e.target.value);
                        }
                      }}
                      className="input w-20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                      product.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {product.is_active ? 'Listed' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => toggleActive(product)} className="btn-secondary">
                      {product.is_active ? 'Unlist' : 'Relist'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
