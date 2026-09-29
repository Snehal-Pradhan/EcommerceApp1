import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
  }`;

export default function Header() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <NavLink to="/" className="flex items-center gap-2 font-bold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm text-white">
            S
          </span>
          <span className="hidden sm:inline">Storefront</span>
        </NavLink>

        <nav className="flex items-center gap-1">
          <NavLink to="/products" className={navLinkClass}>Products</NavLink>
          {user && <NavLink to="/favorites" className={navLinkClass}>Favorites</NavLink>}
          {user && <NavLink to="/orders" className={navLinkClass}>Orders</NavLink>}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <NavLink to="/cart" className="btn-secondary relative">
            <span>Cart</span>
            {cart.item_count > 0 && (
              <span className="badge bg-brand-600 text-white">{cart.item_count}</span>
            )}
          </NavLink>

          {user ? (
            <>
              <span className="hidden text-sm text-slate-500 md:inline">{user.email}</span>
              <button type="button" onClick={handleLogout} className="btn-secondary">
                Sign out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn-secondary">Sign in</NavLink>
              <NavLink to="/signup" className="btn-primary">Create account</NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
