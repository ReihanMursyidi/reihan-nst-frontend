"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/store/useAuthStore";

// Input validation schema with Zod
const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email format" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [globalError, setGlobalError] = useState("");

  // Setup React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  // Function Submit
  const onSubmit = async (data: LoginFormInputs) => {
    try {
      setGlobalError("");
      // Endpoint calling
      const response = await api.post("/auth/login", data);

      // Save user's data & token
      login(response.data.user, response.data.token);

      // Redirect to main page
      router.push("/");
    } catch (error: unknown) {
      const message = isAxiosError<{ error?: string }>(error)
        ? error.response?.data?.error
        : undefined;
      setGlobalError(
        message || "Failed to connect to server. Make sure the backend is on.",
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white shadow rounded-xl">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            NodeWave Portal
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">Login</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {globalError && (
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
              {globalError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                {...register("email")}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                placeholder="pm@nst.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                {...register("password")}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                placeholder="password123"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Processing..." : "Login"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Register new Account here{" "}
          <Link
            href="/register"
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Register
          </Link>
        </p>

        <div className="mt-4 text-xs text-gray-500 text-center">
          <p>Testing Accounts:</p>
          <p>pm@nst.com | uiux@nst.com | client@nst.com</p>
          <p>Pass: password123</p>
        </div>
      </div>
    </div>
  );
}
