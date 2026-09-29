import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../lib/api.js';
import { ErrorBanner } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form.email, form.password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not sign you in.'));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
        <p className="text-sm text-slate-500">Use the demo account to explore the store.</p>
      </div>

      <ErrorBanner message={error} />

      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email"
                 className="input" value={form.email} onChange={update('email')} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">Password</label>
          <input id="password" type="password" required autoComplete="current-password"
                 className="input" value={form.password} onChange={update('password')} />
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="card space-y-2 p-4 text-sm">
        <p className="font-medium text-slate-700">Demo accounts (local only)</p>
        <p className="text-slate-500">
          Customer: <code className="text-slate-700">customer@example.com</code>
        </p>
        <p className="text-slate-500">
          Admin: <code className="text-slate-700">admin@example.com</code>
        </p>
        <p className="text-slate-500">
          Password: <code className="text-slate-700">Password123</code>
        </p>
      </div>

      <p className="text-center text-sm text-slate-500">
        No account?{' '}
        <Link to="/signup" className="font-medium text-brand-700 hover:underline">Create one</Link>
      </p>
    </div>
  );
}
