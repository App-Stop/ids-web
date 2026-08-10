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
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<SignIn />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/schedule-board" element={<ProtectedRoute><ScheduleBoard /></ProtectedRoute>} />
      <Route path="/jobs-management" element={<ProtectedRoute><JobsManagement /></ProtectedRoute>} />
      <Route path="/cost-tracking" element={<ProtectedRoute><CostTracking /></ProtectedRoute>} />
      <Route path="/Crew" element={<ProtectedRoute><Crew /></ProtectedRoute>} />
      <Route path="/timesheet" element={<ProtectedRoute><Timesheet /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/help-center" element={<HelpCenter />} />
      <Route path="/help-center/:articleId" element={<HelpCenter />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
