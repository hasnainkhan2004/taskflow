import { MoreHorizontal } from 'lucide-react';
import { cn } from './cn';

const Dropdown = ({ label = 'Open menu', children, className }) => (
  <details className={cn('group relative', className)}>
    <summary
      aria-label={label}
      className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg text-muted transition hover:bg-cream hover:text-ink focus-visible:outline-none "
    >
      <MoreHorizontal size={19} />
    </summary>
    <div className="absolute right-0 z-30 mt-1 min-w-40 rounded-xl border border-border bg-surface p-1.5 shadow-card [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-lg [&_button]:px-3 [&_button]:py-2 [&_button]:text-left [&_button]:text-sm [&_button]:text-ink [&_button]:transition [&_button]:hover:bg-cream ">
      {children}
    </div>
  </details>
);

export default Dropdown;
