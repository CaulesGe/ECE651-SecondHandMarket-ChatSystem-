import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import HomePage from "../HomePage";

vi.mock("../../components/Header", () => ({
  default: () => null
}));

vi.mock("../../components/Footer", () => ({
  default: () => null
}));

vi.mock("../../components/ProductCard", () => ({
  default: ({ item }) => <div data-testid="product-card">{item?.title || "Product"}</div>
}));

vi.mock("../../components/CartPanel", () => ({
  default: () => null
}));

vi.mock("../../components/DraftPanel", () => ({
  default: () => null
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn()
}));

vi.mock("../../context/CartContext", () => ({
  useCart: vi.fn()
}));

vi.mock("../../utils/api", () => ({
  api: {
    getGoods: vi.fn(),
    getCategories: vi.fn(),
    getDrafts: vi.fn(),
    uploadGoodImage: vi.fn(),
    createGood: vi.fn(),
    saveDraft: vi.fn(),
    deleteDraft: vi.fn()
  }
}));

import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { api } from "../../utils/api";

const originalIntersectionObserver = globalThis.IntersectionObserver;

class MockIntersectionObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

function setupMocks() {
  const user = {
    id: "u_listing_1",
    role: "user",
    name: "Listing User",
    email: "listing@example.com",
    token: "fake-token"
  };

  useAuth.mockReturnValue({ user, isLoggedIn: true });
  useCart.mockReturnValue({ recentlyViewed: [], clearRecentlyViewed: vi.fn() });

  return user;
}

function renderPage(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("HomePage listing flow", () => {
  beforeAll(() => {
    globalThis.IntersectionObserver = MockIntersectionObserver;
  });

  afterAll(() => {
    globalThis.IntersectionObserver = originalIntersectionObserver;
  });

  beforeEach(() => {
    vi.resetAllMocks();

    api.getGoods.mockResolvedValue({ items: [] });
    api.getCategories.mockResolvedValue({ categories: ["Electronics", "Home"] });
    api.getDrafts.mockResolvedValue({ items: [] });
    api.uploadGoodImage.mockResolvedValue({ url: "/api/uploads/goods/cover.jpg" });
    api.createGood.mockResolvedValue({ item: { id: "g_new_1" } });
    api.saveDraft.mockResolvedValue({
      draft: {
        id: "d_1",
        title: "Draft Lamp",
        category: "Electronics",
        price: 120,
        condition: "Like New",
        description: "",
        images: [],
        updatedAt: "2026-03-03T15:00:00.000Z"
      }
    });
    api.deleteDraft.mockResolvedValue(true);
  });

  it("publishes a product by calling api.createGood", async () => {
    const user = setupMocks();
    renderPage();

    const titleInput = await screen.findByPlaceholderText(/vintage lamp, winter jacket/i);
    await userEvent.type(titleInput, "Desk Lamp");
    await userEvent.type(screen.getByPlaceholderText("0.00"), "120");
    await userEvent.type(screen.getByPlaceholderText(/describe your item/i), "Minimal wear.");

    await userEvent.click(screen.getByRole("button", { name: /publish listing/i }));

    await waitFor(() => {
      expect(api.createGood).toHaveBeenCalledTimes(1);
    });
    expect(api.createGood).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Desk Lamp",
        price: 120,
        condition: "Like New",
        category: "Electronics",
        description: "Minimal wear.",
        images: []
      }),
      user
    );
    expect(await screen.findByText(/listing published successfully/i)).toBeInTheDocument();
  });

  it("saves current listing input as draft by calling api.saveDraft", async () => {
    const user = setupMocks();
    renderPage();

    const titleInput = await screen.findByPlaceholderText(/vintage lamp, winter jacket/i);
    await userEvent.type(titleInput, "Draft Lamp");
    await userEvent.click(screen.getByRole("button", { name: /save as draft/i }));

    await waitFor(() => {
      expect(api.saveDraft).toHaveBeenCalledTimes(1);
    });
    expect(api.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Draft Lamp",
        condition: "Like New",
        category: "Electronics",
        images: [],
        location: "Waterloo, ON"
      }),
      user
    );
    expect(await screen.findByText(/draft saved successfully/i)).toBeInTheDocument();
  });
});
