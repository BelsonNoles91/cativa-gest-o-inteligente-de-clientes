import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { SidebarNavItem } from "./SidebarNavItem";
import { LayoutDashboard } from "lucide-react";
import { describe, it, expect } from "vitest";

const renderWithRouter = (ui: React.ReactElement) => {
  return render(ui, { wrapper: BrowserRouter });
};

describe("SidebarNavItem", () => {
  it("renders correctly with label", () => {
    renderWithRouter(
      <SidebarNavItem 
        to="/dashboard" 
        label="Dashboard" 
        icon={LayoutDashboard} 
        isActive={false} 
      />
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows active state style", () => {
    renderWithRouter(
      <SidebarNavItem 
        to="/dashboard" 
        label="Dashboard" 
        icon={LayoutDashboard} 
        isActive={true} 
      />
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("data-active", "true");
  });
});
