import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProductPage from "../ProductPage";

// --- Component mocks (match LoginPage style) ---
vi.mock("../../components/Header", () => ({
  default: () => null
}));

vi.mock("../../components/Footer", () => ({
  default: () => null
}));

vi.mock("../../components/ProductCard", () => ({
  default: ({ item }) => (
    <div data-testid="product-card">
      {item?.title ?? "ProductCard"}
    </div>
  )
}));

// --- Context mocks ---
vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn()
}));

vi.mock("../../context/CartContext", () => ({
  useCart: vi.fn()
}));

vi.mock("../../context/ChatContext", () => ({
  useChat: vi.fn()
}));

// --- API mock ---
vi.mock("../../utils/api", () => ({
  api: {
    getGood: vi.fn(),
    getRecommendations: vi.fn()
  },
  formatPrice: (n) => String(n)
}));

import { api } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useChat } from "../../context/ChatContext";

// --- navigate mock (ProductPage uses useNavigate) ---
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const baseProduct = {
  id: "123",
  title: "Test Product",
  price: 25,
  condition: "Good",
  category: "Electronics",
  sellerName: "Alice",
  sellerId: "seller-1",
  location: "Waterloo",
  listedAt: "2024-01-01T00:00:00.000Z",
  description: "Great condition",
  images: []
};

function setupMocks({
  isLoggedIn = true,
  user = { id: "buyer-1" },
  cart = [],
  recentlyViewed = []
} = {}) {
  useAuth.mockReturnValue({ user, isLoggedIn });

  const addToCart = vi.fn();
  const addToRecentlyViewed = vi.fn();

  useCart.mockReturnValue({
    cart,
    addToCart,
    addToRecentlyViewed,
    recentlyViewed
  });

  const createConversation = vi.fn();
  useChat.mockReturnValue({ createConversation });

  return { addToCart, addToRecentlyViewed, createConversation };
}

function renderPage(route = "/product/123") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/product/:id" element={<ProductPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProductPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockNavigate.mockReset();
    vi.useRealTimers();
  });

  it("shows 'Product not found' when api.getGood fails", async () => {
    setupMocks({ isLoggedIn: true });
    api.getGood.mockRejectedValueOnce(new Error("Not found"));
    api.getRecommendations.mockResolvedValueOnce({ items: [] });

    renderPage();

    expect(await screen.findByRole("heading", { name: /product not found/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to home/i })).toBeInTheDocument();
  });

  it("disables purchase buttons and shows login notice when not logged in", async () => {
    setupMocks({ isLoggedIn: false, user: null });
    api.getGood.mockResolvedValueOnce({ item: baseProduct });
    api.getRecommendations.mockResolvedValueOnce({ items: [] });

    renderPage();

    expect(await screen.findByRole("heading", { name: /test product/i })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /add to cart/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /buy now/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /message seller/i })).toBeDisabled();

    expect(screen.getByText(/please login or register to purchase/i)).toBeInTheDocument();
  });

  it("adds item to cart and shows feedback when clicking Add to Cart (logged in)", async () => {
    const { addToCart } = setupMocks({ isLoggedIn: true, cart: [] });
    api.getGood.mockResolvedValueOnce({ item: baseProduct });
    api.getRecommendations.mockResolvedValueOnce({ items: [] });

    renderPage();

    expect(await screen.findByRole("heading", { name: /test product/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(addToCart).toHaveBeenCalledTimes(1);
    expect(addToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        id: baseProduct.id,
        title: baseProduct.title,
        price: baseProduct.price,
        condition: baseProduct.condition,
        sellerName: baseProduct.sellerName,
        location: baseProduct.location
      })
    );

    expect(await screen.findByText(/added to cart!/i)).toBeInTheDocument();
  });

  it("Buy Now adds to cart if not already there and navigates to /payment", async () => {
    const { addToCart } = setupMocks({ isLoggedIn: true, cart: [] });
    api.getGood.mockResolvedValueOnce({ item: baseProduct });
    api.getRecommendations.mockResolvedValueOnce({ items: [] });

    renderPage();

    expect(await screen.findByRole("heading", { name: /test product/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /buy now/i }));

    expect(addToCart).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/payment");
  });

  it("Message Seller shows error when seller linkage missing", async () => {
    setupMocks({ isLoggedIn: true, user: { id: "buyer-1" } });

    const productNoSeller = { ...baseProduct, sellerId: null, seller: null };
    api.getGood.mockResolvedValueOnce({ item: productNoSeller });
    api.getRecommendations.mockResolvedValueOnce({ items: [] });

    renderPage();

    expect(await screen.findByRole("heading", { name: /test product/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /message seller/i }));

    expect(
      await screen.findByText(/messaging is unavailable.*seller account linkage is missing/i)
    ).toBeInTheDocument();
  });

  it("Message Seller blocks starting a conversation with yourself", async () => {
    setupMocks({ isLoggedIn: true, user: { id: "seller-1" } });

    api.getGood.mockResolvedValueOnce({ item: baseProduct }); // sellerId === user.id
    api.getRecommendations.mockResolvedValueOnce({ items: [] });

    renderPage();

    expect(await screen.findByRole("heading", { name: /test product/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /message seller/i }));

    expect(await screen.findByText(/you cannot start a conversation with yourself/i)).toBeInTheDocument();
  });

  it("Message Seller calls createConversation and navigates to /chat after success", async () => {

    const { createConversation } = setupMocks({
      isLoggedIn: true,
      user: { id: "buyer-1" }
    });

    createConversation.mockResolvedValueOnce({});
    api.getGood.mockResolvedValueOnce({ item: baseProduct });
    api.getRecommendations.mockResolvedValueOnce({ items: [] });

    renderPage();

    expect(await screen.findByRole("heading", { name: /test product/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /message seller/i }));

    expect(createConversation).toHaveBeenCalledWith("seller-1", { contextItemId: "123" });
    expect(await screen.findByText(/conversation ready.*redirecting to chat/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/chat");
    });
  });

  it("renders recommendations section when api returns items", async () => {
    setupMocks({ isLoggedIn: true });
    api.getGood.mockResolvedValueOnce({ item: baseProduct });
    api.getRecommendations.mockResolvedValueOnce({
      items: [{ id: "r1", title: "Rec 1" }, { id: "r2", title: "Rec 2" }]
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: /test product/i })).toBeInTheDocument();
    expect(await screen.findByText(/customers also viewed/i)).toBeInTheDocument();

    const cards = await screen.findAllByTestId("product-card");
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Rec 1")).toBeInTheDocument();
    expect(screen.getByText("Rec 2")).toBeInTheDocument();
  });

  it("renders product details after loading", async () => {
    setupMocks({ isLoggedIn: true });
    api.getGood.mockResolvedValueOnce({ item: baseProduct });
    api.getRecommendations.mockResolvedValueOnce({ items: [] });

    renderPage();

    // Wait for product title to appear
    expect(await screen.findByRole("heading", { name: /test product/i })).toBeInTheDocument();
    expect(screen.getByText(/seller:/i)).toBeInTheDocument();
    expect(screen.getByText(/alice/i)).toBeInTheDocument();
    expect(screen.getByText(/location:/i)).toBeInTheDocument();
    expect(screen.getByText(/waterloo/i)).toBeInTheDocument();

    // Should show action buttons
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /buy now/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /message seller/i })).toBeInTheDocument();
  });
});