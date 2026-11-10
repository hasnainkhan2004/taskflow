import { cn } from './cn';

const priorityClasses = {
  Low: 'bg-slate-100 text-slate-700  ',
  Medium: 'bg-amber-100 text-amber-800  ',
  High: 'bg-red-100 text-red-800  ',
  todo: 'bg-slate-100 text-slate-700  ',
  in_progress: 'bg-amber-100 text-amber-800  ',
  done: 'bg-emerald-100 text-emerald-800  ',
};

const Badge = ({ className, tone, style, children, ...props }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none',
      priorityClasses[tone] || 'bg-cream text-muted ',
      className
    )}
    style={style}
    {...props}
  >
    {children}
  </span>
);

export default Badge;
