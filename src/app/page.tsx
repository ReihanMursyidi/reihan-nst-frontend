"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/store/useAuthStore";

// Task creation validation scheme
const createTaskSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  projectId: z.string().uuid("Project ID invalid"),
  isClientVisible: z.boolean().default(false),
  dependsOn: z.array(z.string()).optional(),
});

type CreateTaskFormValues = z.input<typeof createTaskSchema>;
type CreateTaskInputs = z.output<typeof createTaskSchema>;

type Task = {
  id: string;
  title: string;
  status: string;
  projectId?: string;
  project?: { name?: string | null } | null;
  assignee?: { name: string } | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskFormValues, unknown, CreateTaskInputs>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { isClientVisible: false, dependsOn: [] },
  });

  // Get data task
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ data: Task[] }>("/tasks");
      setTasks(response.data.data);
    } catch {
      setError("Failed to load task list from server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    void fetchTasks();
  }, [fetchTasks, router, user]);

  // Open Modal Handler
  const handleOpenModal = () => {
    if (tasks.length > 0 && tasks[0].projectId) {
      setValue("projectId", tasks[0].projectId);
    }
    setIsModalOpen(true);
  };

  // Form Submit Handler
  const onSubmit = async (data: CreateTaskInputs) => {
    try {
      setFormError("");
      await api.post("/tasks", data);
      setIsModalOpen(false);
      reset(); // Bersihkan form
      void fetchTasks(); // Refresh tabel setelah berhasil
    } catch (error: unknown) {
      const message = isAxiosError<{ error?: string }>(error)
        ? error.response?.data?.error
        : undefined;
      setFormError(message || "Terjadi kesalahan saat membuat tugas");
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-black p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md p-6">
        {/* Header Dashboard */}
        <div className="flex justify-between items-center mb-8 border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Task Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Login as:{" "}
              <span className="font-semibold text-blue-600">{user.name}</span>{" "}
              (Role: {user.role})
            </p>
          </div>

          <div className="flex gap-4">
            {user.role === "PM" && (
              <button
                type="button"
                onClick={handleOpenModal}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
              >
                + Create New Task
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-md hover:bg-red-100 transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Tabel Daftar Tugas */}
        {loading ? (
          <div className="text-center py-10 text-gray-500">
            Loading task data...
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-600 rounded-md">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    Task Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    Assignee
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800">
                      {task.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          task.status === "DONE"
                            ? "bg-green-100 text-green-800"
                            : task.status === "IN_PROGRESS"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-200 text-gray-800"
                        }`}
                      >
                        {task.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {task.project?.name || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {task.assignee ? (
                        task.assignee.name
                      ) : (
                        <span className="text-gray-400 italic text-xs">
                          {user.role === "CLIENT"
                            ? "Rahasia Internal"
                            : "Not Assigned"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Create Task */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Create New Task</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {formError && (
                <div className="p-2 bg-red-50 text-red-600 text-sm rounded">
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="task-title"
                  className="block text-sm font-medium"
                >
                  Task Title
                </label>
                <input
                  id="task-title"
                  {...register("title")}
                  className="mt-1 w-full border p-2 rounded"
                  placeholder="Build API Auth"
                />
                {errors.title && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="project-id"
                  className="block text-sm font-medium"
                >
                  Project ID (UUID)
                </label>
                <input
                  id="project-id"
                  {...register("projectId")}
                  className="mt-1 w-full border p-2 rounded bg-gray-50 text-gray-500 text-sm"
                />
                {errors.projectId && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.projectId.message}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  *Automatically filled from existing project data
                </p>
              </div>

              <div>
                <label
                  htmlFor="task-dependencies"
                  className="block text-sm font-medium"
                >
                  Task Prerequisites (Dependencies)
                </label>
                <p className="text-xs text-gray-500 mb-1">
                  Select the tasks that need to be completed first (Hold
                  CTRL/CMD to select more than one)
                </p>
                <select
                  id="task-dependencies"
                  multiple
                  {...register("dependsOn")}
                  className="w-full border p-2 rounded h-24 text-sm"
                >
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center mt-4">
                <input
                  type="checkbox"
                  {...register("isClientVisible")}
                  id="clientVis"
                  className="h-4 w-4 text-blue-600"
                />
                <label
                  htmlFor="clientVis"
                  className="ml-2 text-sm text-gray-700"
                >
                  Visible to Client
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
