import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuthStore } from "../store/auth";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

type Mode = "login" | "register";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-red-500 text-xs mt-1">{message}</p>;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setAccessToken, setUser } = useAuthStore();
  const [mode, setMode] = useState<Mode>("login");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterData>({
    resolver: zodResolver(mode === "login" ? loginSchema : registerSchema) as any,
  });

  const switchMode = (next: Mode) => {
    setMode(next);
    reset();
  };

  const loginMutation = useMutation({
    mutationFn: (data: LoginData) =>
      apiClient.post("/api/v1/auth/login", data).then((r) => r.data),
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      setUser(data.user);
      navigate("/scan");
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterData) =>
      apiClient.post("/api/v1/auth/register", data).then((r) => r.data),
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      setUser(data.user);
      navigate("/scan");
    },
  });

  const onSubmit = (data: RegisterData) => {
    if (mode === "login") {
      loginMutation.mutate({ email: data.email, password: data.password });
    } else {
      registerMutation.mutate(data);
    }
  };

  const activeMutation = mode === "login" ? loginMutation : registerMutation;
  const isPending = activeMutation.isPending;
  const isError = activeMutation.isError;

  const errorMessage = () => {
    const err = activeMutation.error as any;
    const detail = err?.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (mode === "login") return "Invalid email or password";
    return "Registration failed. Please try again.";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm space-y-6">
        {/* Logo + Title */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-14 h-14 bg-green-700 rounded-2xl flex items-center justify-center shadow-md">
              <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
                <path
                  d="M16 4C10 4 5 9 5 16c0 5 3 9 8 11l11-11c2-2 3-5 3-8C27 5.5 22.5 4 16 4z"
                  fill="white"
                />
                <path
                  d="M10 22l8-8"
                  stroke="#16a34a"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Krishi Brahmastra</h1>
          <p className="text-sm text-gray-500">
            {mode === "login"
              ? "Sign in to your account"
              : "Create a new account"}
          </p>
        </div>

        {/* Mode toggle tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "login"
                ? "bg-white shadow text-green-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "register"
                ? "bg-white shadow text-green-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Name — only for register */}
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                {...register("name")}
                id="name"
                type="text"
                autoComplete="name"
                placeholder="e.g. Ramesh Patil"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              />
              <FieldError message={errors.name?.message} />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              {...register("email")}
              id="email"
              type="email"
              autoComplete="email"
              placeholder="farmer@example.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
            <FieldError message={errors.email?.message} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              {...register("password")}
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
            <FieldError message={errors.password?.message} />
          </div>

          {isError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <p className="text-red-600 text-sm">{errorMessage()}</p>
            </div>
          )}

          <button
            type="submit"
            id="submit-btn"
            disabled={isPending}
            className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isPending
              ? mode === "login"
                ? "Signing in..."
                : "Creating account..."
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
