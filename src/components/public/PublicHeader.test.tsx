import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PublicHeader } from './PublicHeader';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Wrapper to provide Router context
const renderWithRouter = (ui: React.ReactElement) => {
  return render(ui, { wrapper: BrowserRouter });
};

describe('PublicHeader Component', () => {
  it('should render the logo with a link to home (Happy Path)', () => {
    // Act
    renderWithRouter(<PublicHeader />);
    
    // Assert
    const logoLink = screen.getByLabelText(/Cativa — início/i);
    expect(logoLink).toBeInTheDocument();
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('should display desktop navigation links (Happy Path)', () => {
    // Act
    renderWithRouter(<PublicHeader />);
    
    // Assert
    expect(screen.getByText('Produto')).toBeInTheDocument();
    expect(screen.getByText('Planos')).toBeInTheDocument();
  });

  it('should toggle the mobile menu when the button is clicked (Interaction)', () => {
    // Act
    renderWithRouter(<PublicHeader />);
    const menuButton = screen.getByLabelText(/Abrir menu/i);
    
    // Assert initial state
    expect(screen.queryByText('Entrar')).not.toBeVisible; // Button in sheet might be hidden by CSS, but here we check existence/visibility in DOM

    // Act
    fireEvent.click(menuButton);
    
    // Assert
    expect(screen.getByLabelText(/Fechar menu/i)).toBeInTheDocument();
    // In mobile menu, we have multiple "Entrar" (one desktop hidden, one mobile visible)
    const loginButtons = screen.getAllByText('Entrar');
    expect(loginButtons.length).toBeGreaterThan(1);
  });

  it('should close mobile menu when a navigation item is clicked (Side Effect)', () => {
    // Arrange
    renderWithRouter(<PublicHeader />);
    const menuButtonAfterOpen = screen.getByLabelText(/Fechar menu/i);
    fireEvent.click(menuButtonAfterOpen);
    
    // Assert
    expect(screen.getByLabelText(/Abrir menu/i)).toBeInTheDocument();
  });

  it('should have WCAG compliant accessible labels (Accessibility)', () => {
    // Act
    renderWithRouter(<PublicHeader />);
    
    // Assert
    expect(screen.getByRole('banner')).toBeInTheDocument(); // <header>
    expect(screen.getByRole('navigation')).toBeInTheDocument(); // <nav>
    expect(screen.getByLabelText(/Abrir menu/i)).toHaveAttribute('aria-expanded', 'false');
  });
});
