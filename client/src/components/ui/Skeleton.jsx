import { cn } from './cn';

const Skeleton = ({ className, ...props }) => (
  <div
    className={cn('animate-pulse rounded-lg bg-border/70 ', className)}
    aria-hidden="true"
    {...props}
  />
);

export default Skeleton;
