import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, Plus, X } from 'lucide-react';
import TaskCard from './TaskCard';
import Button from './ui/Button';
import Input from './ui/Input';
import Skeleton from './ui/Skeleton';

const BoardColumn = ({
  list,
  tasks,
  loading,
  draggableTasks,
  onCreateTask,
  onOpenTask,
  onToggleTask,
  onAddList,
  isLastList,
  editable = true,
}) => {
  const [addingTask, setAddingTask] = useState(false);
  const [title, setTitle] = useState('');
  const droppable = useDroppable({ id: list._id, data: { type: 'column', listId: list._id } });
  const sortable = useSortable({
    id: `list:${list._id}`,
    data: { type: 'list', listId: list._id },
    disabled: !editable,
  });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  const submitTask = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      await onCreateTask(list._id, title.trim());
      setTitle('');
      setAddingTask(false);
    } catch {
      // The mutation displays the API error; keep the draft available to retry.
    }
  };

  return (
    <section
      ref={(node) => {
        droppable.setNodeRef(node);
        sortable.setNodeRef(node);
      }}
      style={style}
      className={`flex max-h-[calc(100dvh-280px)] min-h-[360px] w-[min(84vw,340px)] shrink-0 flex-col rounded-2xl border bg-cream/75 p-3 transition-colors  ${droppable.isOver ? 'border-coral/70 bg-[#fff3ec] ' : 'border-border'} ${sortable.isDragging ? 'opacity-50' : ''}`}
    >
      <header className="mb-3 flex items-center gap-2 px-1">
        {editable && <button
          type="button"
          className="cursor-grab rounded p-1 text-muted hover:bg-surface active:cursor-grabbing"
          aria-label={`Drag ${list.title} list`}
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical size={15} />
        </button>}
        <h2 className="min-w-0 flex-1 truncate font-heading text-sm font-bold">{list.title}</h2>
        <span className="rounded-full bg-surface px-2 py-1 text-[10px] font-semibold text-muted">
          {tasks.length}
        </span>
        {editable && isLastList && (
          <button
            type="button"
            aria-label="Add a list"
            title="Add a list"
            className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink"
            onClick={onAddList}
          >
            <Plus size={16} />
          </button>
        )}
      </header>

      <SortableContext items={tasks.map((task) => task._id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-12 flex-1 space-y-2.5 overflow-y-auto px-0.5 pb-2">
          {loading ? (
            Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="space-y-3 rounded-xl border border-border bg-surface p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-5 w-1/3" />
              </div>
            ))
          ) : tasks.length ? (
            tasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                draggable={draggableTasks}
                onOpen={() => onOpenTask(task)}
                onToggle={() => onToggleTask(task)}
                editable={editable}
              />
            ))
          ) : (
            <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-border bg-surface/60 p-4 text-center text-xs text-muted">
              {droppable.isOver ? 'Drop task here' : 'No tasks here yet'}
            </div>
          )}
        </div>
      </SortableContext>

      {editable && addingTask ? (
        <form className="mt-2 flex items-center gap-2" onSubmit={submitTask}>
          <Input
            autoFocus
            aria-label={`New task in ${list.title}`}
            placeholder="Write a task..."
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setAddingTask(false);
                setTitle('');
              }
            }}
            maxLength={200}
          />
          <Button size="icon" aria-label="Save task"><Check size={17} /></Button>
          <Button
            size="icon"
            variant="ghost"
            type="button"
            aria-label="Cancel adding task"
            onClick={() => {
              setAddingTask(false);
              setTitle('');
            }}
          >
            <X size={16} />
          </Button>
        </form>
      ) : editable ? (
        <button
          type="button"
          className="mt-1 flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-muted transition hover:bg-surface hover:text-coral"
          onClick={() => setAddingTask(true)}
        >
          <Plus size={15} /> Add task
        </button>
      ) : null}
    </section>
  );
};

export default BoardColumn;
