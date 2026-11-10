import { describe, expect, it } from 'vitest';
import { extractTaskGroups, MY_TASK_GROUPS } from '../workspaces/myTaskGroups';

describe('My Tasks groups', () => {
  it('uses the required group labels and order', () => {
    expect(MY_TASK_GROUPS.map(([, label]) => label)).toEqual([
      'Overdue',
      'Today',
      'This week',
      'Later',
      'No date',
    ]);
  });

  it('renders the server groups and excludes completed tasks', () => {
    const groups = extractTaskGroups({
      overdue: [{ _id: 'overdue' }, { _id: 'done-overdue', status: 'done' }],
      today: [{ _id: 'today' }],
      thisWeek: [{ _id: 'week' }],
      later: [{ _id: 'later' }],
      noDate: [{ _id: 'undated' }, { _id: 'completed', completed: true }],
      completed: [{ _id: 'completed-group' }],
    });

    expect(groups).toEqual([
      ['Overdue', [{ _id: 'overdue' }]],
      ['Today', [{ _id: 'today' }]],
      ['This week', [{ _id: 'week' }]],
      ['Later', [{ _id: 'later' }]],
      ['No date', [{ _id: 'undated' }]],
    ]);
  });

  it('supports groups nested under the response data property', () => {
    expect(extractTaskGroups({ data: { groups: { today: [{ _id: 'task' }] } } })[1])
      .toEqual(['Today', [{ _id: 'task' }]]);
  });
});
