import { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AuthField from '../components/AuthField';
import AuthLayout from '../components/AuthLayout';
import Button from '../components/ui/Button';
import { AuthContext } from '../context/authContext';
import { safeReturnTo } from '../auth/returnTo';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = safeReturnTo(
    location.state?.returnTo || new URLSearchParams(location.search).get('returnTo')
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setServerError('');
    setSubmitting(true);
    try {
      await login(identifier, password);
      toast.success('Welcome back!');
      navigate(safeReturnTo(returnTo), { replace: true });
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      setServerError(error.response?.data?.message || 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to pick up where you left off.">
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {serverError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-danger  " role="alert">
            {serverError}
          </p>
        )}
        <AuthField
          id="identifier"
          label="Username or email"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          error={errors.identifier}
          autoComplete="username"
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          autoComplete="current-password"
        />
        <div className="-mt-2 flex justify-end">
          <Link className="text-sm font-semibold text-coral hover:underline" to="/forgot-password">Forgot password?</Link>
        </div>
        <Button className="w-full" type="submit" loading={submitting}>
          Sign in
        </Button>
        <p className="text-center text-sm text-muted">
          New to TaskFlow? <Link className="font-semibold text-coral hover:underline" to="/signup" state={{ returnTo }}>Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Login;
