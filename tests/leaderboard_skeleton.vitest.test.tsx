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
    expect(screen.getByText('Pos')).toBeInTheDocument();
    expect(screen.getByText('Player')).toBeInTheDocument();
    expect(screen.getByText('Last Race')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('renders custom columns', () => {
    render(
      <LeaderboardSkeleton 
        columns={[
          { header: 'Rank' },
          { header: 'Points' }
        ]} 
      />
    );
    expect(screen.getByText('Rank')).toBeInTheDocument();
    expect(screen.getByText('Points')).toBeInTheDocument();
    expect(screen.queryByText('Pos')).not.toBeInTheDocument();
  });

  it('renders skeleton text elements', () => {
    const { container } = render(<LeaderboardSkeleton />);
    const skeletonTexts = container.querySelectorAll('.skeleton-text');
    expect(skeletonTexts.length).toBeGreaterThan(0);
  });
});
