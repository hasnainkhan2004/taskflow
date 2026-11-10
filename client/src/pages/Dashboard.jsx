import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowUpRight, FolderKanban, Plus, Search, Sparkles } from 'lucide-react';
import API from '../api/axios';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Dropdown from '../components/ui/Dropdown';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Skeleton from '../components/ui/Skeleton';
import Textarea from '../components/ui/Textarea';
import { useWorkspace } from '../workspaces/useWorkspace';

const EMPTY_PROJECTS = [];

const Dashboard = () => {
  const queryClient = useQueryClient();
  const { workspaceId } = useParams();
  const { can, isLoading: permissionsLoading } = useWorkspace();
  const canCreateProject = can('projects:create') || can('projects:manage');
  const [search, setSearch] = useState('');
  const [projectDialog, setProjectDialog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mutationError, setMutationError] = useState('');

  const projectsQuery = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => (await API.get(`/workspaces/${workspaceId}/projects`)).data,
  });
  const projects = Array.isArray(projectsQuery.data)
    ? projectsQuery.data
    : projectsQuery.data?.projects || projectsQuery.data?.data || EMPTY_PROJECTS;
  const visibleProjects = useMemo(() => projects.filter((project) => (
    `${project.title} ${project.description}`.toLowerCase().includes(search.toLowerCase())
  )), [projects, search]);

  const saveProject = useMutation({
    mutationFn: async () => {
      const payload = { title: title.trim(), description: description.trim(), ...(!projectDialog?.project && { workspaceId }) };
      return projectDialog?.project
        ? API.put(`/projects/${projectDialog.project._id}`, payload)
        : API.post(`/workspaces/${workspaceId}/projects`, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      toast.success(projectDialog?.project ? 'Project updated.' : 'Project created.');
      setProjectDialog(null);
    },
    onError: (error) => {
      setMutationError(error.response?.data?.message || 'Could not save this project.');
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (projectId) => API.delete(`/projects/${projectId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      toast.success('Project deleted.');
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not delete the project.'),
  });

  const openProjectDialog = (project = null) => {
    setMutationError('');
    setTitle(project?.title || '');
    setDescription(project?.description || '');
    setProjectDialog({ project });
  };

  const handleSaveProject = (event) => {
    event.preventDefault();
    setMutationError('');
    if (!title.trim()) {
      setMutationError('Add a project name to continue.');
      return;
    }
    saveProject.mutate();
  };

  const isLoading = projectsQuery.isLoading;
  const totalTasks = projects.reduce((total, project) => total + (project.totalTasks || 0), 0);
  const completedTasks = projects.reduce((total, project) => total + (project.doneTasks || 0), 0);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-[#302c30] px-6 py-8 text-white shadow-card sm:px-9 sm:py-10">
        <div className="absolute -right-12 -top-32 size-80 rounded-full bg-coral/25 blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 size-72 rounded-full bg-amber/15 blur-3xl" />
        <div className="relative flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#ffb19b]">
              <Sparkles size={14} /> Your studio
            </p>
            <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Good work starts with a clear plan.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
              Keep your projects in one place, turn big ideas into small steps, and make progress at your own pace.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ['Projects', projects.length, 'A home for each idea'],
          ['Open tasks', Math.max(totalTasks - completedTasks, 0), 'Your next steps'],
          ['Completed', completedTasks, 'Progress worth noticing'],
        ].map(([label, count, hint]) => (
          <Card key={label} className="p-5">
            <p className="text-sm font-semibold text-muted">{label}</p>
            <p className="mt-2 font-heading text-3xl font-bold tracking-tight">{isLoading ? '—' : count}</p>
            <p className="mt-1 text-xs text-muted">{hint}</p>
          </Card>
        ))}
      </section>

      <section>
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-tight">Your projects</h2>
            <p className="mt-1 text-sm text-muted">Everything you’re moving forward.</p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              type="search"
              placeholder="Find a project..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search projects"
            />
          </label>
        </div>

        {projectsQuery.isError ? (
          <Card className="p-7">
            <p className="font-semibold">Projects couldn’t load</p>
            <p className="mt-1 text-sm text-muted">{projectsQuery.error.response?.data?.message || 'Check your connection and try again.'}</p>
            <Button className="mt-4" variant="secondary" onClick={() => projectsQuery.refetch()}>Try again</Button>
          </Card>
        ) : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Card key={index} className="space-y-5 p-5">
                <Skeleton className="size-11 rounded-xl" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-full" />
              </Card>
            ))}
          </div>
        ) : visibleProjects.length === 0 ? (
          <EmptyState
            icon={search ? Search : FolderKanban}
            title={search ? 'No matching projects' : 'Your first project starts here'}
            description={search
              ? 'Try another search, or clear the search field.'
              : 'Create a project to give your ideas a place to grow. You can add lists and tasks as soon as it’s ready.'}
            action={search ? null : permissionsLoading ? (
              <div role="status" aria-label="Loading project permissions">
                <Skeleton className="h-10 w-36 rounded-lg" />
              </div>
            ) : canCreateProject ? (
              <Button onClick={() => openProjectDialog()}><Plus size={16} /> New project</Button>
            ) : (
              <p className="text-sm text-muted">You have view-only access</p>
            )}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProjects.map((project, index) => {
              const progress = project.totalTasks
                ? Math.round((project.doneTasks / project.totalTasks) * 100)
                : 0;
              return (
                <Card key={project._id} className="group relative overflow-visible p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/w/${workspaceId}/projects/${project._id}`} className="flex min-w-0 flex-1 items-start gap-3">
                      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${index % 3 === 0 ? 'bg-[#fff0e8] text-[#aa4930]  ' : index % 3 === 1 ? 'bg-[#fff4db] text-[#916411]  ' : 'bg-[#e6f4ea] text-[#27734d]  '}`}>
                        <FolderKanban size={20} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-heading text-base font-bold">{project.title}</span>
                        <span className="mt-1 line-clamp-2 block min-h-10 text-xs leading-5 text-muted">
                          {project.description || 'A fresh space for your next steps.'}
                        </span>
                      </span>
                    </Link>
                    {can('projects:manage') && <Dropdown label={`Actions for ${project.title}`}>
                      <button type="button" onClick={() => openProjectDialog(project)}>Edit project</button>
                      <button type="button" className="text-danger" onClick={() => setDeleteTarget(project)}>Delete project</button>
                    </Dropdown>}
                  </div>
                  <div className="mt-6">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-muted">{project.doneTasks || 0} of {project.totalTasks || 0} tasks complete</span>
                      <span className="font-semibold">{progress}%</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-cream "
                      role="progressbar"
                      aria-label={`${project.title} task progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                    >
                      <div className="h-full rounded-full bg-coral transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted">
                    <span>{project.totalTasks || 0} tasks</span>
                    {project.overdueTasks > 0
                      ? <span className="font-semibold text-danger">{project.overdueTasks} overdue</span>
                      : <span className="inline-flex items-center gap-1 font-semibold text-success">On track</span>}
                    <Link
                      to={`/w/${workspaceId}/projects/${project._id}`}
                      className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-cream hover:text-ink "
                      aria-label={`Open ${project.title}`}
                    >
                      <ArrowUpRight size={17} />
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Modal
        open={Boolean(projectDialog)}
        onClose={() => setProjectDialog(null)}
        title={projectDialog?.project ? 'Edit project' : 'Create a project'}
        description="Give this project a name and a little context."
      >
        <form className="space-y-4" onSubmit={handleSaveProject}>
          <label className="block space-y-2 text-sm font-semibold">
            <span>Project name</span>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required autoFocus />
          </label>
          <label className="block space-y-2 text-sm font-semibold">
            <span>Description <span className="font-normal text-muted">(optional)</span></span>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={3} />
          </label>
          {mutationError && <p className="text-sm text-danger" role="alert">{mutationError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setProjectDialog(null)}>Cancel</Button>
            <Button type="submit" loading={saveProject.isPending}>{projectDialog?.project ? 'Save changes' : 'Create project'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this project?"
        description={`“${deleteTarget?.title || ''}” will be removed. This can’t be undone.`}
        loading={deleteProject.isPending}
        onConfirm={() => deleteProject.mutate(deleteTarget._id)}
      />
    </div>
  );
};

export default Dashboard;
