import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="card px-6 py-20 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <h1 className="mt-3 text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">That route does not exist.</p>
      <Link to="/" className="btn-primary mt-6">Back to the store</Link>
    </div>
  );
}
