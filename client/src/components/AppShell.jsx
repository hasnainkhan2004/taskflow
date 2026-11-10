import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, LayoutDashboard, Menu, Settings, Users, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AuthContext } from '../context/authContext';
import { useContext } from 'react';
import API from '../api/axios';
import Avatar from './ui/Avatar';
import Button from './ui/Button';
import { useWorkspace } from '../workspaces/useWorkspace';
import Modal from './ui/Modal';
import Input from './ui/Input';

const AppShell = () => {
  const { user, logout } = useContext(AuthContext);
  const { workspaceId, workspace, workspaces, isLoading, isError } = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createWorkspace = useMutation({
    mutationFn: () => API.post('/workspaces', { name: workspaceName.trim() }),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      const created = data.workspace || data;
      const id = created._id || created.id;
      if (id) navigate(`/w/${id}/dashboard`);
      setWorkspaceName('');
      setCreateOpen(false);
      toast.success('Workspace created.');
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not create workspace.'),
  });
  const previousWorkspace = useRef(workspaceId);
  useEffect(() => {
    if (!workspaceId || workspaceId === previousWorkspace.current) return;
    const oldId = previousWorkspace.current;
    if (oldId) {
      const workspaceScopedKeys = new Set(['workspace', 'projects', 'project', 'project-lists', 'project-labels', 'project-tasks', 'task-detail', 'task-comments', 'task-activity', 'my-tasks', 'workspace-members', 'workspace-invitations', 'workspace-activity']);
      queryClient.removeQueries({
        predicate: (query) => workspaceScopedKeys.has(query.queryKey[0]) && String(query.queryKey[1]) === String(oldId),
      });
    }
    previousWorkspace.current = workspaceId;
    window.localStorage.setItem('taskflow.lastWorkspaceId', workspaceId);
  }, [workspaceId, queryClient]);
  useEffect(() => {
    if (isError || (!isLoading && !workspace)) navigate('/', { replace: true });
  }, [isError, isLoading, workspace, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('You have signed out.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not sign out. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-cream text-ink ">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-black/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[72px] items-center justify-between border-b border-border px-6">
          <Link to={`/w/${workspaceId}/dashboard`} className="inline-flex items-center gap-3 font-heading text-lg font-bold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-xl bg-coral text-white">T</span>
            TaskFlow
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-muted hover:bg-cream lg:hidden "
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-4 pt-5">
          <label htmlFor="workspace-switcher" className="mb-2 block px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Workspace</label>
          <select id="workspace-switcher" className="min-h-11 w-full rounded-xl border border-border bg-cream px-3 text-sm font-semibold text-ink " value={workspaceId || ''} onChange={(event) => {
            navigate(`/w/${event.target.value}/dashboard`);
            setSidebarOpen(false);
          }}>
            {workspaces.map((item) => <option key={item._id || item.id} value={item._id || item.id}>{item.name || item.title || 'Workspace'}</option>)}
          </select>
          <button type="button" className="mt-2 min-h-9 w-full rounded-lg px-3 text-left text-xs font-semibold text-coral transition hover:bg-cream " onClick={() => setCreateOpen(true)}>+ Create a workspace</button>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-5" aria-label="Main navigation">
          <NavLink
            to={`/w/${workspaceId}/dashboard`}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${isActive ? 'bg-[#fff0e8] text-[#a84931]  ' : 'text-muted hover:bg-cream hover:text-ink '}`}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>
          {[
            [`/w/${workspaceId}/my-tasks`, 'My tasks', '✓'],
            [`/w/${workspaceId}/members`, 'Members', <Users size={18} key="members" />],
            [`/w/${workspaceId}/activity`, 'Activity', <Activity size={18} key="activity" />],
            [`/w/${workspaceId}/settings`, 'Settings', <Settings size={18} key="settings" />],
          ].map(([to, label, icon]) => <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${isActive ? 'bg-[#fff0e8] text-[#a84931]  ' : 'text-muted hover:bg-cream hover:text-ink '}`}><span className="inline-flex w-[18px] justify-center">{icon}</span>{label}</NavLink>)}
        </nav>
        <div className="m-4 rounded-2xl border border-border bg-cream/70 p-4 ">
          <p className="font-heading text-sm font-bold">{workspace?.name || workspace?.title || 'Your workspace'}</p>
          <p className="mt-1 text-xs leading-5 capitalize text-muted">{workspace?.role || workspace?.membership?.role || 'workspace'} access</p>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur-md sm:px-7">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation menu"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={19} />
            </Button>
            <p className="hidden text-sm text-muted sm:block">A calmer way to get things done</p>
          </div>
          <div className="flex items-center gap-2">
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full p-1.5 pr-2.5 transition hover:bg-cream ">
                <Avatar name={user?.username} />
                <span className="hidden max-w-32 truncate text-sm font-semibold sm:block">{user?.username}</span>
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-border bg-surface p-3 shadow-card">
                <p className="truncate text-sm font-semibold">{user?.username}</p>
                <p className="mt-1 truncate text-xs text-muted">{user?.email}</p>
                <Button variant="secondary" className="mt-3 w-full" onClick={handleLogout}>Sign out</Button>
              </div>
            </details>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-7 sm:py-9">
          <Outlet />
        </main>
      </div>
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a workspace" description="Give your team a shared place to plan work." className="max-w-md">
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createWorkspace.mutate(); }}>
          <label className="block space-y-2 text-sm font-semibold">Workspace name<Input autoFocus required maxLength={80} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Studio team" /></label>
          <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" loading={createWorkspace.isPending} disabled={!workspaceName.trim()}>Create workspace</Button></div>
        </form>
      </Modal>
    </div>
  );
};

export default AppShell;
