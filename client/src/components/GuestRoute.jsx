import { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/authContext';
import { safeReturnTo } from '../auth/returnTo';

const GuestRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) return <div className="auth-loading" role="status">Loading your session...</div>;
  if (user) {
    const queryReturnTo = new URLSearchParams(location.search).get('returnTo');
    return <Navigate to={safeReturnTo(location.state?.returnTo || queryReturnTo || '/')} replace />;
  }
  return children;
};

export default GuestRoute;
