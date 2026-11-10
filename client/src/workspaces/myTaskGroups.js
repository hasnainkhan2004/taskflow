export const MY_TASK_GROUPS = [
  ['overdue', 'Overdue'],
  ['today', 'Today'],
  ['thisWeek', 'This week'],
  ['later', 'Later'],
  ['noDate', 'No date'],
];

export const extractTaskGroups = (response) => {
  let data = response;
  while (data && !Array.isArray(data) && data.data && !data.groups && !data.overdue && !data.thisWeek) {
    data = data.data;
  }
  const groups = data?.groups || data;
  return MY_TASK_GROUPS.map(([key, label]) => [
    label,
    (Array.isArray(groups?.[key]) ? groups[key] : [])
      .filter((task) => task.status !== 'done' && !task.completed),
  ]);
};
