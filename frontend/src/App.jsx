/**
 * App.jsx — Root component.
 * Defines all routes and wraps the app in AuthProvider.
 * Adding a new page: import it, add a <Route> here.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login    from './pages/Login'
import Register from './pages/Register'
import Gallery  from './pages/Gallery'
// Phase 4: import Upload from './pages/Upload'
// Phase 7: import Admin from './pages/Admin'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected — require login */}
          <Route path="/" element={
            <ProtectedRoute><Gallery /></ProtectedRoute>
          } />

          {/* Phase 4: friend upload page (public, token-gated) */}
          {/* <Route path="/upload/:token" element={<Upload />} /> */}

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
