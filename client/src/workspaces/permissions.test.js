import { describe, expect, it } from 'vitest';
import { canWorkspace } from './permissions';
import { safeReturnTo } from '../auth/returnTo';
import {
  commentPayload,
  invitationDecisionPath,
  nextPageParam,
  transferOwnershipPayload,
} from '../api/workspaceContracts';

describe('workspace permissions', () => {
  it('uses the canonical workspace and comment request fields', () => {
    expect(transferOwnershipPayload('user-123')).toEqual({ userId: 'user-123' });
    expect(commentPayload('A note')).toEqual({ body: 'A note' });
  });

  it('builds invite actions and advances paginated responses', () => {
    expect(invitationDecisionPath('invite-token', 'accept')).toBe('/invitations/invite-token/accept');
    expect(invitationDecisionPath('invite/token', 'decline')).toBe('/invitations/invite%2Ftoken/decline');
    expect(nextPageParam({ page: 1, limit: 20, total: 25 })).toBe(2);
    expect(nextPageParam({ page: 2, limit: 20, total: 25 })).toBeUndefined();
  });

  it('only accepts safe internal authentication return paths', () => {
    expect(safeReturnTo('/invite/token-123')).toBe('/invite/token-123');
    expect(safeReturnTo('//example.com')).toBe('/');
    expect(safeReturnTo('/\\example.com')).toBe('/');
    expect(safeReturnTo('https://example.com')).toBe('/');
  });

  it('keeps viewers read-only', () => {
    expect(canWorkspace('viewer', 'tasks:manage')).toBe(false);
    expect(canWorkspace('viewer', 'projects:create')).toBe(false);
    expect(canWorkspace('viewer', 'members:manage')).toBe(false);
  });

  it('limits ownership controls to owners', () => {
    expect(canWorkspace('admin', 'workspace:manage')).toBe(true);
    expect(canWorkspace('admin', 'workspace:delete')).toBe(false);
    expect(canWorkspace('admin', 'workspace:transfer')).toBe(false);
    expect(canWorkspace('owner', 'workspace:delete')).toBe(true);
  });

  it('lets members collaborate without granting workspace administration', () => {
    expect(canWorkspace('member', 'tasks:manage')).toBe(true);
    expect(canWorkspace('member', 'projects:create')).toBe(true);
    expect(canWorkspace('member', 'members:manage')).toBe(false);
  });
});
