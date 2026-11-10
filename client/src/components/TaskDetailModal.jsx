import { useState } from 'react';
import { useMutation, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import API from '../api/axios';
import Badge from './ui/Badge';
import Button from './ui/Button';
import ConfirmDialog from './ui/ConfirmDialog';
import Input from './ui/Input';
import Modal from './ui/Modal';
import Textarea from './ui/Textarea';
import Avatar from './ui/Avatar';
import { useContext } from 'react';
import { AuthContext } from '../context/authContext';
import { commentPayload, nextPageParam } from '../api/workspaceContracts';

const LABEL_COLORS = ['#64748b', '#3b82f6', '#14b8a6', '#22c55e', '#f59e0b', '#f2674a', '#ef4444', '#a855f7'];
const arrayFrom = (data) => {
  if (Array.isArray(data)) return data;
  const nested = data?.comments || data?.members || data?.events || data?.activity || data?.data || [];
  return Array.isArray(nested) ? nested : arrayFrom(nested);
};

const asDateInput = (date) => {
  if (!date) return '';
  const parsed = new Date(date);
  const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const TaskDetailModal = ({ initialTask, projectId, lists, labels, workspaceId, readOnly = false, onClose }) => {
  const queryClient = useQueryClient();
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('details');
  const [commentText, setCommentText] = useState('');
  const [editingComment, setEditingComment] = useState(null);
  const [assigneeIds, setAssigneeIds] = useState((initialTask.assignees || (initialTask.assignee ? [initialTask.assignee] : [])).map((person) => String(person._id || person.user?._id || person)));
  const taskQuery = useQuery({
    queryKey: ['task-detail', workspaceId, initialTask._id],
    queryFn: async () => (await API.get(`/tasks/${initialTask._id}`)).data,
  });
  const task = taskQuery.data || initialTask;
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'todo');
  const [priority, setPriority] = useState(task?.priority || 'Medium');
  const [listId, setListId] = useState(task?.list || '');
  const [dueDate, setDueDate] = useState(asDateInput(task?.dueDate));
  const [selectedLabels, setSelectedLabels] = useState((task?.labels || []).map((label) => label._id || label));
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['project-tasks', workspaceId, projectId] }),
    queryClient.invalidateQueries({ queryKey: ['task-detail', workspaceId, task._id] }),
    queryClient.invalidateQueries({ queryKey: ['project-labels', workspaceId, projectId] }),
    queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] }),
  ]);
  const saveTask = useMutation({
    mutationFn: () => API.put(`/tasks/${task._id}`, {
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      list: listId,
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
      labels: selectedLabels,
    }),
    onSuccess: async () => {
      await refresh();
      toast.success('Task updated.');
    },
    onError: (saveError) => setError(saveError.response?.data?.message || 'Could not save this task.'),
  });
  const addSubtask = useMutation({
    mutationFn: (subtask) => API.post(`/tasks/${task._id}/subtasks`, { title: subtask }),
    onSuccess: async () => {
      setSubtaskTitle('');
      await refresh();
    },
    onError: (subtaskError) => toast.error(subtaskError.response?.data?.message || 'Could not add subtask.'),
  });
  const updateSubtask = useMutation({
    mutationFn: ({ subtask, patch }) => API.patch(`/tasks/${task._id}/subtasks/${subtask._id}`, patch),
    onSuccess: refresh,
    onError: (subtaskError) => toast.error(subtaskError.response?.data?.message || 'Could not update subtask.'),
  });
  const deleteSubtask = useMutation({
    mutationFn: (subtaskId) => API.delete(`/tasks/${task._id}/subtasks/${subtaskId}`),
    onSuccess: refresh,
    onError: (subtaskError) => toast.error(subtaskError.response?.data?.message || 'Could not remove subtask.'),
  });
  const createLabel = useMutation({
    mutationFn: (name) => API.post(`/projects/${projectId}/labels`, {
      name,
      color: LABEL_COLORS[(labels?.length || 0) % LABEL_COLORS.length],
    }),
    onSuccess: async ({ data }) => {
      setSelectedLabels((current) => [...current, data._id]);
      setNewLabel('');
      await queryClient.invalidateQueries({ queryKey: ['project-labels', workspaceId, projectId] });
    },
    onError: (labelError) => setError(labelError.response?.data?.message || 'Could not create label.'),
  });
  const removeTask = useMutation({
    mutationFn: () => API.delete(`/tasks/${task._id}`),
    onSuccess: async () => {
      await refresh();
      toast.success('Task deleted.');
      onClose();
    },
    onError: (deleteError) => {
      setError(deleteError.response?.data?.message || 'Could not delete this task.');
      setConfirmDelete(false);
    },
  });
  const membersQuery = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => (await API.get(`/workspaces/${workspaceId}/members`)).data,
  });
  const members = arrayFrom(membersQuery.data);
  const assigneeMutation = useMutation({
    mutationFn: (ids) => API.patch(`/tasks/${task._id}/assignees`, { assignees: ids }),
    onSuccess: refresh,
    onError: (error) => toast.error(error.response?.data?.message || 'Could not update assignees.'),
  });
  const commentsQuery = useInfiniteQuery({
    queryKey: ['task-comments', workspaceId, task._id],
    queryFn: async ({ pageParam }) => (await API.get(`/tasks/${task._id}/comments`, { params: { limit: 20, ...(pageParam && (typeof pageParam === 'number' ? { page: pageParam } : { cursor: pageParam })) } })).data,
    initialPageParam: undefined,
    getNextPageParam: nextPageParam,
    enabled: activeTab === 'comments',
  });
  const comments = (commentsQuery.data?.pages || []).flatMap(arrayFrom);
  const activityQuery = useInfiniteQuery({
    queryKey: ['task-activity', workspaceId, task._id],
    queryFn: async ({ pageParam }) => (await API.get(`/tasks/${task._id}/activity`, { params: { limit: 20, ...(pageParam && (typeof pageParam === 'number' ? { page: pageParam } : { cursor: pageParam })) } })).data,
    initialPageParam: undefined,
    getNextPageParam: nextPageParam,
    enabled: activeTab === 'activity',
  });
  const commentMutation = useMutation({
    mutationFn: ({ commentId, text }) => commentId
      ? API.patch(`/comments/${commentId}`, commentPayload(text))
      : API.post(`/tasks/${task._id}/comments`, commentPayload(text)),
    onSuccess: async () => {
      setCommentText('');
      setEditingComment(null);
      await queryClient.invalidateQueries({ queryKey: ['task-comments', workspaceId, task._id] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not save comment.'),
  });
  const activity = (activityQuery.data?.pages || []).flatMap(arrayFrom);
  const deleteComment = useMutation({
    mutationFn: (commentId) => API.delete(`/comments/${commentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-comments', workspaceId, task._id] }),
    onError: (error) => toast.error(error.response?.data?.message || 'Could not delete comment.'),
  });

  const submitTask = (event) => {
    event.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    saveTask.mutate();
  };
  const handleAddSubtask = () => {
    if (subtaskTitle.trim()) addSubtask.mutate(subtaskTitle.trim());
  };
  const handleCreateLabel = () => {
    if (newLabel.trim()) createLabel.mutate(newLabel.trim());
  };
  const toggleLabel = (labelId) => {
    setSelectedLabels((current) => current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId]);
  };

  if (!task) return null;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Task details"
        description="Keep the details, deadline, and next steps together."
        className="max-w-2xl"
      >
        <div className="mb-5 flex gap-1 border-b border-border" role="tablist" aria-label="Task detail sections">
          {[['details', 'Details', null], ['comments', 'Comments', MessageCircle], ['activity', 'Activity', null]].map(([tab, label, Icon]) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold ${activeTab === tab ? 'border-coral text-coral' : 'border-transparent text-muted hover:text-ink'}`}>{Icon && <Icon size={15} />}{label}</button>)}
        </div>
        {activeTab === 'details' ? <form className="space-y-5" onSubmit={submitTask}>
          <div className="space-y-2">
            <label htmlFor="task-title" className="text-xs font-bold uppercase tracking-wide text-muted">Title</label>
            <Input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <label htmlFor="task-description" className="text-xs font-bold uppercase tracking-wide text-muted">Description</label>
            <Textarea id="task-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={10000} placeholder="Add a little context..." disabled={readOnly} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-xs font-bold uppercase tracking-wide text-muted">
              Status
              <select disabled={readOnly} className="min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-medium normal-case text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/15" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>
            <label className="space-y-2 text-xs font-bold uppercase tracking-wide text-muted">
              Priority
              <select disabled={readOnly} className="min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-medium normal-case text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/15" value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </label>
            <label className="space-y-2 text-xs font-bold uppercase tracking-wide text-muted">
              List
              <select disabled={readOnly} className="min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-medium normal-case text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/15" value={listId} onChange={(event) => setListId(event.target.value)}>
                {lists.map((list) => <option key={list._id} value={list._id}>{list.title}</option>)}
              </select>
            </label>
            <label htmlFor="task-due-date" className="space-y-2 text-xs font-bold uppercase tracking-wide text-muted">
              Due date
              <span className="relative block">
                <CalendarDays size={16} className="pointer-events-none absolute left-3 top-3 text-muted" />
                <Input id="task-due-date" type="date" className="pl-9" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={readOnly} />
              </span>
            </label>
          </div>

          <section className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Assignees</p>
            <div className="flex items-center gap-2">
              {assigneeIds.map((id) => {
                const item = members.find((member) => String(member.user?._id || member._id || member.id) === id);
                const person = item?.user || item;
                return person && <Avatar key={id} name={person.username || person.name || person.email || 'Member'} />;
              })}
              {!assigneeIds.length && <span className="text-xs text-muted">Unassigned</span>}
            </div>
            <select
              aria-label="Assign task to workspace members"
              multiple
              disabled={readOnly || membersQuery.isLoading}
              className="min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              value={assigneeIds}
              onChange={(event) => {
                const next = Array.from(event.target.selectedOptions, (option) => option.value);
                setAssigneeIds(next);
                assigneeMutation.mutate(next);
              }}
            >
              {members.map((member) => {
                const person = member.user || member;
                const id = String(person._id || person.id || member._id);
                return <option key={id} value={id}>{person.username || person.name || person.email || 'Member'}</option>;
              })}
            </select>
            <p className="text-[11px] text-muted">Use Ctrl or Command to select multiple people.</p>
          </section>

          <section className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Labels</div>
            <div className="flex flex-wrap gap-2">
              {(labels || []).map((label) => {
                const checked = selectedLabels.includes(label._id);
                return (
                  <button
                    type="button"
                    key={label._id}
                    onClick={() => toggleLabel(label._id)}
                    disabled={readOnly}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${checked ? 'border-transparent' : 'border-border opacity-65'}`}
                    style={{ backgroundColor: `${label.color}20`, color: label.color }}
                    aria-pressed={checked}
                  >
                    {checked && <Check size={12} />}{label.name}
                  </button>
                );
              })}
              {!labels?.length && <span className="text-xs text-muted">Create a label to start organizing.</span>}
            </div>
            {!readOnly && <div className="flex gap-2">
              <Input
                aria-label="New label name"
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleCreateLabel();
                  }
                }}
                placeholder="Create a label"
                maxLength={30}
              />
              <Button type="button" variant="secondary" onClick={handleCreateLabel} loading={createLabel.isPending} disabled={!newLabel.trim()}><Plus size={15} /> Label</Button>
            </div>}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wide text-muted">Subtasks</div>
              <Badge tone={task.subtasks?.every((subtask) => subtask.done) ? 'done' : 'todo'}>
                {task.subtasks?.filter((subtask) => subtask.done).length || 0}/{task.subtasks?.length || 0} complete
              </Badge>
            </div>
            <div className="space-y-2">
              {(task.subtasks || []).map((subtask) => (
                <div key={subtask._id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-[#f2674a]"
                    disabled={readOnly}
                    checked={subtask.done}
                    onChange={() => updateSubtask.mutate({ subtask, patch: { done: !subtask.done } })}
                    aria-label={`Mark ${subtask.title} ${subtask.done ? 'incomplete' : 'complete'}`}
                  />
                  <span className={`min-w-0 flex-1 text-sm ${subtask.done ? 'text-muted line-through' : 'text-ink'}`}>{subtask.title}</span>
                  {!readOnly && <button type="button" className="rounded p-1.5 text-muted hover:bg-cream hover:text-danger" aria-label={`Delete ${subtask.title}`} onClick={() => deleteSubtask.mutate(subtask._id)}>
                    <Trash2 size={14} />
                  </button>}
                </div>
              ))}
            </div>
            {!readOnly && <div className="flex gap-2">
              <Input
                aria-label="New subtask"
                value={subtaskTitle}
                onChange={(event) => setSubtaskTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="Add a next step..."
                maxLength={200}
              />
              <Button type="button" size="icon" aria-label="Add subtask" onClick={handleAddSubtask} loading={addSubtask.isPending} disabled={!subtaskTitle.trim()}><Plus size={17} /></Button>
            </div>}
          </section>

          {taskQuery.isError && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-warning ">The latest task details could not be refreshed.</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger ">{error}</p>}
          <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
            {!readOnly && <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Delete task</Button>}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
              {!readOnly && <Button type="submit" loading={saveTask.isPending}>Save changes</Button>}
            </div>
          </div>
        </form> : activeTab === 'comments' ? <section className="space-y-4">
          {commentsQuery.isError && <p className="text-sm text-danger">Comments could not be loaded.</p>}
          {commentsQuery.isLoading ? <p className="text-sm text-muted">Loading comments…</p> : comments.length ? <div className="max-h-80 space-y-3 overflow-y-auto">{comments.map((comment) => {
            const author = comment.author || comment.user || {};
            const authorId = String(author._id || author.id || '');
            const ownComment = authorId && authorId === String(user?._id || user?.id);
            return <article key={comment._id} className="rounded-xl border border-border p-3">
              <div className="flex items-start gap-2"><Avatar name={author.username || author.name || 'Member'} className="size-8" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-semibold">{author.username || author.name || 'Member'}</p><time className="text-[11px] text-muted">{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}</time></div><p className="mt-1 whitespace-pre-wrap text-sm">{comment.content || comment.text || comment.body}</p></div></div>
              {ownComment && !readOnly && <div className="mt-2 flex justify-end gap-3"><button type="button" className="text-xs font-semibold text-coral" onClick={() => { setEditingComment(comment); setCommentText(comment.content || comment.text || comment.body || ''); }}>Edit</button><button type="button" className="text-xs font-semibold text-danger" onClick={() => deleteComment.mutate(comment._id)}>Delete</button></div>}
            </article>;
          })}</div> : <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted">No comments yet.</p>}
          {commentsQuery.hasNextPage && <Button variant="secondary" size="sm" onClick={() => commentsQuery.fetchNextPage()} loading={commentsQuery.isFetchingNextPage}>Load older comments</Button>}
          {!readOnly && <form className="space-y-2 border-t border-border pt-4" onSubmit={(event) => { event.preventDefault(); if (commentText.trim()) commentMutation.mutate({ commentId: editingComment?._id, text: commentText.trim() }); }}>
            <Textarea aria-label="Write a comment" rows={3} maxLength={5000} value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add a comment…" />
            <div className="flex justify-end gap-2">{editingComment && <Button type="button" variant="secondary" onClick={() => { setEditingComment(null); setCommentText(''); }}>Cancel edit</Button>}<Button type="submit" loading={commentMutation.isPending} disabled={!commentText.trim()}>{editingComment ? 'Save comment' : 'Post comment'}</Button></div>
          </form>}
        </section> : <section className="space-y-3">
          {activityQuery.isLoading ? <p className="text-sm text-muted">Loading task activity…</p> : activityQuery.isError ? <p className="text-sm text-danger">Task activity could not be loaded.</p> : activity.length ? <div className="max-h-96 space-y-3 overflow-y-auto">{activity.map((event) => <div key={event._id || event.createdAt} className="flex gap-3 rounded-lg border border-border p-3"><Avatar name={event.actor?.username || event.user?.username || 'Member'} className="size-8" /><div><p className="text-sm">{event.description || event.message || event.action || 'Task updated'}</p><time className="text-xs text-muted">{event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</time></div></div>)}</div> : <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted">No activity for this task yet.</p>}
          {activityQuery.hasNextPage && <Button variant="secondary" size="sm" onClick={() => activityQuery.fetchNextPage()} loading={activityQuery.isFetchingNextPage}>Load more activity</Button>}
        </section>}
      </Modal>
      {!readOnly && <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => removeTask.mutate()}
        title="Delete this task?"
        description="This task and its subtasks will be permanently removed."
        loading={removeTask.isPending}
      />}
    </>
  );
};

export default TaskDetailModal;
