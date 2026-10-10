import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuthStore } from "../store/auth";

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z.string().min(8, "New password must be at least 8 characters"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-red-500 text-xs mt-1">{message}</p>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
    />
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [installPrompt, setInstallPrompt] = useState<any>(window.deferredPrompt);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;

  useEffect(() => {
    const handleInstallable = () => {
      setInstallPrompt(window.deferredPrompt);
    };
    window.addEventListener("pwa-installable", handleInstallable);
    return () => {
      window.removeEventListener("pwa-installable", handleInstallable);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
      window.deferredPrompt = null;
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const changePwMutation = useMutation({
    mutationFn: (data: PasswordForm) =>
      apiClient
        .put("/api/v1/auth/me/password", {
          current_password: data.current_password,
          new_password: data.new_password,
        })
        .then((r) => r.data),
    onSuccess: () => {
      setSuccessMsg("Password changed successfully! Please log in again.");
      reset();
      setShowPasswordForm(false);
      // Force re-login with new password
      setTimeout(() => {
        logout();
        navigate("/login", { replace: true });
      }, 2000);
    },
  });

  const errorMsg = (() => {
    const status = (changePwMutation.error as any)?.response?.status;
    const detail = (changePwMutation.error as any)?.response?.data?.detail;
    if (status === 400) return detail ?? "Current password is incorrect";
    if (changePwMutation.isError) return "Failed to change password. Try again.";
    return null;
  })();

  const roleLabel = user?.role === "ADMIN" ? "Administrator" : "Farmer";
  const roleBg = user?.role === "ADMIN"
    ? "bg-purple-100 text-purple-700"
    : "bg-green-100 text-green-700";

  return (
    <div className="p-4 pb-10 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">Account details and settings</p>
      </div>

      {/* Avatar + info card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center shadow">
            <span className="text-white text-xl font-bold">
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-lg">{user?.name}</p>
            <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1 ${roleBg}`}>
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Info rows */}
        <div className="border-t border-gray-50 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">User ID</p>
            <p className="text-sm font-mono text-gray-700 truncate max-w-[160px]">{user?.id}</p>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          id="toggle-password-form-btn"
          onClick={() => setShowPasswordForm((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-600">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-800">Change Password</p>
          </div>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={`w-4 h-4 text-gray-400 transition-transform ${showPasswordForm ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {showPasswordForm && (
          <div className="border-t border-gray-100 px-5 pb-5 pt-4">
            <form
              id="change-password-form"
              onSubmit={handleSubmit((d) => changePwMutation.mutate(d))}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                  Current Password
                </label>
                <Input
                  id="current-password"
                  {...register("current_password")}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <FieldError message={errors.current_password?.message} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                  New Password
                </label>
                <Input
                  id="new-password"
                  {...register("new_password")}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                />
                <FieldError message={errors.new_password?.message} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                  Confirm New Password
                </label>
                <Input
                  id="confirm-password"
                  {...register("confirm_password")}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat new password"
                />
                <FieldError message={errors.confirm_password?.message} />
              </div>

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-red-600 text-sm">{errorMsg}</p>
                </div>
              )}

              <button
                id="change-password-submit"
                type="submit"
                disabled={changePwMutation.isPending}
                className="w-full bg-green-700 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors"
              >
                {changePwMutation.isPending ? "Saving..." : "Update Password"}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <p className="text-green-800 text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {/* Install PWA Card */}
      {!isStandalone && installPrompt && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2} className="w-5 h-5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-sm font-semibold text-gray-800">Install Krishi Brahmastra</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Add to your home screen for quick offline access and a full-screen, native experience.
              </p>
              <button
                id="pwa-install-btn"
                onClick={handleInstall}
                className="mt-3 bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-green-800 active:scale-95 transition-all shadow-sm"
              >
                Install App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          id="profile-logout-btn"
          onClick={() => {
            apiClient.post("/api/v1/auth/logout").catch(() => {});
            logout();
            navigate("/login", { replace: true });
          }}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-50 transition-colors text-left group"
        >
          <div className="w-8 h-8 rounded-xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2} className="w-4 h-4">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 20H5a2 2 0 01-2-2V6a2 2 0 012-2h4" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-red-600">Sign Out</p>
        </button>
      </div>
    </div>
  );
}
