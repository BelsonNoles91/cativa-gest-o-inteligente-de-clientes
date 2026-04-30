import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../use-performance';

describe('useDebounce Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately (Happy Path)', () => {
    // Act
    const { result } = renderHook(() => useDebounce('initial', 500));

    // Assert
    expect(result.current).toBe('initial');
  });

  it('should update value after delay (Happy Path)', () => {
    // Arrange
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 500 }
    });

    // Act
    rerender({ value: 'updated', delay: 500 });
    
    // Assert before timeout
    expect(result.current).toBe('initial');

    // Act
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Assert after timeout
    expect(result.current).toBe('updated');
  });

  it('should clear existing timeout when value changes rapidly (Stress Test)', () => {
    // Arrange
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 500 }
    });

    // Act
    rerender({ value: 'first change', delay: 500 });
    act(() => {
      vi.advanceTimersByTime(300); // 200ms left
    });
    
    rerender({ value: 'second change', delay: 500 });
    
    act(() => {
      vi.advanceTimersByTime(300); // Should not update yet because timer was reset
    });

    // Assert
    expect(result.current).toBe('initial');

    // Act
    act(() => {
      vi.advanceTimersByTime(200); // Now it should update
    });

    // Assert
    expect(result.current).toBe('second change');
  });

  it('should cleanup timeout on unmount (Memory Safety)', () => {
    // Arrange
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const { unmount, rerender } = renderHook(({ value }) => useDebounce(value, 500), {
      initialProps: { value: 'initial' }
    });

    // Act
    rerender({ value: 'updated' });
    unmount();

    // Assert
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
