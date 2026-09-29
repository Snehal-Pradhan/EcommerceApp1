import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../lib/api.js';
import { EmptyState, ErrorBanner, Spinner, formatPrice } from '../components/ui.jsx';

export default function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/favorites');
      setFavorites(data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load favorites.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (productId) => {
    setError(null);
    try {
      await api.delete(`/favorites/${productId}`);
      setFavorites((current) => current.filter((f) => f.product_id !== productId));
    } catch (err) {
      setError(errorMessage(err, 'Could not remove that favorite.'));
    }
  };

  if (loading) return <Spinner label="Loading favorites" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Favorites</h1>
      <ErrorBanner message={error} onRetry={load} />

      {favorites.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Tap 'Add to favorites' on any product to keep it here."
          action={<Link to="/products" className="btn-primary">Browse products</Link>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {favorites.map(({ id, product }) => (
            <article key={id} className="card overflow-hidden">
              <Link to={`/products/${product.id}`} className="block aspect-square bg-slate-100">
                {product.image_url && (
                  <img src={product.image_url} alt={product.name}
                       className="h-full w-full object-cover" />
                )}
              </Link>
              <div className="space-y-2 p-4">
                <Link to={`/products/${product.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                  {product.name}
                </Link>
                <p className="font-semibold text-slate-900">{formatPrice(product.price)}</p>
                <button type="button" onClick={() => remove(product.id)} className="btn-secondary w-full">
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
