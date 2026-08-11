import { Routes, Route, Navigate } from 'react-router-dom'
import SignIn from './pages/SignIn'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import ScheduleBoard from './pages/ScheduleBoard'
import JobsManagement from './pages/JobManagement'
import Crew from './pages/Crew'
import CostTracking from './pages/CostTracking'
import Timesheet from './pages/Timesheet'
import Profile from './pages/Profile'
import HelpCenter from './pages/HelpCenter'
import ProtectedRoute, { CREW_LOGIN_PATH } from './components/ProtectedRoute'
import { CREW_ROLES } from './context/AuthContext'
import CrewLayout from './components/crew/CrewLayout'
import CrewLogin from './pages/crew/CrewLogin'
import CrewHome from './pages/crew/CrewHome'
import CrewJobs from './pages/crew/CrewJobs'
import CrewTimesheet from './pages/crew/CrewTimesheet'
import CrewProfile from './pages/crew/CrewProfile'

function CrewRoute() {
  return (
    <ProtectedRoute roles={[...CREW_ROLES]} loginPath={CREW_LOGIN_PATH}>
      <CrewLayout />
    </ProtectedRoute>
  )
}

function App() {
  return (
    <Routes>
      {/* ---- auth ---- */}
      <Route path="/login" element={<CrewLogin />} />
      <Route path="/admin/login" element={<SignIn />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* ---- crew side (mobile / PWA) ---- */}
      <Route path="/crew" element={<CrewRoute />}>
        <Route index element={<CrewHome />} />
        <Route path="jobs" element={<CrewJobs />} />
        <Route path="timesheet" element={<CrewTimesheet />} />
        <Route path="profile" element={<CrewProfile />} />
      </Route>

      {/* ---- admin console ---- */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/schedule-board" element={<ProtectedRoute><ScheduleBoard /></ProtectedRoute>} />
      <Route path="/jobs-management" element={<ProtectedRoute><JobsManagement /></ProtectedRoute>} />
      <Route path="/cost-tracking" element={<ProtectedRoute><CostTracking /></ProtectedRoute>} />
      {/* renamed from /Crew — route matching is case-insensitive, so it collided with /crew */}
      <Route path="/crew-management" element={<ProtectedRoute><Crew /></ProtectedRoute>} />
      <Route path="/timesheet" element={<ProtectedRoute><Timesheet /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

      <Route path="/help-center" element={<HelpCenter />} />
      <Route path="/help-center/:articleId" element={<HelpCenter />} />

      <Route path="/" element={<Navigate to={CREW_LOGIN_PATH} replace />} />
      <Route path="*" element={<Navigate to={CREW_LOGIN_PATH} replace />} />
    </Routes>
  )
}

export default App
