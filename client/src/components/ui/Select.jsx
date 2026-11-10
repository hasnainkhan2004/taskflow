import { cn } from './cn';

const Select = ({ className, children, ...props }) => (
  <select
    className={cn(
      'min-h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/15',
      className
    )}
    {...props}
  >
    {children}
  </select>
);

export default Select;
