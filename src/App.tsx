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

function App() {
  return (
    <Routes>
      <Route path="/" element={<SignIn />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/schedule-board" element={<ScheduleBoard />} />
      <Route path="/jobs-management" element={<JobsManagement />} />
      <Route path="/cost-tracking" element={<CostTracking />} />
      <Route path="/Crew" element={<Crew />} />
      <Route path="/timesheet" element={<Timesheet />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/help-center" element={<HelpCenter />} />
      <Route path="/help-center/:articleId" element={<HelpCenter />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
