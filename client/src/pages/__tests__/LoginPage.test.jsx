import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "../LoginPage";

vi.mock("../../components/Header", () => ({
  default: () => null
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ login: vi.fn() })
}));

vi.mock("../../utils/api", () => ({
  api: {
    login: vi.fn(),
    resendVerification: vi.fn()
  }
}));

import { api } from "../../utils/api";

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows validation message when fields empty", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/please enter your email and password/i)).toBeInTheDocument();
  });

  it("shows resend button when EMAIL_NOT_VERIFIED", async () => {
    api.login.mockRejectedValueOnce(Object.assign(new Error("Please verify your email before logging in."), { code: "EMAIL_NOT_VERIFIED" }));

    renderPage();
    await userEvent.type(screen.getByLabelText(/email address/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/please verify your email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeInTheDocument();
  });

  it("calls resendVerification when clicking resend", async () => {
    api.login.mockRejectedValueOnce(Object.assign(new Error("Please verify your email before logging in."), { code: "EMAIL_NOT_VERIFIED" }));
    api.resendVerification.mockResolvedValueOnce({ message: "sent" });

    renderPage();
    await userEvent.type(screen.getByLabelText(/email address/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await userEvent.click(screen.getByRole("button", { name: /resend verification email/i }));
    expect(api.resendVerification).toHaveBeenCalledWith("a@b.com");
  });
});