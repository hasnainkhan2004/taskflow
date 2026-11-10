import { cn } from './cn';

const Input = ({ className, invalid = false, ...props }) => (
  <input
    className={cn(
      'min-h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 transition focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/15',
      invalid && 'border-danger focus:border-danger focus:ring-danger/15',
      className
    )}
    aria-invalid={invalid || undefined}
    {...props}
  />
);

export default Input;
