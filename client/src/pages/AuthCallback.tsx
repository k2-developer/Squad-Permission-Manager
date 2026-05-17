import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Logo from '../components/Logo';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refetchUser } = useAuth();

  useEffect(() => {
    // Cookies were set by the server redirect — just fetch user
    refetchUser().then(() => navigate('/', { replace: true }));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Logo size={72} className="text-accent-400 mx-auto mb-6" />
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-surface-400">Signing in...</p>
      </div>
    </div>
  );
}
