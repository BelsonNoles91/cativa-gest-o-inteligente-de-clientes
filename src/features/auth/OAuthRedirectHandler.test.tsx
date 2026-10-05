import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { OAuthRedirectHandler } from "@/features/auth/OAuthRedirectHandler";

const authState = vi.hoisted(() => ({ user: { id: "test-user" } as { id: string } | null, loading: false }));

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => authState,
}));

function CurrentPath() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}{location.search}{location.hash}</output>;
}

function renderHandler() {
  return render(
    <MemoryRouter initialEntries={["/auth/login"]}>
      <OAuthRedirectHandler />
      <CurrentPath />
    </MemoryRouter>,
  );
}

describe("OAuthRedirectHandler", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    authState.user = { id: "test-user" };
    authState.loading = false;
  });

  afterEach(cleanup);

  it("navigates to an approved same-origin target and consumes it", async () => {
    window.sessionStorage.setItem("cativa:auth_redirect", "/app/agenda?view=week#today");

    renderHandler();

    await waitFor(() => expect(screen.getByTestId("current-path").textContent)
      .toBe("/app/agenda?view=week#today"));
    expect(window.sessionStorage.getItem("cativa:auth_redirect")).toBeNull();
  });

  it("does not navigate to a backslash-normalized external origin", async () => {
    window.sessionStorage.setItem("cativa:auth_redirect", "/\\attacker.example/collect");

    renderHandler();

    await waitFor(() => expect(screen.getByTestId("current-path").textContent).toBe("/auth/login"));
    expect(window.sessionStorage.getItem("cativa:auth_redirect")).toBeNull();
  });
});
