import { Link } from 'react-router-dom';
import { formatPrice } from './ui.jsx';

export default function ProductCard({ product, onAdd, busy = false }) {
  const outOfStock = product.stock === 0;

  return (
    <article className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <Link
        to={`/products/${product.id}`}
        className="block aspect-square overflow-hidden bg-slate-100"
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-slate-400">No image</div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug text-slate-900">
            <Link to={`/products/${product.id}`} className="hover:text-brand-700">
              {product.name}
            </Link>
          </h3>
          <span className="whitespace-nowrap font-bold text-slate-900">
            {formatPrice(product.price)}
          </span>
        </div>

        <p className="line-clamp-2 text-sm text-slate-500">{product.description}</p>

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="badge bg-slate-100 text-slate-600">{product.category}</span>
          {outOfStock ? (
            <span className="badge bg-rose-100 text-rose-700">Out of stock</span>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => onAdd?.(product)}
            >
              {busy ? 'Adding...' : 'Add to cart'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
