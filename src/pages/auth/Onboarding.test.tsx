import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  refresh: vi.fn(),
  setCurrentTenantId: vi.fn(),
  setCurrentUnitId: vi.fn(),
}));

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({ user: null, signUp: mocks.signUp, loading: false }),
}));

vi.mock("@/features/tenant/TenantProvider", () => ({
  useTenant: () => ({
    refresh: mocks.refresh,
    setCurrentTenantId: mocks.setCurrentTenantId,
    setCurrentUnitId: mocks.setCurrentUnitId,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
  },
}));

import Onboarding from "./Onboarding";

describe("Onboarding signup recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("releases the submit button and shows a safe message when signup rejects", async () => {
    mocks.signUp.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Seu Nome"), {
      target: { value: "Pessoa QA" },
    });
    fireEvent.change(screen.getByLabelText("E-mail Profissional"), {
      target: { value: "pessoa@qa.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha de Acesso"), {
      target: { value: "Senha-QA-12345" },
    });
    const submit = screen.getByRole("button", {
      name: /Continuar para Configuração/,
    });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Não foi possível criar a conta",
        {
          description: "Falha de conexão. Verifique sua internet e tente novamente.",
        },
      );
      expect(submit).toBeEnabled();
    });
    expect(screen.getByRole("heading", { name: "Criar sua conta" })).toBeVisible();
  });

  it("resumes the business step if auth verification remounts the wizard", () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/onboarding", state: { setupStep: "business" } },
        ]}
      >
        <Onboarding />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Sobre seu negócio" })).toBeVisible();
  });
});
