import { fireEvent, render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { describe, expect, it, vi } from 'vitest';
import TaskCard from './TaskCard';

describe('TaskCard', () => {
  it('shows task metadata and reports completion toggles', () => {
    const onToggle = vi.fn();
    const task = {
      _id: 'task-1',
      title: 'Review the release plan',
      description: 'Check the final milestones.',
      status: 'todo',
      priority: 'High',
      list: 'list-1',
      labels: [{ _id: 'label-1', name: 'Planning', color: '#3b82f6' }],
      subtasks: [{ _id: 'subtask-1', title: 'Confirm dates', done: true }],
      dueDate: null,
    };

    render(
      <DndContext>
        <SortableContext items={[task._id]}>
          <TaskCard task={task} onOpen={vi.fn()} onToggle={onToggle} />
        </SortableContext>
      </DndContext>
    );

    expect(screen.getByText('Review the release plan')).toBeTruthy();
    expect(screen.getByText('Planning')).toBeTruthy();
    expect(screen.getByText('1/1')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete Review the release plan' }));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
