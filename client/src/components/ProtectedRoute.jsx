import { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/authContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) return <div className="auth-loading" role="status">Loading your session...</div>;
  if (!user) return <Navigate to="/login" state={{ returnTo: `${location.pathname}${location.search}` }} replace />;

  return children;
};

export default ProtectedRoute;