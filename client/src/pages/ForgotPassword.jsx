import { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import AuthField from '../components/AuthField';
import AuthLayout from '../components/AuthLayout';
import Button from '../components/ui/Button';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setFieldError('');
    setSubmitting(true);
    try {
      await API.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (requestError) {
      setFieldError(requestError.response?.data?.errors?.email || '');
      setError(requestError.response?.data?.message || 'Could not send the reset link. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email and we'll send a reset link if an account matches.">
      {sent ? (
        <div className="space-y-5">
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-success  " role="status">
            If an account exists for that email, a password reset link has been sent.
          </p>
          <p className="text-center text-sm"><Link className="font-semibold text-coral hover:underline" to="/login">Back to sign in</Link></p>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <AuthField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldError}
            autoComplete="email"
          />
          <Button className="w-full" type="submit" loading={submitting}>Send reset link</Button>
          <p className="text-center text-sm"><Link className="font-semibold text-coral hover:underline" to="/login">Back to sign in</Link></p>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;
