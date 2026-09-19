import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getHomePath } from '@/lib/menuPermissions';

export default function JoinInvite() {
  const { user } = useAuth();
  return <Navigate to={user ? getHomePath(user) : '/'} replace />;
}