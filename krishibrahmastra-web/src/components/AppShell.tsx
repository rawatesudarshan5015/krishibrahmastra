import { Outlet, NavLink, useNavigate, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { apiClient } from "../api/client";
import { OfflineBanner } from "./OfflineBanner";

// Static nav items shown to every authenticated user
const baseNavItems = [
  {
    to: "/scan",
    label: "Scan",
    icon: (active: boolean) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.5 : 2}
        className="w-6 h-6"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01" strokeLinecap="round" />
        <path d="M7 12h10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "/history",
    label: "History",
    icon: (active: boolean) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.5 : 2}
        className="w-6 h-6"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/brc-finder",
    label: "BRC Map",
    icon: (active: boolean) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.5 : 2}
        className="w-6 h-6"
      >
        <path
          d="M12 21C12 21 5 13.5 5 9a7 7 0 0114 0c0 4.5-7 12-7 12z"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  },
];

// Admin-only nav item
const adminNavItem = {
  to: "/admin",
  label: "Admin",
  icon: (active: boolean) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 2}
      className="w-6 h-6"
    >
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export function AppShell() {
  const { accessToken, logout, user } = useAuthStore();
  const navigate = useNavigate();

  const navItems = [
    ...baseNavItems,
    ...(user?.role === "ADMIN" ? [adminNavItem] : []),
  ];
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    try {
      await apiClient.post("/api/v1/auth/logout");
    } catch {
      // Ignore — we clear client state regardless
    }
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex flex-col min-h-screen bg-green-50">
      {/* Offline Banner — sits above everything */}
      <OfflineBanner />

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-green-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
              <path
                d="M16 4C10 4 5 9 5 16c0 5 3 9 8 11l11-11c2-2 3-5 3-8C27 5.5 22.5 4 16 4z"
                fill="#16a34a"
              />
              <path
                d="M10 22l8-8"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-bold text-green-800 text-base tracking-tight">
              Krishi Brahmastra
            </span>
          </div>

          {/* Right side: profile link + sign out */}
          <div className="flex items-center gap-1">
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive ? "text-green-700 bg-green-50" : "text-gray-600 hover:text-green-700 hover:bg-green-50"
                }`
              }
            >
              <div className="w-6 h-6 rounded-full bg-green-700 flex items-center justify-center shrink-0">
                <span className="text-white text-[10px] font-bold">
                  {user?.name?.[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
              <span className="hidden sm:block max-w-[80px] truncate">{user?.name}</span>
            </NavLink>

            <button
              id="header-signout-btn"
              onClick={handleLogout}
              title="Sign out"
              className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path d="M17 16l4-4m0 0l-4-4m4 4H7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 20H5a2 2 0 01-2-2V6a2 2 0 012-2h4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-green-100 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-around">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-3 px-5 transition-all ${
                  isActive
                    ? "text-green-700"
                    : "text-gray-400 hover:text-gray-600"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`transition-transform ${isActive ? "scale-110" : ""}`}
                  >
                    {icon(isActive)}
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      isActive ? "text-green-700" : "text-gray-400"
                    }`}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 w-8 h-0.5 bg-green-600 rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
