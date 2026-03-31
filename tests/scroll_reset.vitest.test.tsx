import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import ScrollReset from '@/components/ScrollReset';
import MobileBottomNav from '@/components/MobileBottomNav';
import { MAIN_SCROLL_CONTAINER_ID } from '@/lib/navigation';

// Mock Next.js navigation
const mockPush = vi.fn();
const mockPathname = { value: '/' };
const mockSearchParams = { value: new URLSearchParams() };

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams.value,
}));

// Mock Auth
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    session: null,
    currentUser: null,
    isAdmin: false,
    isAuthLoading: false,
    logout: vi.fn(),
  }),
}));

describe('Scroll and Navigation Stability', () => {
  let scrollContainer: HTMLDivElement;

  beforeEach(() => {
    // Setup scroll container
    scrollContainer = document.createElement('div');
    scrollContainer.id = MAIN_SCROLL_CONTAINER_ID;
    document.body.appendChild(scrollContainer);
    
    // Mock scrollTo
    scrollContainer.scrollTo = vi.fn().mockImplementation((options) => {
      if (typeof options === 'object') {
        scrollContainer.scrollTop = options.top || 0;
      }
    });
  });

  afterEach(() => {
    document.body.removeChild(scrollContainer);
    vi.clearAllMocks();
  });

  it('ScrollReset should reset scrollTop when pathname changes', () => {
    scrollContainer.scrollTop = 500;
    
    const { rerender } = render(<ScrollReset />);
    
    // Change pathname and rerender
    mockPathname.value = '/predict';
    rerender(<ScrollReset />);
    
    expect(scrollContainer.scrollTop).toBe(0);
  });

  it('ScrollReset should reset scrollTop when searchParams change', () => {
    scrollContainer.scrollTop = 300;
    
    const { rerender } = render(<ScrollReset />);
    
    // Change search params and rerender
    mockSearchParams.value = new URLSearchParams('?id=123');
    rerender(<ScrollReset />);
    
    expect(scrollContainer.scrollTop).toBe(0);
  });

  it('MobileBottomNav should scroll to top when clicking active item', async () => {
    mockPathname.value = '/leagues';
    scrollContainer.scrollTop = 1000;
    
    const { getByText } = render(<MobileBottomNav />);
    
    // Find the Leagues link (which is active)
    const leaguesLink = getByText('Leagues').closest('a')!;
    
    await act(async () => {
      fireEvent.click(leaguesLink);
    });
    
    expect(scrollContainer.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(scrollContainer.scrollTop).toBe(0);
  });

  it('MobileBottomNav should NOT scroll to top when clicking inactive item', async () => {
    mockPathname.value = '/';
    scrollContainer.scrollTop = 1000;
    
    const { getByText } = render(<MobileBottomNav />);
    
    // Click Leaderboard (inactive)
    const leaderboardLink = getByText('Leaderboard').closest('a')!;
    
    await act(async () => {
      fireEvent.click(leaderboardLink);
    });
    
    // Should NOT have called scrollTo yet (navigation happens via Link)
    expect(scrollContainer.scrollTo).not.toHaveBeenCalled();
    expect(scrollContainer.scrollTop).toBe(1000);
  });
});
