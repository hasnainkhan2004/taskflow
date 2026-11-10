import { cn } from './cn';

const Spinner = ({ className, label = 'Loading' }) => (
  <span
    className={cn(
      'inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent align-[-3px]',
      className
    )}
    role="status"
    aria-label={label}
  />
);

export default Spinner;
