import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import API from '../api/axios';
import { canWorkspace } from './permissions';

export const workspacesQueryKey = ['workspaces'];

export const normalizeWorkspaces = (data) => {
  if (Array.isArray(data)) return data;
  const nested = data?.workspaces || data?.data || data?.items || [];
  return Array.isArray(nested) ? nested : normalizeWorkspaces(nested);
};

export const useWorkspace = () => {
  const { workspaceId } = useParams();
  const query = useQuery({
    queryKey: workspacesQueryKey,
    queryFn: async () => (await API.get('/workspaces')).data,
  });
  const detailQuery = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: async () => (await API.get(`/workspaces/${workspaceId}`)).data,
    enabled: Boolean(workspaceId),
  });
  const workspaces = normalizeWorkspaces(query.data);
  const listedWorkspace = workspaces.find((item) => String(item._id || item.id) === String(workspaceId));
  const detail = detailQuery.data?.workspace || detailQuery.data?.data?.workspace || detailQuery.data?.data || detailQuery.data;
  const workspace = detail?._id || detail?.id ? detail : listedWorkspace;
  const role = workspace?.role || workspace?.membership?.role || 'viewer';
  return useMemo(() => ({
    ...query,
    isLoading: query.isLoading || detailQuery.isLoading,
    permissionsLoading: query.isLoading || detailQuery.isLoading,
    isError: query.isError,
    workspaceId,
    workspace,
    workspaces,
    role,
    can: (permission) => canWorkspace(role, permission),
  }), [query, detailQuery, workspaceId, workspace, workspaces, role]);
};
