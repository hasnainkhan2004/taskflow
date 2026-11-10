import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import Input from './ui/Input';

const AuthField = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error,
  autoComplete,
  required = true,
}) => {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">{label}</label>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={isPassword && visible ? 'text' : type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          aria-describedby={error ? `${id}-error` : undefined}
          invalid={Boolean(error)}
          className={isPassword ? 'pr-12' : undefined}
        />
        {isPassword && (
          <button
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted transition hover:text-ink"
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
      {error && <p className="text-xs font-medium text-danger" id={`${id}-error`}>{error}</p>}
    </div>
  );
};

export default AuthField;
