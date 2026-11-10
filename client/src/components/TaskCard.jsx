import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, GripVertical, ListChecks } from 'lucide-react';
import Badge from './ui/Badge';
import Checkbox from './ui/Checkbox';
import Avatar from './ui/Avatar';

const dateTone = (dueDate, status) => {
  if (!dueDate || status === 'done') return 'text-muted';
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((due.setHours(0, 0, 0, 0) - today.getTime()) / 86400000);
  if (daysUntil < 0) return 'text-danger';
  if (daysUntil <= 2) return 'text-warning';
  return 'text-muted';
};

const TaskCard = ({ task, onOpen, onToggle, draggable = true, editable = true }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    data: { type: 'task', listId: String(task.list), task },
    disabled: !draggable,
  });
  const completedSubtasks = task.subtasks?.filter((subtask) => subtask.done).length || 0;
  const subtaskCount = task.subtasks?.length || 0;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`group rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md ${isDragging ? 'z-10 opacity-40' : ''}`}
    >
      <div className="flex items-start gap-2">
        {draggable && (
          <button
            type="button"
            className="mt-0.5 cursor-grab rounded p-1 text-muted/60 opacity-100 hover:bg-cream hover:text-ink focus-visible:opacity-100 active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100"
            aria-label={`Drag ${task.title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left focus-visible:rounded focus-visible:outline"
        >
          <span className={`block break-words text-sm font-semibold leading-5 ${task.status === 'done' ? 'text-muted line-through' : 'text-ink'}`}>
            {task.title}
          </span>
          {task.description && (
            <span className="mt-1.5 line-clamp-2 block text-xs leading-5 text-muted">
              {task.description}
            </span>
          )}
        </button>
        {editable && <Checkbox
          checked={task.status === 'done'}
          onChange={onToggle}
          label={`${task.status === 'done' ? 'Reopen' : 'Complete'} ${task.title}`}
        />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone={task.priority}>{task.priority}</Badge>
        {task.status === 'in_progress' && <Badge tone="in_progress">In progress</Badge>}
        {(task.labels || []).map((label) => (
          <Badge
            key={label._id || label}
            className="max-w-28 truncate"
            style={{ backgroundColor: `${label.color}20`, color: label.color }}
          >
            {label.name || 'Label'}
          </Badge>
        ))}
      </div>

      <div className="mt-3 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {(task.assignees || (task.assignee ? [task.assignee] : [])).slice(0, 3).map((person) => {
          const user = person.user || person;
          return <Avatar key={user._id || user.id || user.username} name={user.username || user.name || user.email || 'Member'} className="size-6 text-[9px]" />;
        })}
        {task.dueDate && (
          <span className={`inline-flex items-center gap-1 ${dateTone(task.dueDate, task.status)}`}>
            <CalendarDays size={12} />
            {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
        {subtaskCount > 0 && (
          <span className={`inline-flex items-center gap-1 ${completedSubtasks === subtaskCount ? 'text-success' : 'text-muted'}`}>
            <ListChecks size={13} /> {completedSubtasks}/{subtaskCount}
          </span>
        )}
      </div>
    </article>
  );
};

export default TaskCard;
