import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import StandardPageHeader from '@/components/StandardPageHeader';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('StandardPageHeader', () => {
  it('renders title and icon correctly', () => {
    const { getByText, getByTestId } = render(
      <StandardPageHeader 
        title="Test Title" 
        icon={<span data-testid="mock-icon">Icon</span>} 
      />
    );
    expect(getByText('Test Title')).toBeDefined();
    expect(getByTestId('mock-icon')).toBeDefined();
  });

  it('renders subtitle when provided', () => {
    const { getByText } = render(
      <StandardPageHeader 
        title="Title" 
        subtitle="Test Subtitle" 
        icon={<span>Icon</span>}
      />
    );
    expect(getByText('Test Subtitle')).toBeDefined();
  });

  it('renders rightElement when provided', () => {
    const { getByText } = render(
      <StandardPageHeader 
        title="Title" 
        rightElement={<button>Action</button>} 
        icon={<span>Icon</span>}
      />
    );
    expect(getByText('Action')).toBeDefined();
  });

  it('applies sticky class by default', () => {
    const { container } = render(<StandardPageHeader title="Sticky" icon={<span>Icon</span>} />);
    expect(container.querySelector('.sticky-header')).toBeDefined();
  });
});
