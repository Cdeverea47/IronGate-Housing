import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import TenantLayout from './components/TenantLayout.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Performance from './pages/Performance.jsx';
import Properties from './pages/Properties.jsx';
import PropertyDetail from './pages/PropertyDetail.jsx';
import Tenants from './pages/Tenants.jsx';
import TenantDetail from './pages/TenantDetail.jsx';
import Leases from './pages/Leases.jsx';
import Listings from './pages/Listings.jsx';
import Screening from './pages/Screening.jsx';
import Payments from './pages/Payments.jsx';
import PaymentPlans from './pages/PaymentPlans.jsx';
import Maintenance from './pages/Maintenance.jsx';
import Insurance from './pages/Insurance.jsx';
import Documents from './pages/Documents.jsx';
import { PaymentSuccess, PaymentCancel } from './pages/PaymentResult.jsx';
import PublicScreeningRequest from './pages/PublicScreeningRequest.jsx';
import Terms from './pages/Terms.jsx';
import Profile from './pages/Profile.jsx';
import Help from './pages/Help.jsx';
import TenantDashboard from './pages/tenant/TenantDashboard.jsx';
import TenantPayments from './pages/tenant/TenantPayments.jsx';
import TenantMaintenance from './pages/tenant/TenantMaintenance.jsx';
import TenantDocuments from './pages/tenant/TenantDocuments.jsx';

function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'tenant') return <TenantLayout>{children}</TenantLayout>;
  return <Layout>{children}</Layout>;
}

function LandlordRoutes() {
  return (
    <>
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/performance" element={<Protected><Performance /></Protected>} />
      <Route path="/properties" element={<Protected><Properties /></Protected>} />
      <Route path="/properties/:id" element={<Protected><PropertyDetail /></Protected>} />
      <Route path="/tenants" element={<Protected><Tenants /></Protected>} />
      <Route path="/tenants/:id" element={<Protected><TenantDetail /></Protected>} />
      <Route path="/leases" element={<Protected><Leases /></Protected>} />
      <Route path="/listings" element={<Protected><Listings /></Protected>} />
      <Route path="/screening" element={<Protected><Screening /></Protected>} />
      <Route path="/payments" element={<Protected><Payments /></Protected>} />
      <Route path="/payment-plans" element={<Protected><PaymentPlans /></Protected>} />
      <Route path="/maintenance" element={<Protected><Maintenance /></Protected>} />
      <Route path="/insurance" element={<Protected><Insurance /></Protected>} />
      <Route path="/documents" element={<Protected><Documents /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/help" element={<Protected><Help /></Protected>} />
    </>
  );
}

function TenantRoutes() {
  return (
    <>
      <Route path="/" element={<Protected><TenantDashboard /></Protected>} />
      <Route path="/payments" element={<Protected><TenantPayments /></Protected>} />
      <Route path="/maintenance" element={<Protected><TenantMaintenance /></Protected>} />
      <Route path="/documents" element={<Protected><TenantDocuments /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/help" element={<Protected><Help /></Protected>} />
    </>
  );
}

export default function App() {
  const { user } = useAuth();
  const isTenant = user?.role === 'tenant';

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/pay/success" element={<PaymentSuccess />} />
      <Route path="/pay/cancel" element={<PaymentCancel />} />
      <Route path="/screening-request/:token" element={<PublicScreeningRequest />} />
      <Route path="/terms" element={<Terms />} />
      {isTenant ? TenantRoutes() : LandlordRoutes()}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
