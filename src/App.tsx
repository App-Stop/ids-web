import { Routes, Route, Navigate } from 'react-router-dom'
import SignIn from './pages/SignIn'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ScheduleBoard from './pages/ScheduleBoard'
import JobsManagement from './pages/JobManagement'
import Crew from './pages/Crew'
import CostTracking from './pages/CostTracking'
import Timesheet from './pages/Timesheet'
import Profile from './pages/Profile'
import HelpCenter from './pages/HelpCenter'
import ProtectedRoute from './components/ProtectedRoute'

/* The crew-side (mobile / PWA) screens are shelved for now. Their pages and
   styles still live under src/pages/crew and src/components/crew, built from
   the Figma designs — re-add the routes here to bring them back. */

function App() {
  return (
    <Routes>
      {/* ---- auth ---- */}
      <Route path="/" element={<SignIn />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* ---- admin console ---- */}
      <Route path="/schedule-board" element={<ProtectedRoute><ScheduleBoard /></ProtectedRoute>} />
      <Route path="/jobs-management" element={<ProtectedRoute><JobsManagement /></ProtectedRoute>} />
      <Route path="/cost-tracking" element={<ProtectedRoute><CostTracking /></ProtectedRoute>} />
      <Route path="/crew-management" element={<ProtectedRoute><Crew /></ProtectedRoute>} />
      <Route path="/timesheet" element={<ProtectedRoute><Timesheet /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

      <Route path="/help-center" element={<HelpCenter />} />
      <Route path="/help-center/:articleId" element={<HelpCenter />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
