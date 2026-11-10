const Avatar = ({ name = 'TaskFlow', className = '' }) => (
  <span
    className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f8d7ce] text-xs font-bold text-[#8a3829]   ${className}`}
    aria-label={name}
  >
    {name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
  </span>
);

export default Avatar;
