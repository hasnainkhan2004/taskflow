import { cn } from './cn';

const Card = ({ className, ...props }) => (
  <section
    className={cn('rounded-card border border-border bg-surface shadow-card', className)}
    {...props}
  />
);

export default Card;
