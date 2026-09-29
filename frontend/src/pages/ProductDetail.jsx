import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { ErrorBanner, Spinner, formatPrice } from '../components/ui.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/products/${id}`);
      setProduct(data);
    } catch (err) {
      setError(errorMessage(err, 'Product not found.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleAdd = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/products/${id}` } });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addItem(Number(id), quantity);
      navigate('/cart');
    } catch (err) {
      setError(errorMessage(err, 'Could not add to cart.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleFavorite = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/products/${id}` } });
      return;
    }
    try {
      if (isFavorite) {
        await api.delete(`/favorites/${id}`);
        setIsFavorite(false);
      } else {
        await api.post(`/favorites/${id}`);
        setIsFavorite(true);
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not update favorites.'));
    }
  };

  if (loading) return <Spinner label="Loading product" />;
  if (error && !product) return <ErrorBanner message={error} onRetry={load} />;
  if (!product) return null;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500">
        <Link to="/products" className="hover:text-brand-700">Products</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-900">{product.name}</span>
      </nav>

      <ErrorBanner message={error} />

      <div className="card grid gap-8 p-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-lg bg-slate-100">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-64 place-items-center text-slate-400">No image</div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <span className="badge bg-slate-100 text-slate-600">{product.category}</span>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{product.name}</h1>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatPrice(product.price)}
            </p>
          </div>

          <p className="leading-relaxed text-slate-600">{product.description}</p>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">SKU</dt>
              <dd className="font-medium text-slate-900">{product.sku}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Availability</dt>
              <dd className="font-medium text-slate-900">
                {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="qty">Quantity</label>
            <input
              id="qty"
              type="number"
              min="1"
              max={Math.max(product.stock, 1)}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className="input w-24"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy || product.stock === 0}
              className="btn-primary"
            >
              {product.stock === 0 ? 'Out of stock' : busy ? 'Adding...' : 'Add to cart'}
            </button>
            <button type="button" onClick={toggleFavorite} className="btn-secondary">
              {isFavorite ? 'Remove favorite' : 'Add to favorites'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
