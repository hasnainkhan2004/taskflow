import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import AppShell from './components/AppShell';
import GuestRoute from './components/GuestRoute';
import ProtectedRoute from './components/ProtectedRoute';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import Dashboard from './pages/Dashboard';
import ForgotPassword from './pages/ForgotPassword';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import ProjectView from './pages/ProjectView';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import WorkspaceRedirect from './pages/WorkspaceRedirect';
import WorkspaceMembers from './pages/WorkspaceMembers';
import WorkspaceSettings from './pages/WorkspaceSettings';
import WorkspaceActivity from './pages/WorkspaceActivity';
import MyTasks from './pages/MyTasks';
import AcceptInvite from './pages/AcceptInvite';

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<GuestRoute><Login /></GuestRoute>}
      />
      <Route
        path="/signup"
        element={<GuestRoute><Register /></GuestRoute>}
      />
      <Route path="/register" element={<Navigate to="/signup" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route
          path="/w/:workspaceId/dashboard"
          element={<RouteErrorBoundary><Dashboard /></RouteErrorBoundary>}
        />
        <Route
          path="/w/:workspaceId/projects/:projectId"
          element={<RouteErrorBoundary><ProjectView /></RouteErrorBoundary>}
        />
        <Route path="/w/:workspaceId/my-tasks" element={<RouteErrorBoundary><MyTasks /></RouteErrorBoundary>} />
        <Route path="/w/:workspaceId/members" element={<RouteErrorBoundary><WorkspaceMembers /></RouteErrorBoundary>} />
        <Route path="/w/:workspaceId/activity" element={<RouteErrorBoundary><WorkspaceActivity /></RouteErrorBoundary>} />
        <Route path="/w/:workspaceId/settings" element={<RouteErrorBoundary><WorkspaceSettings /></RouteErrorBoundary>} />
      </Route>
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/dashboard" element={<ProtectedRoute><WorkspaceRedirect /></ProtectedRoute>} />
      <Route path="/projects/:projectId" element={<ProtectedRoute><LegacyProjectRedirect /></ProtectedRoute>} />
      <Route path="/my-tasks" element={<ProtectedRoute><WorkspaceRedirect destination="my-tasks" /></ProtectedRoute>} />
      <Route path="/members" element={<ProtectedRoute><WorkspaceRedirect destination="members" /></ProtectedRoute>} />
      <Route path="/activity" element={<ProtectedRoute><WorkspaceRedirect destination="activity" /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><WorkspaceRedirect destination="settings" /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><WorkspaceRedirect /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function LegacyProjectRedirect() {
  const { projectId } = useParams();
  return <WorkspaceRedirect destination={`projects/${projectId}`} />;
}

export default App;
