import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import API from '../api/axios';
import AuthField from '../components/AuthField';
import AuthLayout from '../components/AuthLayout';
import Button from '../components/ui/Button';

const ResetPassword = () => {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldError('');
    setServerError('');
    setSubmitting(true);
    try {
      const { data } = await API.post(
        `/auth/reset-password/${encodeURIComponent(token)}`,
        { password }
      );
      setSuccess(data.message);
    } catch (error) {
      setFieldError(error.response?.data?.errors?.password || '');
      setServerError(error.response?.data?.message || 'Could not reset your password. Request a new link.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password" subtitle="Use a strong password you haven't used here before.">
      {success ? (
        <div className="space-y-5">
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-success  " role="status">{success}</p>
          <p className="text-center text-sm"><Link className="font-semibold text-coral hover:underline" to="/login">Continue to sign in</Link></p>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {serverError && <p className="text-sm text-danger" role="alert">{serverError}</p>}
          <AuthField
            id="password"
            label="New password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldError}
            autoComplete="new-password"
          />
          <Button className="w-full" type="submit" loading={submitting}>Reset password</Button>
        </form>
      )}
    </AuthLayout>
  );
};

export default ResetPassword;
