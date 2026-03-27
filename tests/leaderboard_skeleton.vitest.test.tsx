import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LeaderboardSkeleton from '@/components/LeaderboardSkeleton';

describe('LeaderboardSkeleton', () => {
  it('renders 10 skeleton rows', () => {
    const { container } = render(<LeaderboardSkeleton />);
    const skeletonRows = container.querySelectorAll('.skeleton-row');
    expect(skeletonRows).toHaveLength(10);
  });

  it('renders correct table headers', () => {
    render(<LeaderboardSkeleton />);
    expect(screen.getByText('Pos')).toBeDefined();
    expect(screen.getByText('Player')).toBeDefined();
    expect(screen.getByText('Last Race')).toBeDefined();
    expect(screen.getByText('Total')).toBeDefined();
  });

  it('renders skeleton text elements', () => {
    const { container } = render(<LeaderboardSkeleton />);
    const skeletonTexts = container.querySelectorAll('.skeleton-text');
    expect(skeletonTexts.length).toBeGreaterThan(0);
  });
});
