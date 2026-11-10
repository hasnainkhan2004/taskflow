import { useDeferredValue, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Columns3, List, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import API from '../api/axios';
import BoardColumn from '../components/BoardColumn';
import TaskDetailModal from '../components/TaskDetailModal';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Checkbox from '../components/ui/Checkbox';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Skeleton from '../components/ui/Skeleton';
import { cn } from '../components/ui/cn';
import { useWorkspace } from '../workspaces/useWorkspace';

const readFilters = (searchParams) => ({
  q: searchParams.get('q') || '',
  status: searchParams.get('status') || '',
  priority: searchParams.get('priority') || '',
  label: searchParams.get('label') || '',
  assignee: searchParams.get('assignee') || '',
  due: searchParams.get('due') || '',
  sort: searchParams.get('sort') || 'position',
  order: searchParams.get('order') || 'asc',
  view: searchParams.get('view') === 'list' ? 'list' : 'board',
});

const EMPTY_LISTS = [];
const EMPTY_TASKS = [];
const EMPTY_LABELS = [];

const ProjectView = () => {
  const { workspaceId, projectId } = useParams();
  const { can } = useWorkspace();
  const editable = can('tasks:manage');
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const deferredSearch = useDeferredValue(filters.q);
  const [selectedTaskId, setSelectedTaskId] = useState(searchParams.get('task'));
  const [selectedTaskSnapshot, setSelectedTaskSnapshot] = useState(null);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [activeDrag, setActiveDrag] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const queryString = searchParams.toString();
  const requestParams = new URLSearchParams(queryString);
  requestParams.delete('task');
  if (deferredSearch.trim()) requestParams.set('q', deferredSearch.trim());
  else requestParams.delete('q');
  const taskQueryString = requestParams.toString();
  const taskQueryKey = ['project-tasks', workspaceId, projectId, taskQueryString];

  const projectQuery = useQuery({
    queryKey: ['project', workspaceId, projectId],
    queryFn: async () => (await API.get(`/projects/${projectId}`)).data,
  });
  const listsQuery = useQuery({
    queryKey: ['project-lists', workspaceId, projectId],
    queryFn: async () => (await API.get(`/lists/project/${projectId}`)).data,
  });
  const labelsQuery = useQuery({
    queryKey: ['project-labels', workspaceId, projectId],
    queryFn: async () => (await API.get(`/projects/${projectId}/labels`)).data,
  });
  const membersQuery = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => (await API.get(`/workspaces/${workspaceId}/members`)).data,
  });
  const memberData = membersQuery.data;
  const members = Array.isArray(memberData) ? memberData : memberData?.members || memberData?.data?.members || memberData?.data || [];
  const tasksQuery = useQuery({
    queryKey: taskQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams(taskQueryString);
      params.set('limit', '1000');
      return (await API.get(`/projects/${projectId}/tasks`, { params })).data;
    },
  });

  const project = projectQuery.data;
  const lists = listsQuery.data || EMPTY_LISTS;
  const labels = labelsQuery.data || EMPTY_LABELS;
  const tasks = tasksQuery.data?.data || EMPTY_TASKS;
  const selectedTask = tasks.find((task) => task._id === selectedTaskId) || selectedTaskSnapshot;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const refreshProjectData = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['project-tasks', workspaceId, projectId] }),
    queryClient.invalidateQueries({ queryKey: ['task-detail', workspaceId] }),
    queryClient.invalidateQueries({ queryKey: ['project-lists', workspaceId, projectId] }),
    queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] }),
  ]);
  const createList = useMutation({
    mutationFn: (title) => API.post('/lists', { title, project: projectId }),
    onSuccess: async () => {
      await refreshProjectData();
      toast.success('List created.');
      setListTitle('');
      setListDialogOpen(false);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not create list.'),
  });
  const createTask = useMutation({
    mutationFn: ({ list, title }) => API.post('/tasks', { title, list, project: projectId }),
    onSuccess: async () => {
      await refreshProjectData();
      toast.success('Task added.');
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not create task.'),
  });
  const toggleTask = useMutation({
    mutationFn: ({ task, status }) => API.patch(`/tasks/${task._id}/status`, { status }),
    onMutate: async ({ task, status }) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKey });
      const previous = queryClient.getQueryData(taskQueryKey);
      queryClient.setQueryData(taskQueryKey, (current) => current && ({
        ...current,
        data: current.data.map((item) => item._id === task._id ? { ...item, status } : item),
      }));
      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) queryClient.setQueryData(taskQueryKey, context.previous);
      toast.error(error.response?.data?.message || 'Could not update task status.');
    },
    onSettled: refreshProjectData,
  });
  const moveTask = useMutation({
    mutationFn: ({ taskId, listId, beforeTaskId, afterTaskId }) => API.patch(`/tasks/${taskId}/move`, {
      listId,
      ...(beforeTaskId ? { beforeTaskId } : {}),
      ...(afterTaskId ? { afterTaskId } : {}),
    }),
    onMutate: async ({ taskId, listId, beforeTaskId, afterTaskId }) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKey });
      const previous = queryClient.getQueryData(taskQueryKey);
      queryClient.setQueryData(taskQueryKey, (current) => {
        if (!current) return current;
        const moving = current.data.find((task) => task._id === taskId);
        if (!moving) return current;
        const nextTasks = current.data.filter((task) => task._id !== taskId);
        const destination = nextTasks
          .filter((task) => String(task.list) === String(listId))
          .sort((a, b) => a.position - b.position);
        const anchorId = beforeTaskId || afterTaskId;
        const anchorIndex = destination.findIndex((task) => task._id === anchorId);
        const insertAt = anchorIndex < 0
          ? destination.length
          : anchorIndex + (afterTaskId ? 1 : 0);
        destination.splice(insertAt, 0, { ...moving, list: listId });
        const destinationIds = new Set(destination.map((task) => task._id));
        return {
          ...current,
          data: [
            ...nextTasks.filter((task) => !destinationIds.has(task._id)),
            ...destination.map((task, index) => ({ ...task, position: index + 1 })),
          ],
        };
      });
      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) queryClient.setQueryData(taskQueryKey, context.previous);
      toast.error(error.response?.data?.message || 'Could not move task.');
    },
    onSettled: refreshProjectData,
  });
  const moveList = useMutation({
    mutationFn: ({ listId, beforeListId, afterListId }) => API.patch(`/lists/${listId}/move`, {
      ...(beforeListId ? { beforeListId } : {}),
      ...(afterListId ? { afterListId } : {}),
    }),
    onMutate: async ({ listId, beforeListId, afterListId }) => {
      const key = ['project-lists', workspaceId, projectId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (current) => {
        if (!current) return current;
        const targetId = beforeListId || afterListId;
        const moving = current.find((list) => list._id === listId);
        const next = current.filter((list) => list._id !== listId);
        const targetIndex = next.findIndex((list) => list._id === targetId);
        if (!moving) return current;
        const insertAt = targetIndex < 0
          ? next.length
          : targetIndex + (afterListId ? 1 : 0);
        next.splice(insertAt, 0, moving);
        return next;
      });
      return { previous, key };
    },
    onError: (error, variables, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
      toast.error(error.response?.data?.message || 'Could not reorder lists.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['project-lists', workspaceId, projectId] }),
  });

  const setFilter = (key, value) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || (key === 'view' && value === 'board') || (key === 'sort' && value === 'position') || (key === 'order' && value === 'asc')) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      return next;
    }, { replace: true });
  };
  const clearFilters = () => {
    setSearchParams(filters.view === 'list' ? { view: 'list' } : {}, { replace: true });
  };

  const tasksByList = useMemo(() => {
    const result = new Map(lists.map((list) => [list._id, []]));
    tasks.forEach((task) => {
      const listId = String(task.list?._id || task.list);
      if (result.has(listId)) result.get(listId).push(task);
    });
    return result;
  }, [lists, tasks]);

  const handleDragStart = ({ active }) => {
    setActiveDrag(active.data.current);
  };
  const handleDragEnd = async ({ active, over, delta }) => {
    setActiveDrag(null);
    if (!editable) return;
    if (!over || active.id === over.id) return;
    const activeData = active.data.current;
    const overData = over.data.current || {};
    if (activeData?.type === 'task') {
      const task = activeData.task;
      const targetListId = String(overData.listId || (overData.type === 'column' ? over.id : ''));
      if (!targetListId) return;
      let beforeTaskId;
      let afterTaskId;
      if (overData.type === 'task') {
        const overRect = over.rect;
        const initial = active.rect.current.initial;
        const center = initial ? initial.top + delta.y + initial.height / 2 : overRect.top;
        if (center > overRect.top + overRect.height / 2) afterTaskId = String(over.id);
        else beforeTaskId = String(over.id);
      } else {
        const targetTasks = (tasksByList.get(targetListId) || [])
          .filter((targetTask) => targetTask._id !== task._id);
        if (targetTasks.length) afterTaskId = targetTasks[targetTasks.length - 1]._id;
      }
      try {
        await moveTask.mutateAsync({
          taskId: task._id,
          listId: targetListId,
          beforeTaskId,
          afterTaskId,
        });
      } catch {
        // The mutation reports errors and restores its optimistic snapshot.
      }
      return;
    }
    if (activeData?.type === 'list') {
      const fromId = String(activeData.listId);
      const toId = String(overData.listId || String(over.id).replace(/^list:/, ''));
      if (!toId || fromId === toId) return;
      const withoutActive = lists.filter((list) => list._id !== fromId);
      const targetIndex = withoutActive.findIndex((list) => list._id === toId);
      if (targetIndex < 0) return;
      const target = withoutActive[targetIndex];
      const initial = active.rect.current.initial;
      const center = initial ? initial.left + delta.x + initial.width / 2 : over.rect.left;
      const afterTarget = center > over.rect.left + over.rect.width / 2;
      const beforeListId = afterTarget ? undefined : target._id;
      const afterListId = afterTarget ? target._id : undefined;
      try {
        await moveList.mutateAsync({ listId: fromId, beforeListId, afterListId });
      } catch {
        // The mutation reports errors and restores its optimistic snapshot.
      }
    }
  };
  const handleCreateList = (event) => {
    event.preventDefault();
    if (listTitle.trim()) createList.mutate(listTitle.trim());
  };
  const activeTask = activeDrag?.task;
  const isLoading = projectQuery.isLoading || listsQuery.isLoading || tasksQuery.isLoading || labelsQuery.isLoading;
  const queryError = projectQuery.error || listsQuery.error || tasksQuery.error || labelsQuery.error;
  const hasFilters = Boolean(filters.q || filters.status || filters.priority || filters.label || filters.due || filters.assignee);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-[420px] min-w-[300px] rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (queryError) {
    return (
      <EmptyState
        title="This project could not be loaded"
        description={queryError.response?.data?.message || 'Check your connection and try again.'}
        action={<Button onClick={() => queryClient.invalidateQueries({ queryKey: ['project', workspaceId, projectId] })}>Try again</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to={`/w/${workspaceId}/dashboard`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-coral">
            <ArrowLeft size={14} /> All projects
          </Link>
          <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight sm:text-3xl">{project?.title || 'Project'}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{project?.description || 'A clear place for the work ahead.'}</p>
        </div>
        {editable && <Button onClick={() => setListDialogOpen(true)}><Plus size={16} /> New list</Button>}
      </div>

      <section className="rounded-2xl border border-border bg-surface p-3 shadow-sm sm:p-4" aria-label="Task filters">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-3 text-muted" />
            <Input className="pl-9" aria-label="Search tasks" placeholder="Search tasks..." value={filters.q} onChange={(event) => setFilter('q', event.target.value)} />
          </label>
          <Button variant="secondary" onClick={() => setShowFilters((current) => !current)} aria-expanded={showFilters}>
            <SlidersHorizontal size={15} /> Filters
            {hasFilters && <span className="size-2 rounded-full bg-coral" />}
          </Button>
          <div className="flex rounded-lg border border-border p-1" aria-label="View mode">
            <button type="button" className={cn('rounded-md p-2 text-muted transition hover:text-ink', filters.view === 'board' && 'bg-cream text-ink ')} aria-label="Board view" aria-pressed={filters.view === 'board'} onClick={() => setFilter('view', 'board')}><Columns3 size={16} /></button>
            <button type="button" className={cn('rounded-md p-2 text-muted transition hover:text-ink', filters.view === 'list' && 'bg-cream text-ink ')} aria-label="List view" aria-pressed={filters.view === 'list'} onClick={() => setFilter('view', 'list')}><List size={16} /></button>
          </div>
          {(hasFilters || filters.sort !== 'position' || filters.order !== 'asc') && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-muted hover:text-coral">
              <X size={14} /> Clear
            </button>
          )}
        </div>
        {showFilters && (
          <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-5">
            <select aria-label="Filter by status" className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
              <option value="">All statuses</option><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option>
            </select>
            <select aria-label="Filter by priority" className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink" value={filters.priority} onChange={(event) => setFilter('priority', event.target.value)}>
              <option value="">All priorities</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
            </select>
            <select aria-label="Filter by due date" className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink" value={filters.due} onChange={(event) => setFilter('due', event.target.value)}>
              <option value="">Any due date</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="week">Due this week</option><option value="none">No due date</option>
            </select>
            <select aria-label="Filter by label" className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink" value={filters.label} onChange={(event) => setFilter('label', event.target.value)}>
              <option value="">All labels</option>{labels.map((label) => <option key={label._id} value={label._id}>{label.name}</option>)}
            </select>
            <select aria-label="Filter by assignee" className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink" value={filters.assignee} onChange={(event) => setFilter('assignee', event.target.value)}>
              <option value="">All assignees</option>{members.map((member) => { const person = member.user || member; const id = person._id || person.id || member._id; return <option key={id} value={id}>{person.username || person.name || person.email || 'Member'}</option>; })}
            </select>
            <select aria-label="Sort tasks" className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink" value={`${filters.sort}:${filters.order}`} onChange={(event) => {
              const [sort, order] = event.target.value.split(':');
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                if (sort === 'position' && order === 'asc') {
                  next.delete('sort');
                  next.delete('order');
                } else {
                  next.set('sort', sort);
                  next.set('order', order);
                }
                return next;
              }, { replace: true });
            }}>
              <option value="position:asc">List order</option><option value="dueDate:asc">Due date (soonest)</option><option value="dueDate:desc">Due date (latest)</option><option value="priority:asc">Priority (high first)</option><option value="priority:desc">Priority (low first)</option><option value="createdAt:desc">Recently created</option><option value="createdAt:asc">Oldest created</option>
            </select>
          </div>
        )}
      </section>

      {tasksQuery.isError ? (
        <EmptyState title="Tasks could not be loaded" description={tasksQuery.error.response?.data?.message || 'Try refreshing the board.'} action={<Button onClick={() => tasksQuery.refetch()}>Retry</Button>} />
      ) : lists.length === 0 ? (
        <EmptyState
          title="Start with a list"
          description={editable ? 'Lists give your tasks a home. Create one to start shaping this project.' : 'This project does not have any lists yet.'}
          action={editable && <Button onClick={() => setListDialogOpen(true)}><Plus size={16} /> Create first list</Button>}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDrag(null)}
        >
          {filters.view === 'board' ? (
            <div className="overflow-x-auto pb-4">
              <SortableContext items={lists.map((list) => `list:${list._id}`)} strategy={horizontalListSortingStrategy}>
                <div className="flex min-h-[370px] items-start gap-3">
                  {lists.map((list, index) => (
                    <BoardColumn
                      key={list._id}
                      list={list}
                      tasks={tasksByList.get(list._id) || []}
                      draggableTasks={editable && filters.sort === 'position'}
                      loading={tasksQuery.isLoading}
                      onCreateTask={(listId, title) => createTask.mutateAsync({ list: listId, title })}
                      onOpenTask={(task) => {
                        setSelectedTaskId(task._id);
                        setSelectedTaskSnapshot(task);
                      }}
                      onToggleTask={(task) => toggleTask.mutate({ task, status: task.status === 'done' ? 'todo' : 'done' })}
                      onAddList={() => setListDialogOpen(true)}
                      isLastList={index === lists.length - 1}
                      editable={editable}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="hidden grid-cols-[minmax(0,1fr)_140px_130px_120px] gap-3 border-b border-border bg-cream/60 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted sm:grid ">
                <span>Task</span><span>List</span><span>Priority</span><span>Status</span>
              </div>
              {tasks.length ? tasks.map((task) => (
                <div key={task._id} className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_140px_130px_120px] sm:items-center sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    {editable && <Checkbox checked={task.status === 'done'} label={`${task.status === 'done' ? 'Reopen' : 'Complete'} ${task.title}`} onChange={() => toggleTask.mutate({ task, status: task.status === 'done' ? 'todo' : 'done' })} />}
                    <button type="button" className={`truncate text-left text-sm font-semibold hover:text-coral ${task.status === 'done' ? 'text-muted line-through' : 'text-ink'}`} onClick={() => {
                      setSelectedTaskId(task._id);
                      setSelectedTaskSnapshot(task);
                    }}>{task.title}</button>
                  </div>
                  <span className="truncate text-xs text-muted">{lists.find((list) => list._id === String(task.list))?.title || 'List'}</span>
                  <span><Badge tone={task.priority}>{task.priority}</Badge></span>
                  <span><Badge tone={task.status}>{task.status.replace('_', ' ')}</Badge></span>
                </div>
              )) : (
                <EmptyState title="No tasks match" description="Try changing the filters or add a new task." />
              )}
            </div>
          )}
          <DragOverlay>
            {activeTask ? <div className="w-[min(84vw,320px)] rotate-2 rounded-xl border border-coral/40 bg-surface p-4 text-sm font-semibold shadow-xl">{activeTask.title}</div> : null}
            {activeDrag?.type === 'list' ? <div className="rounded-xl border border-coral/40 bg-surface px-6 py-4 font-heading font-bold shadow-xl">{lists.find((list) => list._id === activeDrag.listId)?.title}</div> : null}
          </DragOverlay>
        </DndContext>
      )}

      {tasksQuery.data?.total > tasks.length && (
        <p className="text-center text-xs text-muted">Showing {tasks.length} of {tasksQuery.data.total} tasks. Add filters to narrow your view.</p>
      )}

      {selectedTaskId && selectedTask && (
        <TaskDetailModal
          key={selectedTaskId}
          initialTask={selectedTask}
          projectId={projectId}
          lists={lists}
          labels={labels}
          workspaceId={workspaceId}
          readOnly={!editable}
          onClose={() => {
            setSelectedTaskId(null);
            setSelectedTaskSnapshot(null);
            setSearchParams((current) => { const next = new URLSearchParams(current); next.delete('task'); return next; }, { replace: true });
          }}
        />
      )}
      <Modal
        open={listDialogOpen}
        onClose={() => setListDialogOpen(false)}
        title="Create a list"
        description="Give this group of tasks a clear name."
        className="max-w-md"
      >
        <form className="space-y-4" onSubmit={handleCreateList}>
          <Input autoFocus aria-label="List name" placeholder="For example, In progress" value={listTitle} onChange={(event) => setListTitle(event.target.value)} maxLength={80} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setListDialogOpen(false)}>Cancel</Button>
            <Button type="submit" loading={createList.isPending} disabled={!listTitle.trim()}><Plus size={16} /> Create list</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProjectView;
