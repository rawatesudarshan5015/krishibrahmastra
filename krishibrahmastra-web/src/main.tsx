import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UpdateBanner } from './components/UpdateBanner'
import { useAuthStore } from './store/auth'
import { useOfflineScanQueue } from './utils/offlineQueue'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000, // 30s — prevents over-fetching on tab refocus
    },
  },
})

/**
 * On startup: if we have a stored access token but no role (older session
 * created before Phase 7), call GET /auth/me to rehydrate the user profile.
 * This runs before React renders so the role gate in AppShell is correct
 * on the very first render.
 */
async function rehydrateRole() {
  const { accessToken, user, setUser } = useAuthStore.getState()
  if (accessToken && (!user || !user.role)) {
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/auth/me`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      setUser(data) // data = { id, name, role }
    } catch {
      // Token is invalid/expired — leave state as-is; AppShell will redirect to /login on 401
    }
  }
}

declare global {
  interface Window {
    deferredPrompt: any;
  }
}

// Intercept beforeinstallprompt event for custom install flow
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
  // Dispatch custom event so pages can listen for installability
  window.dispatchEvent(new Event("pwa-installable"));
});

function AppWrapper() {
  useOfflineScanQueue();
  return (
    <>
      <UpdateBanner />
      <App />
    </>
  );
}

// Register service worker immediately (not inside load event — may have already fired)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then((reg) => {
      console.log("[PWA] Service Worker registered with scope:", reg.scope);
    })
    .catch((err) => {
      console.error("[PWA] Service Worker registration failed:", err);
    });
}

rehydrateRole().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppWrapper />
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  )
})
