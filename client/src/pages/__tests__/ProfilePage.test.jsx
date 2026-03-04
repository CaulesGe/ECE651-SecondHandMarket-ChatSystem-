import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProfilePage from "../ProfilePage";

vi.mock("../../components/Header", () => ({
  default: () => null
}));

vi.mock("../../components/Footer", () => ({
  default: () => null
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn()
}));

vi.mock("../../utils/api", () => ({
  api: {
    getDrafts: vi.fn()
  },
  formatPrice: (value) => `$${value}`
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/api";

function renderPage(route = "/profile") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProfilePage drafts tab", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockNavigate.mockReset();
  });

  it("opens selected draft in HomePage when clicking Continue Editing", async () => {
    const user = {
      id: "u_profile_1",
      name: "Profile User",
      email: "profile@example.com",
      role: "user"
    };

    useAuth.mockReturnValue({
      user,
      isLoggedIn: true
    });

    api.getDrafts.mockResolvedValue({
      items: [
        {
          id: "d_profile_1",
          title: "Mountain Bike Draft",
          price: 300,
          category: "Sports",
          updatedAt: "2026-03-03T16:00:00.000Z"
        }
      ]
    });

    renderPage();

    await waitFor(() => {
      expect(api.getDrafts).toHaveBeenCalledWith(user);
    });

    await userEvent.click(screen.getByRole("button", { name: /drafts/i }));
    expect(await screen.findByText(/mountain bike draft/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /continue editing/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/?draft=d_profile_1");
  });
});
