import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { EmptyState, ErrorBanner, Spinner } from '../components/ui.jsx';

export default function Products() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';

  // The URL is the source of truth for filters, so a filtered view is
  // bookmarkable and survives a refresh.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: 60 };
      if (q) params.q = q;
      if (category) params.category = category;
      const [list, cats] = await Promise.all([
        api.get('/products', { params }),
        api.get('/products/categories'),
      ]);
      setProducts(list.data);
      setCategories(cats.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load products.'));
    } finally {
      setLoading(false);
    }
  }, [q, category]);

  useEffect(() => {
    load();
  }, [load]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const handleAdd = async (product) => {
    if (!user) {
      setError('Sign in to add items to your cart.');
      return;
    }
    setBusyId(product.id);
    try {
      await addItem(product.id, 1);
    } catch (err) {
      setError(errorMessage(err, 'Could not add to cart.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500">
            {loading ? 'Loading...' : `${products.length} item${products.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <form
          className="flex w-full max-w-sm gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setParam('q', new FormData(e.currentTarget).get('q'));
          }}
        >
          <input
            name="q"
            defaultValue={q}
            placeholder="Search products"
            className="input"
            aria-label="Search products"
          />
          <button type="submit" className="btn-primary">Search</button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setParam('category', '')}
          className={`badge ${!category ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.category}
            type="button"
            onClick={() => setParam('category', cat.category)}
            className={`badge ${
              category === cat.category
                ? 'bg-brand-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:border-brand-300'
            }`}
          >
            {cat.category}
          </button>
        ))}
      </div>

      <ErrorBanner message={error} onRetry={load} />

      {loading ? (
        <Spinner label="Loading products" />
      ) : products.length === 0 ? (
        <EmptyState
          title="No products match"
          description="Try a different search term or clear the category filter."
          action={
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setSearchParams({})}
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={handleAdd}
              busy={busyId === product.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
