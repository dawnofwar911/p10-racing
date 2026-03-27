import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LeaderboardSkeleton from '@/components/LeaderboardSkeleton';

describe('LeaderboardSkeleton', () => {
  it('renders 10 skeleton rows', () => {
    const { container } = render(<LeaderboardSkeleton />);
    const skeletonRows = container.querySelectorAll('.skeleton-row');
    expect(skeletonRows).toHaveLength(10);
  });

  it('renders skeleton text and avatar elements', () => {
    const { container } = render(<LeaderboardSkeleton />);
    const skeletonTexts = container.querySelectorAll('.skeleton-text');
    const skeletonAvatars = container.querySelectorAll('.skeleton-avatar');
    expect(skeletonTexts.length).toBeGreaterThan(0);
    expect(skeletonAvatars.length).toBeGreaterThan(0);
  });

  it('renders a skeleton button at the bottom', () => {
    const { container } = render(<LeaderboardSkeleton />);
    const skeletonButton = container.querySelector('.skeleton-button');
    expect(skeletonButton).toBeDefined();
  });
});



