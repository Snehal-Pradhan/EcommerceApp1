import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Demo store - React, FastAPI, PostgreSQL.</p>
        <nav className="flex gap-4">
          <Link to="/products" className="hover:text-brand-700">Products</Link>
          <a href="/health" className="hover:text-brand-700">Health</a>
        </nav>
      </div>
    </footer>
  );
}
