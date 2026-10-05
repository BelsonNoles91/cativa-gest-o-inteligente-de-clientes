import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PremiumFooter } from "./PremiumFooter";

describe("PremiumFooter contact details", () => {
  it("keeps the published email contact and never links to a placeholder WhatsApp number", () => {
    render(
      <MemoryRouter>
        <PremiumFooter />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "contato@cativagestao.com.br" }),
    ).toHaveAttribute("href", "mailto:contato@cativagestao.com.br");

    const hrefs = Array.from(document.querySelectorAll<HTMLAnchorElement>("a"), (link) =>
      link.getAttribute("href") ?? "",
    );
    expect(hrefs.some((href) => /wa\.me\/5511999999999/.test(href))).toBe(false);
    expect(screen.queryByText("Falar com Especialista")).not.toBeInTheDocument();
  });
});
