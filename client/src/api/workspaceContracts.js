export const transferOwnershipPayload = (userId) => ({ userId });

export const commentPayload = (body) => ({ body });

export const invitationDecisionPath = (token, decision) => (
  `/invitations/${encodeURIComponent(token)}/${decision}`
);

export const nextPageParam = (response) => {
  if (response?.nextCursor) return response.nextCursor;
  if (response?.nextPage) return response.nextPage;
  if (response?.hasNextPage) return (response.page || 1) + 1;
  if (response?.total != null && response?.page != null) {
    const limit = response.limit || 20;
    return response.page * limit < response.total ? response.page + 1 : undefined;
  }
  return undefined;
};
