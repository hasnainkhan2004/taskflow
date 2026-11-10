import { ClipboardList } from 'lucide-react';

const EmptyState = ({ icon: Icon = ClipboardList, title, description, action }) => (
  <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/70 px-6 py-10 text-center">
    <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-[#fff0e8] text-coral ">
      <Icon size={22} />
    </span>
    <h3 className="font-heading text-base font-bold text-ink">{title}</h3>
    {description && <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
