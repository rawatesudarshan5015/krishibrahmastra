import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuthStore } from "../store/auth";

const schema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { setAccessToken, setUser } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const registerMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiClient
        .post("/api/v1/auth/register", {
          name: data.name,
          email: data.email,
          password: data.password,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      setUser(data.user);
      navigate("/scan", { replace: true });
    },
  });

  const errorMessage = (() => {
    const status = (registerMutation.error as any)?.response?.status;
    if (status === 409) return "An account with this email already exists.";
    if (registerMutation.isError) return "Registration failed. Please try again.";
    return null;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-green-700 rounded-2xl flex items-center justify-center mb-3 shadow-md">
            <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
              <path
                d="M16 4C10 4 5 9 5 16c0 5 3 9 8 11l11-11c2-2 3-5 3-8C27 5.5 22.5 4 16 4z"
                fill="white"
              />
              <path
                d="M10 22l8-8"
                stroke="#16a34a"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-green-900">Create Account</h1>
          <p className="text-sm text-gray-500 mt-1">Join Krishi Brahmastra</p>
        </div>

        {/* Form */}
        <form
          id="register-form"
          onSubmit={handleSubmit((data) => registerMutation.mutate(data))}
          className="bg-white rounded-2xl shadow-sm border border-green-100 p-6 space-y-4"
        >
          {/* Name */}
          <div>
            <label
              htmlFor="register-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Full Name
            </label>
            <input
              id="register-name"
              {...register("name")}
              placeholder="Ramesh Patil"
              autoComplete="name"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="register-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="register-email"
              {...register("email")}
              type="email"
              placeholder="ramesh@example.com"
              autoComplete="email"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="register-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="register-password"
              {...register("password")}
              type="password"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="register-confirm-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Confirm Password
            </label>
            <input
              id="register-confirm-password"
              {...register("confirmPassword")}
              type="password"
              placeholder="Repeat password"
              autoComplete="new-password"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Server error */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-sm">{errorMessage}</p>
            </div>
          )}

          {/* Submit */}
          <button
            id="register-submit-btn"
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {registerMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="opacity-25"
                  />
                  <path
                    d="M4 12a8 8 0 018-8v8z"
                    fill="currentColor"
                    className="opacity-75"
                  />
                </svg>
                Creating account...
              </span>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {/* Login link */}
        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-green-700 font-semibold hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
