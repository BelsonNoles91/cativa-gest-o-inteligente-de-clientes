import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarProvider, SidebarMenu } from "@/components/ui/sidebar";
import { LayoutDashboard } from "lucide-react";
import { describe, it, expect, vi } from "vitest";

// Mock useNavigate
const mockedUsedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedUsedNavigate,
  };
});

const renderWithContext = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <SidebarProvider>
        <SidebarMenu>
          {ui}
        </SidebarMenu>
      </SidebarProvider>
    </BrowserRouter>
  );
};

describe("SidebarNavItem", () => {
  it("renders correctly with label", () => {
    renderWithContext(
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
    renderWithContext(
      <SidebarNavItem 
        to="/dashboard" 
        label="Dashboard" 
        icon={LayoutDashboard} 
        isActive={true} 
      />
    );
    const link = screen.getByRole("menuitem");
    expect(link).toHaveAttribute("data-active", "true");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("navigates on click and shows loading state", () => {
    renderWithContext(
      <SidebarNavItem 
        to="/dashboard" 
        label="Dashboard" 
        icon={LayoutDashboard} 
        isActive={false} 
      />
    );
    const link = screen.getByRole("menuitem");
    fireEvent.click(link);
    
    expect(mockedUsedNavigate).toHaveBeenCalledWith("/dashboard");
    expect(link).toHaveAttribute("data-loading", "true");
    expect(screen.getByText("Carregando...")).toBeInTheDocument();
  });

  it("prevents navigation when locked", () => {
    mockedUsedNavigate.mockClear();
    renderWithContext(
      <SidebarNavItem 
        to="/admin" 
        label="Admin" 
        icon={LayoutDashboard} 
        isActive={false} 
        locked={true}
      />
    );
    const link = screen.getByRole("menuitem");
    fireEvent.click(link);
    
    expect(mockedUsedNavigate).not.toHaveBeenCalled();
    expect(link).toHaveAttribute("aria-disabled", "true");
  });

  it("supports keyboard navigation (Enter)", () => {
    mockedUsedNavigate.mockClear();
    renderWithContext(
      <SidebarNavItem 
        to="/settings" 
        label="Settings" 
        icon={LayoutDashboard} 
        isActive={false} 
      />
    );
    const link = screen.getByRole("menuitem");
    fireEvent.keyDown(link, { key: "Enter", code: "Enter" });
    
    expect(mockedUsedNavigate).toHaveBeenCalledWith("/settings");
  });
});
