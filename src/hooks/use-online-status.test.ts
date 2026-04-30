import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus } from '../use-online-status';

describe('useOnlineStatus Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Definimos explicitamente o valor inicial do navigator.onLine para garantir determinismo
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true when the browser is online (Happy Path)', () => {
    // Arrange
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    // Act
    const { result } = renderHook(() => useOnlineStatus());

    // Assert
    expect(result.current).toBe(true);
  });

  it('should return false when the browser is offline (Happy Path)', () => {
    // Arrange
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    // Act
    const { result } = renderHook(() => useOnlineStatus());

    // Assert
    expect(result.current).toBe(false);
  });

  it('should update status when "offline" event is triggered (State Transition)', () => {
    // Arrange
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    // Act
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Assert
    expect(result.current).toBe(false);
  });

  it('should update status when "online" event is triggered (State Transition)', () => {
    // Arrange
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    // Act
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Assert
    expect(result.current).toBe(true);
  });

  it('should cleanup event listeners on unmount (Resource Management)', () => {
    // Arrange
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useOnlineStatus());

    // Act
    unmount();

    // Assert
    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});
