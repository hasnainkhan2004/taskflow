import { ArrowUpRight, Check, Circle, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const AuthLayout = ({ title, subtitle, children }) => (
  <div className="min-h-screen bg-cream text-ink ">
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.08fr)_minmax(460px,0.92fr)]">
      <aside className="relative hidden overflow-hidden bg-[#262b36] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -left-36 top-36 size-96 rounded-full bg-coral/20 blur-3xl" />
        <div className="absolute -bottom-48 right-0 size-[28rem] rounded-full bg-amber/10 blur-3xl" />
        <Link to="/" className="relative inline-flex items-center gap-3 text-lg font-bold tracking-tight text-white">
          <span className="flex size-10 items-center justify-center rounded-xl bg-coral font-heading text-lg">T</span>
          TaskFlow
        </Link>
        <div className="relative max-w-xl">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[#ffad8b]">A little more focus, every day</p>
          <h1 className="font-heading text-5xl font-bold leading-[1.08] tracking-tight xl:text-6xl">
            Make room for the work that matters.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/65">
            Bring your projects and next steps into one calm, clear place.
          </p>
          <div className="mt-12 max-w-md rotate-[-2deg] rounded-2xl border border-white/10 bg-white/[0.08] p-5 shadow-2xl backdrop-blur-md">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-white/45">MONDAY, OCTOBER 21</p>
                <h2 className="mt-1 font-heading text-lg font-semibold">Studio refresh</h2>
              </div>
              <span className="rounded-full bg-[#f2674a]/20 px-2.5 py-1 text-[10px] font-semibold text-[#ffad8b]">TODAY</span>
            </div>
            <div className="space-y-2.5">
              {[
                ['Review the moodboard', true],
                ['Draft the first layout', false],
                ['Share progress with the team', false],
              ].map(([label, done]) => (
                <div key={label} className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-3">
                  <span className={`flex size-4 items-center justify-center rounded-full border ${done ? 'border-[#f2674a] bg-[#f2674a]' : 'border-white/30'}`}>
                    {done && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className={`flex-1 text-xs ${done ? 'text-white/45 line-through' : 'text-white/85'}`}>{label}</span>
                  <Circle size={7} className={done ? 'text-white/20' : 'fill-[#f5a623] text-[#f5a623]'} />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-white/50">
              <span className="flex items-center gap-1"><Plus size={12} /> Add a task</span>
              <span className="flex items-center gap-1">View project <ArrowUpRight size={12} /></span>
            </div>
          </div>
        </div>
        <p className="relative text-xs text-white/40">Your next good day starts with one clear step.</p>
      </aside>

      <main className="flex min-h-screen flex-col items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
        <Link to="/" className="mb-8 inline-flex items-center gap-2.5 font-heading text-lg font-bold tracking-tight lg:hidden">
          <span className="flex size-9 items-center justify-center rounded-xl bg-coral text-white">T</span>
          TaskFlow
        </Link>
        <div className="w-full max-w-[440px] rounded-card border border-border bg-surface p-6 shadow-card sm:p-9">
          <header className="mb-7">
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>
          </header>
          {children}
        </div>
        <p className="mt-6 text-xs text-muted">Plan clearly. Get things done.</p>
      </main>
    </div>
  </div>
);

export default AuthLayout;
