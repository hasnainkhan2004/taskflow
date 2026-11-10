import { useContext, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AuthField from '../components/AuthField';
import AuthLayout from '../components/AuthLayout';
import Button from '../components/ui/Button';
import { AuthContext } from '../context/authContext';
import { safeReturnTo } from '../auth/returnTo';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = safeReturnTo(
    location.state?.returnTo || new URLSearchParams(location.search).get('returnTo')
  );

  const strength = useMemo(() => {
    if (!password) return 0;
    return [
      password.length >= 8,
      /[a-z]/.test(password) && /[A-Z]/.test(password),
      /\d/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length;
  }, [password]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setServerError('');
    setSubmitting(true);
    try {
      await register(username, email, password);
      toast.success('Your account is ready.');
      navigate(safeReturnTo(returnTo), { replace: true });
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      setServerError(error.response?.data?.message || 'Unable to create your account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="A few details and you're ready to go.">
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {serverError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-danger  " role="alert">
            {serverError}
          </p>
        )}
        <AuthField
          id="username"
          label="Username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          error={errors.username}
          autoComplete="username"
        />
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          autoComplete="email"
        />
        <div className="space-y-2">
          <AuthField
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            autoComplete="new-password"
          />
          <div className="flex gap-1.5" aria-label={`Password strength: ${strength} of 4`}>
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={`h-1 flex-1 rounded-full ${strength >= step ? (strength < 3 ? 'bg-amber' : 'bg-success') : 'bg-border'}`}
              />
            ))}
          </div>
          <p className="text-xs leading-5 text-muted">
            At least 8 characters. Avoid common passwords and details from your username or email.
          </p>
        </div>
        <Button className="w-full" type="submit" loading={submitting}>Create account</Button>
        <p className="text-center text-sm text-muted">
          Already have an account? <Link className="font-semibold text-coral hover:underline" to="/login" state={{ returnTo }}>Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Register;
