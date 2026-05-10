/**
 * App.jsx — Root component.
 * Defines all routes and wraps the app in AuthProvider.
 * Adding a new page: import it, add a <Route> here.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login       from './pages/Login'
import Register    from './pages/Register'
import Gallery     from './pages/Gallery'
import Upload      from './pages/Upload'
import GuestUpload from './pages/GuestUpload'
import Admin       from './pages/Admin'
import Albums      from './pages/Albums'
import Trash       from './pages/Trash'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Public — friend upload (no login) */}
          <Route path="/upload/:token" element={<GuestUpload />} />

          {/* Protected — require login */}
          <Route path="/" element={
            <ProtectedRoute><Gallery /></ProtectedRoute>
          } />
          <Route path="/upload" element={
            <ProtectedRoute><Upload /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute><Admin /></ProtectedRoute>
          } />
          <Route path="/albums" element={
            <ProtectedRoute><Albums /></ProtectedRoute>
          } />
          <Route path="/trash" element={
            <ProtectedRoute><Trash /></ProtectedRoute>
          } />

          {/* Phase 7: admin panel */}
          {/* <Route path="/admin" element={
            <ProtectedRoute><Admin /></ProtectedRoute>
          } /> */}

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
