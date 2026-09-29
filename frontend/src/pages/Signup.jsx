import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../lib/api.js';
import { ErrorBanner } from '../components/ui.jsx';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup(form.email, form.name, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account.'));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create an account</h1>
        <p className="text-sm text-slate-500">Save favorites, keep a cart, and track orders.</p>
      </div>

      <ErrorBanner message={error} />

      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">Name</label>
          <input id="name" required maxLength={120} autoComplete="name"
                 className="input" value={form.name} onChange={update('name')} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email"
                 className="input" value={form.email} onChange={update('email')} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">Password</label>
          <input id="password" type="password" required minLength={8} maxLength={72}
                 autoComplete="new-password" className="input"
                 value={form.password} onChange={update('password')} />
          <p className="mt-1 text-xs text-slate-500">
            At least 8 characters, mixing letters and numbers.
          </p>
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
