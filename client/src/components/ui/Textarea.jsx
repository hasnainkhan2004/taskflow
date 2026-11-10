import { cn } from './cn';

const Textarea = ({ className, ...props }) => (
  <textarea
    className={cn(
      'min-h-24 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 transition focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/15',
      className
    )}
    {...props}
  />
);

export default Textarea;
