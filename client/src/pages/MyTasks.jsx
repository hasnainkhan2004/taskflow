import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import API from '../api/axios';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import { useWorkspace } from '../workspaces/useWorkspace';
import { extractTaskGroups } from '../workspaces/myTaskGroups';

const taskDate = (task) => task.dueDate ? new Date(task.dueDate) : null;

const MyTasks = () => {
  const { workspaceId, can } = useWorkspace();
  const [filter, setFilter] = useState('all');
  const query = useQuery({ queryKey: ['my-tasks', workspaceId], queryFn: async () => (await API.get(`/workspaces/${workspaceId}/my-tasks`)).data });
  const grouped = useMemo(() => extractTaskGroups(query.data), [query.data]);
  const sections = filter === 'all' ? grouped : grouped.filter(([label]) => label === filter);
  return <div className="space-y-7">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-coral">Your work</p><h1 className="mt-2 font-heading text-3xl font-bold">My tasks</h1><p className="mt-1 text-sm text-muted">Your assigned work across this workspace.</p></div><select aria-label="Filter my tasks" className="min-h-10 rounded-lg border border-border bg-surface px-3" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All sections</option>{grouped.map(([label]) => <option key={label} value={label}>{label}</option>)}</select></header>
    {!can('tasks:manage') && <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">You have read-only access. Task changes are disabled for your role.</p>}
    {query.isLoading ? <p className="py-8 text-center text-sm text-muted">Loading your tasks…</p> : query.isError ? <Card className="p-6 text-sm text-danger">Your tasks couldn’t load.</Card> : <div className="space-y-6">{sections.map(([label, items]) => <section key={label}><h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold"><CalendarDays size={18} />{label}<span className="text-sm font-normal text-muted">{items.length}</span></h2>{items.length ? <div className="grid gap-3 md:grid-cols-2">{items.map((task) => { const projectId = task.project?._id || task.projectId || task.project; const id = task._id || task.id; return         <Card className="flex items-start justify-between gap-3 p-4" key={id}><div className="min-w-0">{projectId ? <Link className="font-semibold hover:text-coral" to={`/w/${workspaceId}/projects/${projectId}?task=${id}`}>{task.title || 'Untitled task'}</Link> : <p className="font-semibold">{task.title || 'Untitled task'}</p>}<p className="mt-1 truncate text-xs text-muted">{task.project?.title || task.projectTitle || 'Project'}{task.list?.title ? ` · ${task.list.title}` : ''}</p><div className="mt-3 flex flex-wrap items-center gap-2"><Badge>{task.priority || 'Normal'}</Badge>{taskDate(task) && <span className="text-xs text-muted">Due {taskDate(task).toLocaleDateString()}</span>}</div></div>{(task.assignees || (task.assignee ? [task.assignee] : [])).slice(0, 3).map((person) => <Avatar key={person._id || person.id || person.username} name={person.username || person.name || person.email || 'Member'} className="size-8" />)}</Card>; })}</div> : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">Nothing here right now.</p>}</section>)}</div>}
  </div>;
};

export default MyTasks;
