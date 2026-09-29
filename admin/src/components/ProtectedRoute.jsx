import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner } from './ui.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Checking loading first avoids bouncing an admin to /login on a hard refresh,
  // before the stored token has been validated.
  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
