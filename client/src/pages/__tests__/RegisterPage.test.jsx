import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import RegisterPage from "../RegisterPage";
import { waitFor } from "@testing-library/react";


vi.mock("../../components/Header", () => ({
  default: () => null
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ login: vi.fn() })
}));

vi.mock("../../utils/api", () => ({
  api: {
    register: vi.fn()
  }
}));

import { api } from "../../utils/api";

describe("RegisterPage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("validates required fields", async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/please complete all fields/i)).toBeInTheDocument();
  });

  it("calls api.register with inputs", async () => {
    api.register.mockResolvedValueOnce({ message: "ok" });

    const { container } = render(
        <MemoryRouter>
        <RegisterPage />
        </MemoryRouter>
    );

    const nameInput = container.querySelector("#registerName");
    const emailInput = container.querySelector("#registerEmail");
    const passInput = container.querySelector('input[placeholder="Create a password"]');
    const confirmInput = container.querySelector('input[placeholder="Confirm the password"]');

    expect(nameInput).toBeTruthy();
    expect(emailInput).toBeTruthy();
    expect(passInput).toBeTruthy();
    expect(confirmInput).toBeTruthy();

    await userEvent.type(nameInput, "Test User");
    await userEvent.type(emailInput, "t@e.com");
    await userEvent.type(passInput, "password123");
    await userEvent.type(confirmInput, "password123");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
        expect(api.register).toHaveBeenCalledTimes(1);
    });
    expect(api.register).toHaveBeenCalledWith("Test User", "t@e.com", "password123");
  });
});
