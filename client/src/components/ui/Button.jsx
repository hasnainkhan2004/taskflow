import { cn } from './cn';
import Spinner from './Spinner';

const variants = {
  primary: 'bg-coral text-white shadow-sm hover:bg-[#df563d] ',
  secondary: 'border border-border bg-surface text-ink hover:bg-cream ',
  ghost: 'text-muted hover:bg-cream hover:text-ink ',
  danger: 'bg-danger text-white hover:bg-[#a83031]',
};

const sizes = {
  sm: 'min-h-8 px-3 text-xs',
  md: 'min-h-10 px-4 text-sm',
  lg: 'min-h-12 px-5 text-sm',
  icon: 'size-10',
};

const Button = ({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}) => (
  <Component
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-55',
      variants[variant],
      sizes[size],
      className
    )}
    disabled={disabled || loading}
    {...props}
  >
    {loading && <Spinner className="size-4" />}
    {children}
  </Component>
);

export default Button;
