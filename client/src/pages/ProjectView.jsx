import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import API from '../api/axios';
import { AuthContext } from '../context/AuthContext';

const ProjectView = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);

  const [project, setProject] = useState(null);
  const [lists, setLists] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [listTitle, setListTitle] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [selectedListId, setSelectedListId] = useState('');

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('Medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editListId, setEditListId] = useState('');

  const loadProjectData = async () => {
    try {
      setLoading(true);
      setError('');
      const [projectRes, listsRes, tasksRes] = await Promise.all([
        API.get(`/projects/${projectId}`),
        API.get(`/lists/project/${projectId}`),
        API.get(`/tasks/project/${projectId}`),
      ]);

      setProject(projectRes.data);
      setLists(listsRes.data);
      setTasks(tasksRes.data);
      if (listsRes.data.length > 0) {
        setSelectedListId(listsRes.data[0]._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load project details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!listTitle.trim()) return;

    try {
      const { data } = await API.post('/lists', { title: listTitle, project: projectId });
      setLists((prev) => [...prev, data]);
      setListTitle('');
      setSelectedListId(data._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create list');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim() || !selectedListId) return;

    try {
      const payload = {
        title: taskTitle,
        description: taskDescription,
        list: selectedListId,
        project: projectId,
        priority: taskPriority,
        dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : null,
      };

      const { data } = await API.post('/tasks', payload);
      setTasks((prev) => [...prev, data]);
      setTaskTitle('');
      setTaskDescription('');
      setTaskPriority('Medium');
      setTaskDueDate('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create task');
    }
  };

  const startEditTask = (task) => {
    setEditingTaskId(task._id);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority || 'Medium');
    setEditDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
    setEditListId(task.list);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTaskId) return;

    try {
      const payload = {
        title: editTitle,
        description: editDescription,
        list: editListId,
        priority: editPriority,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
      };

      const { data } = await API.put(`/tasks/${editingTaskId}`, payload);
      setTasks((prev) => prev.map((task) => (task._id === editingTaskId ? data : task)));
      setEditingTaskId(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await API.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((task) => task._id !== taskId));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete task');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return <div className="p-8 text-center">Loading project...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between rounded-lg bg-white p-4 shadow">
          <div>
            <Link to="/dashboard" className="text-sm text-blue-600">← Back to dashboard</Link>
            <h1 className="text-2xl font-bold text-gray-800">{project?.title || 'Project'}</h1>
            <p className="text-sm text-gray-600">{project?.description || 'No description provided.'}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{user?.name || 'User'}</span>
            <button onClick={handleLogout} className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600">
              Logout
            </button>
          </div>
        </div>

        {error && <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">{error}</div>}

        <div className="mb-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Add a list</h2>
            <form onSubmit={handleCreateList} className="space-y-3">
              <input
                type="text"
                placeholder="List title"
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
              <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                Create List
              </button>
            </form>

            <h2 className="mt-6 mb-3 text-xl font-semibold">Add a task</h2>
            <form onSubmit={handleCreateTask} className="space-y-3">
              <input
                type="text"
                placeholder="Task title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
              <textarea
                placeholder="Task description"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
                rows="3"
              />
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
              >
                {lists.map((list) => (
                  <option key={list._id} value={list._id}>{list.title}</option>
                ))}
              </select>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
              <button type="submit" className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">
                Create Task
              </button>
            </form>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Lists and tasks</h2>
            {lists.length === 0 ? (
              <p className="text-sm text-gray-500">No lists yet. Create your first one to start organizing work.</p>
            ) : (
              <div className="space-y-4">
                {lists.map((list) => {
                  const listTasks = tasks.filter((task) => task.list === list._id);

                  return (
                    <div key={list._id} className="rounded border border-gray-200 p-4">
                      <h3 className="mb-3 font-semibold text-gray-800">{list.title}</h3>
                      {listTasks.length === 0 ? (
                        <p className="text-sm text-gray-500">No tasks in this list yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {listTasks.map((task) => (
                            <div key={task._id} className="rounded bg-gray-50 p-3">
                              {editingTaskId === task._id ? (
                                <form onSubmit={handleSaveEdit} className="space-y-2">
                                  <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full rounded border border-gray-300 px-2 py-1"
                                  />
                                  <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className="w-full rounded border border-gray-300 px-2 py-1"
                                    rows="2"
                                  />
                                  <select
                                    value={editListId}
                                    onChange={(e) => setEditListId(e.target.value)}
                                    className="w-full rounded border border-gray-300 px-2 py-1"
                                  >
                                    {lists.map((option) => (
                                      <option key={option._id} value={option._id}>{option.title}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={editPriority}
                                    onChange={(e) => setEditPriority(e.target.value)}
                                    className="w-full rounded border border-gray-300 px-2 py-1"
                                  >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                  </select>
                                  <input
                                    type="date"
                                    value={editDueDate}
                                    onChange={(e) => setEditDueDate(e.target.value)}
                                    className="w-full rounded border border-gray-300 px-2 py-1"
                                  />
                                  <div className="flex gap-2">
                                    <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-sm text-white">
                                      Save
                                    </button>
                                    <button type="button" onClick={() => setEditingTaskId(null)} className="rounded bg-gray-300 px-3 py-1 text-sm">
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <>
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h4 className="font-medium text-gray-800">{task.title}</h4>
                                      <p className="text-sm text-gray-600">{task.description || 'No description.'}</p>
                                      <div className="mt-2 text-xs text-gray-500">
                                        <span className="mr-2">Priority: {task.priority || 'Medium'}</span>
                                        <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-2 flex gap-2">
                                    <button onClick={() => startEditTask(task)} className="rounded bg-yellow-500 px-3 py-1 text-sm text-white">
                                      Edit
                                    </button>
                                    <button onClick={() => handleDeleteTask(task._id)} className="rounded bg-red-500 px-3 py-1 text-sm text-white">
                                      Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectView;
