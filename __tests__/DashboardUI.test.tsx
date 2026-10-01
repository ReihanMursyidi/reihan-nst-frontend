import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "../src/app/page";

vi.mock("@/lib/axios", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}));

// Mock useRouter dan useAuthStore agar komponen bisa di-render terisolasi
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/store/useAuthStore", () => ({
  useAuthStore: () => ({
    user: { name: "Reihan Mursyidi", role: "PM" },
    logout: vi.fn(),
  }),
}));

describe("Dashboard Component Tests", () => {
  it("Must render Dashboard UI and display Create Task button for PM", () => {
    render(<DashboardPage />);

    return waitFor(() => {
      expect(screen.getByText(/Reihan Mursyidi/i)).not.toBeNull();
      expect(screen.getByText(/Role: PM/i)).not.toBeNull();
      expect(screen.getByText(/\+ Create New Task/i)).not.toBeNull();
    });
  });
});
