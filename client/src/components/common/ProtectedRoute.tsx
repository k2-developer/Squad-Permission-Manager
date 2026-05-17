import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

interface Props {
  children: React.ReactNode;
  roles?: string[];
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner size="lg" />;
  // Unauthenticated visitors hit the marketing landing instead of the bare
  // login form — the landing has the Sign In CTA right at the top, so we
  // don't lose the login affordance, but we get a proper home page for /.
  if (!user) return <Navigate to="/welcome" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
