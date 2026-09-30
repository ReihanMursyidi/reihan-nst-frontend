"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { api } from "@/lib/axios";

// Register validation schema
const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["PM", "INTERNAL", "CLIENT"]),
  department: z.string().optional(),
});

type RegisterInputs = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [globalError, setGlobalError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInputs>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "INTERNAL" },
  });

  const selectedRole = watch("role");

  const onSubmit = async (data: RegisterInputs) => {
    try {
      setGlobalError("");
      setSuccessMsg("");

      const payload = {
        ...data,
        department: data.department === "" ? undefined : data.department,
      };

      await api.post("/auth/register", payload);

      setSuccessMsg("Registration successful! Redirecting to login page...");
      setTimeout(() => router.push("/login"), 2000);
    } catch (error: unknown) {
      const axiosError =
        error && typeof error === "object" && "response" in error
          ? error
          : undefined;
      const mainError =
        axiosError && typeof axiosError.response?.data === "object"
          ? (axiosError.response?.data as { error?: string; details?: unknown })
              .error || "Registration failed"
          : "Registration failed";
      const errorDetails =
        axiosError && typeof axiosError.response?.data === "object"
          ? (axiosError.response?.data as { details?: unknown }).details
          : undefined;

      if (errorDetails) {
        setGlobalError(`${mainError} : ${JSON.stringify(errorDetails)}`);
      } else {
        setGlobalError(mainError);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-black py-12">
      <div className="max-w-md w-full p-8 bg-white shadow rounded-xl">
        <h2 className="text-center text-3xl font-extrabold mb-6">
          Register New Account
        </h2>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {globalError && (
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">
              {globalError}
            </div>
          )}
          {successMsg && (
            <div className="p-3 text-sm text-green-700 bg-green-50 rounded-md border border-green-200">
              {successMsg}
            </div>
          )}

          <div>
            <label
              htmlFor="register-name"
              className="block text-sm font-medium"
            >
              Fullname
            </label>
            <input
              id="register-name"
              type="text"
              {...register("name")}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="block text-sm font-medium"
            >
              Email
            </label>
            <input
              id="register-email"
              type="email"
              {...register("email")}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            />
            {errors.email && (
              <p className="text-xs text-red-500 mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="block text-sm font-medium"
            >
              Password
            </label>
            <input
              id="register-password"
              type="password"
              {...register("password")}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            />
            {errors.password && (
              <p className="text-xs text-red-500 mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="register-role"
              className="block text-sm font-medium"
            >
              Role
            </label>
            <select
              id="register-role"
              {...register("role")}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 bg-white"
            >
              <option value="INTERNAL">
                Internal Team (Engineer/Designer)
              </option>
              <option value="PM">Product Manager</option>
              <option value="CLIENT">Client Guest</option>
            </select>
          </div>

          {selectedRole === "INTERNAL" && (
            <div>
              <label
                htmlFor="register-department"
                className="block text-sm font-medium"
              >
                Department
              </label>
              <select
                id="register-department"
                {...register("department")}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2 bg-white"
              >
                <option value="">Select Department...</option>
                <option value="UI/UX">UI/UX Design</option>
                <option value="Frontend">Frontend Engineering</option>
                <option value="Backend">Backend Engineering</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 mt-6 font-medium"
          >
            {isSubmitting ? "Proccessing..." : "Register Now"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link
            href="/login"
            className="text-blue-600 hover:underline font-medium"
          >
            Login here
          </Link>
        </div>
      </div>
    </div>
  );
}
