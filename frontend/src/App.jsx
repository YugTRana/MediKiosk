import React from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { Monitor, Stethoscope, Shield, HeartPulse } from 'lucide-react';
import KioskPage from './pages/KioskPage.jsx';
import DoctorDashboard from './pages/DoctorDashboard.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import StaffLoginPage from './pages/StaffLoginPage.jsx';

function GlobalNav() {
  return (
    <nav className="bg-slate-900 text-white px-6 py-3 border-b border-slate-800 shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white">MediKiosk</span>
            <span className="ml-2 text-xs uppercase bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-semibold border border-blue-500/30">
              v1.0 Platform
            </span>
          </div>
        </div>

        {/* Route Links */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          <NavLink
            to="/kiosk"
            className={({ isActive }) =>
              `px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`
            }
          >
            <Monitor className="w-4 h-4" /> Kiosk View
          </NavLink>

          <NavLink
            to="/doctor"
            className={({ isActive }) =>
              `px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`
            }
          >
            <Stethoscope className="w-4 h-4" /> Doctor Dashboard
          </NavLink>

          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all ${
                isActive
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`
            }
          >
            <Shield className="w-4 h-4" /> Admin Panel
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('staffRole');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/staff-login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // If logged in but wrong role, send them back to kiosk or their designated dashboard
    return <Navigate to="/kiosk" replace />;
  }

  return children;
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <GlobalNav />
      
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Navigate to="/kiosk" replace />} />
          <Route path="/kiosk" element={<KioskPage />} />
          <Route path="/staff-login" element={<StaffLoginPage />} />
          
          <Route 
            path="/doctor" 
            element={
              <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN']}>
                <DoctorDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminPanel />
              </ProtectedRoute>
            } 
          />
          
          <Route path="*" element={<Navigate to="/kiosk" replace />} />
        </Routes>
      </div>
    </div>
  );
}
