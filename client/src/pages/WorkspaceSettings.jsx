import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import API from '../api/axios';
import { useWorkspace } from '../workspaces/useWorkspace';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { transferOwnershipPayload } from '../api/workspaceContracts';

const WorkspaceSettings = () => {
  const { workspace, workspaceId, role, can } = useWorkspace();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const membersQuery = useQuery({ queryKey: ['workspace-members', workspaceId], queryFn: async () => (await API.get(`/workspaces/${workspaceId}/members`)).data, enabled: can('workspace:transfer') });
  const memberData = membersQuery.data;
  const members = Array.isArray(memberData) ? memberData : memberData?.members || memberData?.data?.members || memberData?.data || [];
  const isPersonal = workspace?.isPersonal || workspace?.isPersonalWorkspace || workspace?.type === 'personal' || workspace?.personal;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['workspaces'] });
  const nameValue = name ?? workspace?.name ?? workspace?.title ?? '';
  const rename = useMutation({ mutationFn: () => API.patch(`/workspaces/${workspaceId}`, { name: nameValue.trim() }), onSuccess: async () => { await refresh(); toast.success('Workspace renamed.'); }, onError: (error) => toast.error(error.response?.data?.message || 'Could not rename workspace.') });
  const transfer = useMutation({ mutationFn: () => API.post(`/workspaces/${workspaceId}/transfer-ownership`, transferOwnershipPayload(ownerId)), onSuccess: async () => { await refresh(); toast.success('Ownership transferred.'); }, onError: (error) => toast.error(error.response?.data?.message || 'Could not transfer ownership.') });
  const deleteWorkspace = useMutation({ mutationFn: () => API.delete(`/workspaces/${workspaceId}`), onSuccess: async () => { await queryClient.invalidateQueries(); toast.success('Workspace deleted.'); navigate('/', { replace: true }); }, onError: (error) => toast.error(error.response?.data?.message || 'Could not delete workspace.') });
  const leave = useMutation({ mutationFn: () => API.post(`/workspaces/${workspaceId}/leave`), onSuccess: async () => { window.localStorage.removeItem('taskflow.lastWorkspaceId'); await queryClient.invalidateQueries(); toast.success('You left the workspace.'); navigate('/', { replace: true }); }, onError: (error) => toast.error(error.response?.data?.message || 'Could not leave workspace.') });

  return <div className="mx-auto max-w-3xl space-y-7">
    <header><p className="text-xs font-bold uppercase tracking-[.16em] text-coral">Workspace</p><h1 className="mt-2 font-heading text-3xl font-bold">Settings</h1><p className="mt-1 text-sm text-muted">Manage the workspace name and ownership.</p></header>
    {can('workspace:manage') && <Card className="space-y-4 p-6"><div><h2 className="font-heading text-lg font-bold">Workspace name</h2><p className="mt-1 text-sm text-muted">Make this workspace easy to recognize.</p></div><form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); rename.mutate(); }}><Input aria-label="Workspace name" required maxLength={80} value={nameValue} onChange={(event) => setName(event.target.value)} /><Button loading={rename.isPending}>Save name</Button></form></Card>}
    {can('workspace:transfer') && !isPersonal && <Card className="space-y-4 p-6"><div><h2 className="font-heading text-lg font-bold">Transfer ownership</h2><p className="mt-1 text-sm text-muted">Choose a member and type the workspace name to confirm the transfer.</p></div><form className="space-y-3" onSubmit={(event) => { event.preventDefault(); transfer.mutate(); }}><select aria-label="New workspace owner" required className="min-h-10 w-full rounded-lg border border-border bg-surface px-3" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">Select a member</option>{members.map((member) => { const person = member.user || member; const id = person._id || person.id || member._id; if (!id || id === workspace?.owner?._id) return null; return <option key={id} value={id}>{person.username || person.name || person.email || 'Member'}</option>; })}</select><Input aria-label="Confirm workspace name for ownership transfer" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder={`Type ${workspace?.name || workspace?.title || 'workspace name'}`} /><Button variant="secondary" loading={transfer.isPending} disabled={!ownerId || confirmText !== (workspace?.name || workspace?.title)}>Transfer ownership</Button></form></Card>}
    {!isPersonal && role !== 'owner' && <Card className="space-y-4 border-amber/40 p-6"><div><h2 className="font-heading text-lg font-bold">Leave workspace</h2><p className="mt-1 text-sm text-muted">You will lose access until invited again.</p></div><Button variant="secondary" onClick={() => { if (window.confirm('Leave this workspace?')) leave.mutate(); }} loading={leave.isPending}>Leave workspace</Button></Card>}
    {can('workspace:delete') && !isPersonal && <Card className="space-y-4 border-danger/30 p-6"><div><h2 className="font-heading text-lg font-bold text-danger">Delete workspace</h2><p className="mt-1 text-sm text-muted">This permanently removes the workspace and its shared content. This cannot be undone.</p></div><label className="block space-y-2 text-sm font-semibold">Type <span className="font-bold">{workspace?.name || workspace?.title}</span> to confirm<Input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} /></label><Button variant="danger" disabled={confirmText !== (workspace?.name || workspace?.title)} loading={deleteWorkspace.isPending} onClick={() => deleteWorkspace.mutate()}>Delete workspace</Button></Card>}
    {isPersonal && <p className="text-sm text-muted">Personal workspaces can’t be transferred or deleted.</p>}
  </div>;
};

export default WorkspaceSettings;
