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

const editTaskSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  assigneeId: z
    .string()
    .uuid("Assignee ID invalid")
    .optional()
    .or(z.literal("")),
  isClientVisible: z.boolean(),
  version: z.number().int(),
});

type CreateTaskInputs = z.input<typeof createTaskSchema>;
type EditTaskInputs = z.input<typeof editTaskSchema>;

type Task = {
  id: string;
  title: string;
  status: string;
  version: number;
  projectId?: string;
  project?: { name?: string | null } | null;
  assignee?: { name: string } | null;
  assigneeId?: string | null;
  isClientVisible: boolean;
  attachments?: string[];
};

// Tipe khusus untuk response error
type ApiErrorResponse = {
  error?: string;
  message?: string;
  blockedBy?: string[];
  errors?: string | string[];
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!isAxiosError<ApiErrorResponse>(error)) return fallback;

  const responseData = error.response?.data;
  if (!responseData) return error.message || fallback;

  if (Array.isArray(responseData.errors)) {
    return responseData.errors.join(", ");
  }

  return (
    responseData.error ||
    responseData.message ||
    responseData.errors ||
    error.message ||
    fallback
  );
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  // State Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [formError, setFormError] = useState("");
  const [uploadUrl, setUploadUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Hook Form: Create
  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    reset: resetCreate,
    setValue: setCreateValue,
    formState: { errors: createErrors, isSubmitting: isCreateSubmitting },
  } = useForm<CreateTaskInputs>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { isClientVisible: false, dependsOn: [] },
  });

  // Hook Form: Edit
  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    setValue: setEditValue,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = useForm<EditTaskInputs>({
    resolver: zodResolver(editTaskSchema),
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    if (!isMounted) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void fetchTasks();
  }, [fetchTasks, router, user, isMounted]);

  // Handler: Create
  const handleOpenCreateModal = () => {
    if (tasks.length > 0 && tasks[0].projectId) {
      setCreateValue("projectId", tasks[0].projectId);
    }
    setFormError("");
    setIsCreateModalOpen(true);
  };

  const onCreateTask = async (data: CreateTaskInputs) => {
    try {
      setFormError("");
      await api.post("/tasks", data);
      setIsCreateModalOpen(false);
      resetCreate();
      void fetchTasks();
      setActionMessage({ type: "success", text: "Task successfully created!" });
    } catch (error: unknown) {
      const message = isAxiosError<ApiErrorResponse>(error)
        ? error.response?.data?.error
        : undefined;
      setFormError(message || "An error occurred while creating the task");
    }
  };

  // Handler Status
  const handleStatusChange = async (
    taskId: string,
    currentVersion: number,
    newStatus: string,
  ) => {
    try {
      setActionMessage(null);
      await api.patch(`/tasks/${taskId}/status`, {
        status: newStatus,
        version: currentVersion,
      });
      void fetchTasks();
      setActionMessage({
        type: "success",
        text: "Task status successfully updated!",
      });
    } catch (error: unknown) {
      let errorText = "Failed to update status";
      if (isAxiosError<ApiErrorResponse>(error) && error.response?.data) {
        const responseData = error.response.data;
        errorText = responseData.error || errorText;
        if (responseData.blockedBy && responseData.blockedBy.length > 0) {
          errorText += ` (Waiting for: ${responseData.blockedBy.join(", ")})`;
        }
      }
      setActionMessage({ type: "error", text: errorText });
      void fetchTasks();
    }
  };

  // Handler Edit (PM Only)
  const handleOpenEditModal = (task: Task) => {
    setSelectedTask(task);
    setEditValue("title", task.title);
    setEditValue("assigneeId", task.assigneeId || "");
    setEditValue("isClientVisible", task.isClientVisible);
    setEditValue("version", task.version);
    setFormError("");
    setIsEditModalOpen(true);
  };

  const onEditTask = async (data: EditTaskInputs) => {
    if (!selectedTask) return;
    try {
      setFormError("");
      const payload = {
        title: data.title,
        assigneeId: data.assigneeId || null,
        isClientVisible: data.isClientVisible,
        version: data.version,
      };
      await api.patch(`/tasks/${selectedTask.id}`, payload);
      setIsEditModalOpen(false);
      resetEdit();
      void fetchTasks();
      setActionMessage({
        type: "success",
        text: "Task details successfully updated!",
      });
    } catch (error: unknown) {
      const message = getApiErrorMessage(
        error,
        "Failed to update task details",
      );
      setFormError(message);
      if (isAxiosError(error) && error.response?.status === 409) {
        void fetchTasks();
      }
    }
  };

  // Handler Delete
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    try {
      setActionMessage(null);
      await api.delete(`/tasks/${taskId}`);
      void fetchTasks();
      setActionMessage({ type: "success", text: "Task successfully deleted!" });
    } catch (error: unknown) {
      const message = isAxiosError<ApiErrorResponse>(error)
        ? error.response?.data?.error
        : undefined;
      setActionMessage({
        type: "error",
        text: message || "Failed to delete task",
      });
    }
  };

  // Handler Upload Attachment (Internal Team Only)
  const handleUploadAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !uploadUrl) return;

    try {
      setIsUploading(true);
      setFormError("");
      await api.post(`/tasks/${selectedTask.id}/attachments`, {
        attachmentUrl: uploadUrl,
      });
      setIsUploadModalOpen(false);
      setUploadUrl("");
      void fetchTasks();
      setActionMessage({
        type: "success",
        text: "Attachment uploaded successfully!",
      });
    } catch (error: unknown) {
      const message = isAxiosError<ApiErrorResponse>(error)
        ? error.response?.data?.error
        : undefined;
      setFormError(message ?? "Failed to upload attachment");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (!isMounted || !user) return null;

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
              (Role: {user.role}
              {user.role === "INTERNAL" && user.department
                ? ` - ${user.department}`
                : ""}
              )
            </p>
          </div>

          <div className="flex gap-4">
            {user.role === "PM" && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition shadow-sm"
              >
                + Create New Task
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-md hover:bg-red-100 transition shadow-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {actionMessage && (
          <div
            className={`p-4 mb-6 rounded-md ${actionMessage.type === "error" ? "bg-red-100 text-red-700 border border-red-300" : "bg-green-100 text-green-700 border border-green-300"}`}
          >
            <p className="font-medium">
              {actionMessage.type === "error" ? "System Warning:" : "Success:"}
            </p>
            <p className="text-sm mt-1">{actionMessage.text}</p>
          </div>
        )}

        {/* Task Table */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    Attachments
                  </th>
                  {/* Kolom Actions Eksklusif untuk PM */}
                  {user.role === "PM" && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800">
                      {task.title}
                      {task.isClientVisible && (
                        <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          Visible to Client
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.role === "CLIENT" ? (
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${task.status === "DONE" ? "bg-green-100 text-green-800" : task.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-800" : "bg-gray-200 text-gray-800"}`}
                        >
                          {task.status.replace("_", " ")}
                        </span>
                      ) : (
                        <select
                          value={task.status}
                          onChange={(e) =>
                            handleStatusChange(
                              task.id,
                              task.version,
                              e.target.value,
                            )
                          }
                          className={`text-sm font-semibold rounded-md p-1.5 border cursor-pointer ${task.status === "DONE" ? "bg-green-50 text-green-800 border-green-200" : task.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-800 border-blue-200" : "bg-gray-50 text-gray-800 border-gray-200"}`}
                        >
                          <option value="TODO">TODO</option>
                          <option value="IN_PROGRESS">IN PROGRESS</option>
                          <option value="DONE">DONE</option>
                        </select>
                      )}
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
                            ? "Internal Secret"
                            : "Not Assigned"}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-600">
                      {task.attachments && task.attachments.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {task.attachments.map((url, idx) => (
                            <a
                              key={`${task.id}-${url}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline text-xs truncate max-w-37.5 inline-block"
                            >
                              🔗 Link {idx + 1}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-xs">
                          Not available
                        </span>
                      )}
                    </td>

                    {/* Kolom Actions */}
                    {(user.role === "PM" || user.role === "INTERNAL") && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {user.role === "PM" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(task)}
                              className="text-indigo-600 hover:text-indigo-900 mr-4"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </>
                        )}

                        {user.role === "INTERNAL" &&
                          task.assigneeId === user.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTask(task);
                                setFormError("");
                                setIsUploadModalOpen(true);
                              }}
                              className="text-green-600 hover:text-green-900 bg-green-50 px-3 py-1 rounded border border-green-200"
                            >
                              + Upload
                            </button>
                          )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Create Task */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Create New Task</h2>
            <form
              onSubmit={handleCreateSubmit(onCreateTask)}
              className="space-y-4"
            >
              {formError && (
                <div className="p-2 bg-red-50 text-red-600 text-sm rounded">
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="create-task-title"
                  className="block text-sm font-medium"
                >
                  Task Title
                </label>
                <input
                  id="create-task-title"
                  {...registerCreate("title")}
                  className="mt-1 w-full border p-2 rounded"
                  placeholder="Build API Auth"
                />
                {createErrors.title && (
                  <p className="text-red-500 text-xs mt-1">
                    {createErrors.title.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="create-task-project-id"
                  className="block text-sm font-medium"
                >
                  Project ID (UUID)
                </label>
                <input
                  id="create-task-project-id"
                  {...registerCreate("projectId")}
                  className="mt-1 w-full border p-2 rounded bg-gray-50 text-gray-500 text-sm"
                />
                {createErrors.projectId && (
                  <p className="text-red-500 text-xs mt-1">
                    {createErrors.projectId.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="create-task-depends-on"
                  className="block text-sm font-medium"
                >
                  Prerequisites (Dependencies)
                </label>
                <select
                  id="create-task-depends-on"
                  multiple
                  {...registerCreate("dependsOn")}
                  className="mt-1 w-full border p-2 rounded h-24 text-sm"
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
                  {...registerCreate("isClientVisible")}
                  id="createClientVis"
                  className="h-4 w-4 text-blue-600"
                />
                <label
                  htmlFor="createClientVis"
                  className="ml-2 text-sm text-gray-700"
                >
                  Visible to Client
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreateSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Task (PM Only) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Edit Task Details</h2>
            <form onSubmit={handleEditSubmit(onEditTask)} className="space-y-4">
              {formError && (
                <div className="p-2 bg-red-50 text-red-600 text-sm rounded">
                  {formError}
                </div>
              )}
              <div>
                <label
                  htmlFor="edit-task-title"
                  className="block text-sm font-medium"
                >
                  Task Title
                </label>
                <input
                  id="edit-task-title"
                  {...registerEdit("title")}
                  className="mt-1 w-full border p-2 rounded"
                />
                {editErrors.title && (
                  <p className="text-red-500 text-xs mt-1">
                    {editErrors.title.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="edit-task-assignee-id"
                  className="block text-sm font-medium"
                >
                  Assignee ID (UUID)
                </label>
                <input
                  id="edit-task-assignee-id"
                  {...registerEdit("assigneeId")}
                  className="mt-1 w-full border p-2 rounded"
                  placeholder="Kosongkan jika unassigned"
                />
                {editErrors.assigneeId && (
                  <p className="text-red-500 text-xs mt-1">
                    {editErrors.assigneeId.message}
                  </p>
                )}
              </div>

              <div className="flex items-center mt-4">
                <input
                  type="checkbox"
                  {...registerEdit("isClientVisible")}
                  id="editClientVis"
                  className="h-4 w-4 text-blue-600"
                />
                <label
                  htmlFor="editClientVis"
                  className="ml-2 text-sm text-gray-700"
                >
                  Visible to Client
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded"
                >
                  Update Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL UPLOAD ATTACHMENT (Internal Only) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              Upload Lampiran Pekerjaan
            </h2>
            <form onSubmit={handleUploadAttachment} className="space-y-4">
              {formError && (
                <div className="p-2 bg-red-50 text-red-600 text-sm rounded">
                  {formError}
                </div>
              )}
              <div>
                <label
                  htmlFor="upload-task-url"
                  className="block text-sm font-medium text-gray-700"
                >
                  URL Tautan Pekerjaan (Figma/GitHub/Drive)
                </label>
                <input
                  id="upload-task-url"
                  type="url"
                  required
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  className="mt-1 w-full border p-2 rounded"
                  placeholder="https://..."
                />
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadUrl}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {isUploading ? "Mengunggah..." : "Unggah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
