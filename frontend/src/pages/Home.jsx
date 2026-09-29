import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { ErrorBanner, Spinner } from '../components/ui.jsx';

export default function Home() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [featured, cats] = await Promise.all([
        api.get('/products/featured', { params: { limit: 8 } }),
        api.get('/products/categories'),
      ]);
      setProducts(featured.data);
      setCategories(cats.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load products.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (product) => {
    if (!user) {
      setNotice('Sign in to add items to your cart.');
      return;
    }
    setBusyId(product.id);
    setNotice(null);
    try {
      await addItem(product.id, 1);
      setNotice(`${product.name} added to your cart.`);
    } catch (err) {
      setError(errorMessage(err, 'Could not add to cart.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-14 text-white sm:px-12">
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          A three-tier store, end to end
        </h1>
        <p className="mt-3 max-w-xl text-brand-100">
          React on the front, FastAPI in the middle, PostgreSQL underneath. Every order you
          place exercises authentication, transactions, and stock reservation.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/products" className="btn bg-white text-brand-700 hover:bg-brand-50">
            Browse products
          </Link>
          {!user && (
            <Link to="/signup" className="btn border border-white/40 text-white hover:bg-white/10">
              Create an account
            </Link>
          )}
        </div>
      </section>

      {notice && (
        <p className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {notice}
        </p>
      )}
      <ErrorBanner message={error} onRetry={load} />

      {categories.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Categories
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Link
                key={cat.category}
                to={`/products?category=${encodeURIComponent(cat.category)}`}
                className="badge border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700"
              >
                {cat.category}
                <span className="ml-1 text-slate-400">{cat.product_count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-bold text-slate-900">Featured</h2>
          <Link to="/products" className="text-sm font-medium text-brand-700 hover:underline">
            View all
          </Link>
        </div>

        {loading ? (
          <Spinner label="Loading products" />
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
      </section>
    </div>
  );
}
