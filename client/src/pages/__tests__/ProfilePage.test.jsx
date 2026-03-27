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
    getProfile: vi.fn(),
    getMyPurchaseHistory: vi.fn(),
    deleteDraft: vi.fn(),
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

function renderPage(route = { pathname: "/profile" }) {
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
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
  });

  it("opens the drafts tab from navigation state and continues editing a selected draft", async () => {
    const user = {
      id: "u_profile_1",
      name: "Profile User",
      email: "profile@example.com",
      role: "user"
    };

    useAuth.mockReturnValue({
      user,
      isLoggedIn: true,
      updateUser: vi.fn()
    });

    api.getProfile.mockResolvedValue({
      profile: {
        name: user.name,
        email: user.email,
        address: "",
        phone: "",
        gender: ""
      }
    });
    api.getMyPurchaseHistory.mockResolvedValue({ items: [] });
    api.getDrafts.mockResolvedValue({
      items: [
        {
          id: "d_profile_1",
          title: "Mountain Bike Draft",
          price: 300,
          category: "Sports",
          condition: "Like New",
          description: "Needs a better saddle photo.",
          updatedAt: "2026-03-03T16:00:00.000Z"
        }
      ]
    });

    renderPage({ pathname: "/profile", state: { openTab: "drafts" } });

    expect(await screen.findByText(/mountain bike draft/i)).toBeInTheDocument();
    expect(api.getDrafts).toHaveBeenCalledWith(user);

    await userEvent.click(screen.getByRole("button", { name: /continue editing/i }));
    expect(mockNavigate).toHaveBeenLastCalledWith("/?draft=d_profile_1");
  });

  it("deletes a draft from the profile drafts tab", async () => {
    const user = {
      id: "u_profile_2",
      name: "Profile User",
      email: "profile@example.com",
      role: "user"
    };

    useAuth.mockReturnValue({
      user,
      isLoggedIn: true,
      updateUser: vi.fn()
    });

    api.getProfile.mockResolvedValue({
      profile: {
        name: user.name,
        email: user.email,
        address: "",
        phone: "",
        gender: ""
      }
    });
    api.getMyPurchaseHistory.mockResolvedValue({ items: [] });
    api.getDrafts.mockResolvedValue({
      items: [
        {
          id: "d_profile_2",
          title: "Desk Lamp Draft",
          price: 45,
          category: "Home",
          condition: "Used",
          updatedAt: "2026-03-04T12:00:00.000Z"
        }
      ]
    });
    api.deleteDraft.mockResolvedValue(true);

    renderPage({ pathname: "/profile", state: { openTab: "drafts" } });

    expect(await screen.findByText(/desk lamp draft/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /delete draft/i }));

    expect(window.confirm).toHaveBeenCalledWith("Delete this draft?");
    expect(api.deleteDraft).toHaveBeenCalledWith("d_profile_2", user);

    await waitFor(() => {
      expect(screen.queryByText(/desk lamp draft/i)).not.toBeInTheDocument();
    });
  });
});
