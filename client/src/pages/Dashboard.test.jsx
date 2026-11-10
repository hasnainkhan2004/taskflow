import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import Dashboard from './Dashboard';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  role: 'owner',
  permissionsLoading: false,
  projects: [],
}));

vi.mock('../api/axios', () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
    delete: vi.fn(),
  },
}));

vi.mock('../workspaces/useWorkspace', () => ({
  useWorkspace: () => ({
    isLoading: mocks.permissionsLoading,
    can: (permission) => {
      if (mocks.role === 'viewer') return false;
      if (permission === 'projects:create') return mocks.role === 'member';
      if (permission === 'projects:manage') return ['owner', 'admin'].includes(mocks.role);
      return false;
    },
  }),
}));

const renderDashboard = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/w/workspace-1/dashboard']}>
        <Routes>
          <Route path="/w/:workspaceId/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Dashboard project creation', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.put.mockReset();
    mocks.role = 'owner';
    mocks.permissionsLoading = false;
    mocks.projects = [];
    mocks.get.mockImplementation(async () => ({ data: mocks.projects }));

    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value() { this.setAttribute('open', ''); },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value() { this.removeAttribute('open'); },
    });
  });

  it.each(['owner', 'admin', 'member'])('shows project creation in the empty state for %s', async (role) => {
    mocks.role = role;
    renderDashboard();

    expect(await screen.findByText('Your first project starts here')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'New project' })).toHaveLength(1);
  });

  it('hides project creation from viewers and shows the view-only message', async () => {
    mocks.role = 'viewer';
    renderDashboard();

    expect(await screen.findByText('Your first project starts here')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New project' })).toBeNull();
    expect(screen.getAllByText('You have view-only access')).toHaveLength(1);
  });

  it('shows a permission skeleton until the workspace role loads', async () => {
    mocks.permissionsLoading = true;
    renderDashboard();

    expect(screen.queryByRole('status', { name: 'Loading project permissions' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New project' })).toBeNull();
  });

  it('creates a project in this workspace and links to the project board', async () => {
    renderDashboard();
    await screen.findByText('Your first project starts here');
    fireEvent.click(screen.getAllByRole('button', { name: 'New project' })[0]);
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Studio refresh' } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Plan the next release.' } });

    const project = { _id: 'project-1', title: 'Studio refresh', description: 'Plan the next release.' };
    mocks.post.mockImplementation(async (_url, payload) => {
      expect(payload).toEqual({
        title: 'Studio refresh',
        description: 'Plan the next release.',
        workspaceId: 'workspace-1',
      });
      mocks.projects = [project];
      return { data: project };
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Create project' }).closest('form'));

    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    const projectLinks = await screen.findAllByRole('link', { name: /Studio refresh/ });
    expect(projectLinks.some((link) => (
      link.getAttribute('href') === '/w/workspace-1/projects/project-1'
    ))).toBe(true);
    expect(mocks.post).toHaveBeenCalledWith('/workspaces/workspace-1/projects', expect.any(Object));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
