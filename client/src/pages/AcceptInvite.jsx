import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import API from '../api/axios';
import { AuthContext } from '../context/authContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { safeReturnTo } from '../auth/returnTo';
import { invitationDecisionPath } from '../api/workspaceContracts';

const AcceptInvite = () => {
  const { token } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['invitation', token], queryFn: async () => (await API.get(`/invitations/${encodeURIComponent(token)}`)).data, retry: false });
  const action = useMutation({
    mutationFn: (decision) => API.post(invitationDecisionPath(token, decision)),
    onSuccess: async (result, decision) => {
      await queryClient.invalidateQueries();
      toast.success(decision === 'accept' ? 'You joined the workspace.' : 'Invitation declined.');
      const wsId = result.data?.workspaceId || result.data?.workspace?._id || query.data?.workspace?._id || query.data?.workspaceId || query.data?.invitation?.workspace?._id;
      navigate(decision === 'accept' && wsId ? `/w/${wsId}/dashboard` : '/', { replace: true });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not respond to invitation.'),
  });
  const invitation = query.data?.invitation || query.data;
  const workspace = invitation?.workspace || query.data?.workspace;
  const returnTo = safeReturnTo(`/invite/${encodeURIComponent(token)}`);
  const needsLogin = () => navigate('/login', { state: { returnTo } });

  return <main className="flex min-h-screen items-center justify-center bg-cream p-4 "><Card className="w-full max-w-lg p-7 sm:p-9">
    <p className="text-xs font-bold uppercase tracking-[.16em] text-coral">TaskFlow invitation</p>
    {query.isLoading ? <p className="mt-4 text-sm text-muted">Loading invitation…</p> : query.isError ? <><h1 className="mt-3 font-heading text-2xl font-bold">Invitation unavailable</h1><p className="mt-2 text-sm text-muted">{query.error?.response?.data?.message || 'This invitation may have expired or already been used.'}</p><Link className="mt-5 inline-block text-sm font-semibold text-coral" to="/login">Sign in</Link></> : <>
      <h1 className="mt-3 font-heading text-2xl font-bold">You’re invited to {workspace?.name || workspace?.title || 'a workspace'}</h1>
      <p className="mt-2 text-sm text-muted">Invited as <span className="font-semibold capitalize">{invitation?.role || 'member'}</span>{invitation?.email ? ` · ${invitation.email}` : ''}</p>
      {!user && <p className="mt-4 rounded-lg bg-cream p-3 text-sm text-muted ">Sign in or create an account to accept or decline this invitation.</p>}
      <div className="mt-6 flex flex-wrap gap-3">{user ? <><Button onClick={() => action.mutate('accept')} loading={action.isPending}>Accept invitation</Button><Button variant="secondary" onClick={() => action.mutate('decline')} disabled={action.isPending}>Decline</Button></> : <><Button onClick={needsLogin}>Sign in to continue</Button><Button variant="secondary" as={Link} to="/signup" state={{ returnTo }}>Create account</Button></>}</div>
    </>}
  </Card></main>;
};

export default AcceptInvite;
