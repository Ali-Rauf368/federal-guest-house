import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import type { Role } from "./lib/api";
import { AuthProvider, useAuth } from "./lib/auth";
import { ToastProvider } from "./lib/toast";
import { AccessLogPage } from "./pages/AccessLog";
import { CalendarPage } from "./pages/Calendar";
import { GuestRecordPage } from "./pages/GuestRecord";
import { GuestsPage } from "./pages/Guests";
import { LoginPage } from "./pages/Login";
import { ReservationPage } from "./pages/Reservation";
import { ReservationsPage } from "./pages/Reservations";
import { RoomsPage } from "./pages/Rooms";
import { StaffPage } from "./pages/Staff";
import { TodayPage } from "./pages/Today";

const DESK: Role[] = ["ADMIN", "RECEPTION"];

function Guard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/rooms" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route index element={<Guard roles={DESK}><TodayPage /></Guard>} />
        <Route path="calendar" element={<Guard roles={DESK}><CalendarPage /></Guard>} />
        <Route path="reservations" element={<Guard roles={DESK}><ReservationsPage /></Guard>} />
        <Route path="reservations/:id" element={<Guard roles={DESK}><ReservationPage /></Guard>} />
        <Route path="guests" element={<Guard roles={DESK}><GuestsPage /></Guard>} />
        <Route path="guests/:id" element={<Guard roles={DESK}><GuestRecordPage /></Guard>} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="staff" element={<Guard roles={["ADMIN"]}><StaffPage /></Guard>} />
        <Route path="access-log" element={<Guard roles={["ADMIN"]}><AccessLogPage /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
