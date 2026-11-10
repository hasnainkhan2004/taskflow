import axios from 'axios';
import { toast } from 'sonner';

const API = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isPublicInvitationPreview = error.config?.method === 'get'
      && /^\/invitations\/[^/]+$/.test(requestUrl);
    if (error.response?.status === 401 && !requestUrl.startsWith('/auth/') && !isPublicInvitationPreview) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      if (window.location.pathname !== '/login') {
        window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      }
    } else if (error.response?.status === 403) {
      const message = error.response?.data?.message || 'You do not have permission to do that.';
      toast.error(message);
      if (/removed|not (a )?member|no longer (have )?access/i.test(message) && window.location.pathname.startsWith('/w/')) {
        window.localStorage.removeItem('taskflow.lastWorkspaceId');
        window.location.assign('/');
      }
    }
    return Promise.reject(error);
  }
);

export default API;
