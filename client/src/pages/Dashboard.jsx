import { useContext, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';
import { AuthContext } from '../context/AuthContext';

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProjects = async () => {
    try {
      setLoading(true);
      const { data } = await API.get('/projects');
      setProjects(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please add a project title');
      return;
    }

    try {
      const { data } = await API.post('/projects', { title, description });
      setProjects((prev) => [data, ...prev]);
      setTitle('');
      setDescription('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create project');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-lg bg-white p-4 shadow">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">TaskFlow Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome back, {user?.name || 'there'}.</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
          >
            Logout
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Create a project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              {error && <p className="text-sm text-red-500">{error}</p>}
              <input
                type="text"
                placeholder="Project title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
              <textarea
                placeholder="Project description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
                rows="4"
              />
              <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                Create Project
              </button>
            </form>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your projects</h2>
              <span className="text-sm text-gray-500">{projects.length} total</span>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Loading projects...</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-gray-500">No projects yet. Create your first one.</p>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => (
                  <Link key={project._id} to={`/projects/${project._id}`} className="block rounded border border-gray-200 p-3 hover:bg-gray-50">
                    <h3 className="font-semibold text-gray-800">{project.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">{project.description || 'No description provided.'}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;