import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import API from '../api/axios';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import { useWorkspace } from '../workspaces/useWorkspace';
import { nextPageParam } from '../api/workspaceContracts';

const groupLabel = (date) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Earlier';
  const today = new Date();
  if (parsed.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (parsed.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return parsed.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
};

const WorkspaceActivity = () => {
  const { workspaceId } = useWorkspace();
  const [type, setType] = useState('');
  const [actor, setActor] = useState('');
  const query = useInfiniteQuery({
    queryKey: ['workspace-activity', workspaceId, type, actor],
    queryFn: async ({ pageParam }) => (await API.get(`/workspaces/${workspaceId}/activity`, { params: { limit: 30, ...(type && { type }), ...(actor && { actor }), ...(pageParam && (typeof pageParam === 'number' ? { page: pageParam } : { cursor: pageParam })) } })).data,
    initialPageParam: undefined,
    getNextPageParam: nextPageParam,
  });
  const events = (query.data?.pages || []).flatMap((page) => {
    let items = page?.activity || page?.events || page?.data || [];
    if (!Array.isArray(items)) items = items?.activity || items?.events || items?.data || [];
    return Array.isArray(items) ? items : [];
  });
  const groups = events.reduce((result, event) => {
    const label = groupLabel(event.createdAt || event.timestamp || event.date);
    result[label] ||= [];
    result[label].push(event);
    return result;
  }, {});
  return <div className="space-y-7">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-coral">Workspace</p><h1 className="mt-2 font-heading text-3xl font-bold">Activity</h1><p className="mt-1 text-sm text-muted">A shared timeline of recent work.</p></div><div className="flex gap-2"><select aria-label="Filter activity type" className="min-h-10 rounded-lg border border-border bg-surface px-3" value={type} onChange={(event) => setType(event.target.value)}><option value="">All activity</option><option value="task">Tasks</option><option value="project">Projects</option><option value="member">Members</option><option value="workspace">Workspace</option></select><input aria-label="Filter by actor" className="min-h-10 w-36 rounded-lg border border-border bg-surface px-3 sm:w-48" placeholder="Actor name" value={actor} onChange={(event) => setActor(event.target.value)} /></div></header>
    {query.isLoading ? <div className="space-y-3">{Array.from({ length: 4 }, (_, index) => <Skeleton className="h-20 rounded-xl" key={index} />)}</div> : query.isError ? <Card className="p-6 text-sm text-danger">Activity couldn’t load. Please try again.</Card> : Object.keys(groups).length === 0 ? <Card className="p-8 text-center text-sm text-muted">No activity matches these filters.</Card> : <div className="space-y-7">{Object.entries(groups).map(([label, items]) => <section key={label}><h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{label}</h2><Card className="divide-y divide-border">{items.map((event) => { const name = event.actor?.username || event.actor?.name || event.user?.username || 'A member'; const text = event.description || event.message || event.action || 'updated the workspace'; return <div className="flex items-start gap-3 p-4" key={event._id || `${event.createdAt}-${text}`}><Avatar name={name} className="size-8" /><div className="min-w-0 flex-1"><p className="text-sm"><span className="font-semibold">{name}</span> {text}</p>{(event.task?.title || event.project?.title) && <p className="mt-1 truncate text-sm font-medium text-coral">{event.task?.title || event.project?.title}</p>}<time className="mt-1 block text-xs text-muted" dateTime={event.createdAt || event.timestamp}>{new Date(event.createdAt || event.timestamp || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div></div>; })}</Card></section>)}</div>}
    {query.hasNextPage && <div className="text-center"><Button variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>Load more</Button></div>}
  </div>;
};

export default WorkspaceActivity;
