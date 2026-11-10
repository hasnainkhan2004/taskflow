import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MailPlus, MoreHorizontal, Users } from 'lucide-react';
import { toast } from 'sonner';
import API from '../api/axios';
import { useWorkspace } from '../workspaces/useWorkspace';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';

const rowsFrom = (data) => {
  if (Array.isArray(data)) return data;
  const nested = data?.members || data?.invitations || data?.data || [];
  return Array.isArray(nested) ? nested : rowsFrom(nested);
};

const WorkspaceMembers = () => {
  const { workspaceId, can } = useWorkspace();
  const canManageMembers = can('members:manage');
  const canManageInvites = can('invites:manage');
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const membersQuery = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => (await API.get(`/workspaces/${workspaceId}/members`)).data,
  });
  const invitesQuery = useQuery({
    queryKey: ['workspace-invitations', workspaceId],
    queryFn: async () => (await API.get(`/workspaces/${workspaceId}/invitations`)).data,
    enabled: canManageInvites,
  });
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] }),
    queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] }),
  ]);
  const invite = useMutation({
    mutationFn: () => API.post(`/workspaces/${workspaceId}/invitations`, { email: email.trim(), role }),
    onSuccess: async () => {
      await refresh();
      toast.success('Invitation sent.');
      setInviteOpen(false);
      setEmail('');
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not send invitation.'),
  });
  const memberAction = useMutation({
    mutationFn: ({ member, action, value }) => action === 'role'
      ? API.patch(`/workspaces/${workspaceId}/members/${member._id || member.user?._id}`, { role: value })
      : API.delete(`/workspaces/${workspaceId}/members/${member._id || member.user?._id}`),
    onSuccess: refresh,
    onError: (error) => toast.error(error.response?.data?.message || 'Could not update member.'),
  });
  const inviteAction = useMutation({
    mutationFn: ({ invite: item, action }) => action === 'resend'
      ? API.post(`/workspaces/${workspaceId}/invitations/${item._id}/resend`)
      : API.delete(`/workspaces/${workspaceId}/invitations/${item._id}`),
    onSuccess: refresh,
    onError: (error) => toast.error(error.response?.data?.message || 'Could not update invitation.'),
  });
  const members = rowsFrom(membersQuery.data);
  const invitations = rowsFrom(invitesQuery.data);

  return (
    <div className="space-y-7">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-coral">Workspace</p><h1 className="mt-2 font-heading text-3xl font-bold">Members</h1><p className="mt-1 text-sm text-muted">People sharing this workspace with you.</p></div>
        {canManageInvites && <Button onClick={() => setInviteOpen(true)}><MailPlus size={16} /> Invite people</Button>}
      </header>
      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4 font-semibold">People ({members.length})</div>
        {membersQuery.isLoading ? <p className="p-6 text-sm text-muted">Loading members…</p> : membersQuery.isError ? <p className="p-6 text-sm text-danger">Members could not be loaded.</p> : (
          <div className="divide-y divide-border">{members.map((item) => {
            const person = item.user || item.member || item;
            const personId = person._id || person.id || item._id;
            const displayName = person.username || person.name || person.email || 'Workspace member';
            const memberRole = item.role || person.role || 'member';
            return <div key={personId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3"><Avatar name={displayName} /><div className="min-w-0"><p className="truncate font-semibold">{displayName}</p><p className="truncate text-xs text-muted">{person.email || ''}</p></div></div>
              <div className="flex items-center gap-2">
                {canManageMembers && memberRole !== 'owner' ? <select aria-label={`Role for ${displayName}`} className="min-h-9 rounded-lg border border-border bg-surface px-2 text-sm" value={memberRole} onChange={(event) => memberAction.mutate({ member: item, action: 'role', value: event.target.value })}><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></select> : <span className="rounded-full bg-cream px-3 py-1 text-xs capitalize text-muted ">{memberRole}</span>}
                {canManageMembers && memberRole !== 'owner' && <Button variant="ghost" size="icon" aria-label={`Remove ${displayName}`} onClick={() => { if (window.confirm(`Remove ${displayName} from this workspace?`)) memberAction.mutate({ member: item, action: 'remove' }); }}><MoreHorizontal size={17} /></Button>}
              </div>
            </div>;
          })}{!members.length && <div className="p-8 text-center text-sm text-muted"><Users className="mx-auto mb-2" size={22} />No members found.</div>}</div>
        )}
      </Card>
      {canManageInvites && <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4 font-semibold">Pending invitations</div>
        {invitesQuery.isLoading ? <p className="p-6 text-sm text-muted">Loading invitations…</p> : invitations.length ? <div className="divide-y divide-border">{invitations.map((item) => <div key={item._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-semibold">{item.email}</p><p className="text-xs capitalize text-muted">{item.role || 'member'} · expires {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : '—'}</p></div><div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => inviteAction.mutate({ invite: item, action: 'resend' })}>Resend</Button><Button variant="ghost" size="sm" onClick={() => inviteAction.mutate({ invite: item, action: 'revoke' })}>Revoke</Button></div></div>)}</div> : <p className="p-6 text-sm text-muted">No pending invitations.</p>}
      </Card>}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite to workspace" description="Send an invitation by email.">
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); invite.mutate(); }}>
          <label className="block space-y-2 text-sm font-semibold">Email address<Input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@example.com" /></label>
          <label className="block space-y-2 text-sm font-semibold">Role<select className="min-h-10 w-full rounded-lg border border-border bg-surface px-3" value={role} onChange={(event) => setRole(event.target.value)}><option value="member">Member</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></label>
          <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={() => setInviteOpen(false)}>Cancel</Button><Button type="submit" loading={invite.isPending}>Send invite</Button></div>
        </form>
      </Modal>
    </div>
  );
};

export default WorkspaceMembers;
