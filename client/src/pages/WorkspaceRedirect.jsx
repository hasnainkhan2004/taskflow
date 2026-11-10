import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import API from '../api/axios';
import { normalizeWorkspaces } from '../workspaces/useWorkspace';

const WorkspaceRedirect = ({ destination = 'dashboard' }) => {
  const query = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => (await API.get('/workspaces')).data,
  });
  const workspaces = normalizeWorkspaces(query.data);
  const savedId = window.localStorage.getItem('taskflow.lastWorkspaceId');
  const defaultId = query.data?.defaultWorkspaceId || query.data?.defaultWorkspace?._id || query.data?.data?.defaultWorkspaceId;
  const selected = workspaces.find((item) => String(item._id || item.id) === savedId)
    || workspaces.find((item) => String(item._id || item.id) === String(defaultId))
    || workspaces.find((item) => item.isDefault || item.isPersonal || item.default)
    || workspaces[0];
  useEffect(() => {
    if (selected) window.localStorage.setItem('taskflow.lastWorkspaceId', selected._id || selected.id);
  }, [selected]);
  if (query.isLoading) return <div className="p-8 text-sm text-muted" role="status">Loading your workspace…</div>;
  if (query.isError || !selected) return <Navigate to="/login" replace />;
  return <Navigate to={`/w/${selected._id || selected.id}/${destination}`} replace />;
};

export default WorkspaceRedirect;
