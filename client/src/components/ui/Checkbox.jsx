import { Check } from 'lucide-react';

const Checkbox = ({ checked, onChange, label, className = '' }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition focus-visible:outline-none ${checked ? 'border-coral bg-coral text-white' : 'border-border bg-surface text-transparent hover:border-coral'} ${className}`}
  >
    <Check size={13} strokeWidth={3} />
  </button>
);

export default Checkbox;
