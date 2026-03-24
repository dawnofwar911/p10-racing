import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import HapticButton from '@/components/HapticButton';
import HapticLink from '@/components/HapticLink';
import { triggerLightHaptic, triggerMediumHaptic, triggerHeavyHaptic } from '@/lib/utils/haptics';

// Mock haptics
vi.mock('@/lib/utils/haptics', () => ({
  triggerLightHaptic: vi.fn(),
  triggerMediumHaptic: vi.fn(),
  triggerHeavyHaptic: vi.fn(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, onClick, ...props }: any) => (
    <a 
      {...props} 
      onClick={(e) => { 
        e.preventDefault(); // Stop JSDOM from trying to navigate
        onClick && onClick(e); 
      }}
    >
      {children}
    </a>
  ),
}));

describe('Haptic Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HapticButton', () => {
    it('triggers light haptic by default on click', () => {
      const { getByText } = render(<HapticButton>Click me</HapticButton>);
      fireEvent.click(getByText('Click me'));
      expect(triggerLightHaptic).toHaveBeenCalled();
    });

    it('triggers medium haptic when specified', () => {
      const { getByText } = render(<HapticButton hapticStyle="medium">Medium</HapticButton>);
      fireEvent.click(getByText('Medium'));
      expect(triggerMediumHaptic).toHaveBeenCalled();
    });

    it('triggers heavy haptic when specified', () => {
      const { getByText } = render(<HapticButton hapticStyle="heavy">Heavy</HapticButton>);
      fireEvent.click(getByText('Heavy'));
      expect(triggerHeavyHaptic).toHaveBeenCalled();
    });

    it('calls original onClick handler', () => {
      const onClick = vi.fn();
      const { getByText } = render(<HapticButton onClick={onClick}>Handler</HapticButton>);
      fireEvent.click(getByText('Handler'));
      expect(onClick).toHaveBeenCalled();
      expect(triggerLightHaptic).toHaveBeenCalled();
    });
  });

  describe('HapticLink', () => {
    it('triggers light haptic by default on click', () => {
      const { getByText } = render(<HapticLink href="/test">Link</HapticLink>);
      fireEvent.click(getByText('Link'));
      expect(triggerLightHaptic).toHaveBeenCalled();
    });

    it('triggers specified haptic style', () => {
      const { getByText } = render(<HapticLink href="/test" hapticStyle="medium">Medium Link</HapticLink>);
      fireEvent.click(getByText('Medium Link'));
      expect(triggerMediumHaptic).toHaveBeenCalled();
    });

    it('calls original onClick if provided', () => {
      const onClick = vi.fn();
      const { getByText } = render(<HapticLink href="/test" onClick={onClick}>Click Link</HapticLink>);
      fireEvent.click(getByText('Click Link'));
      expect(onClick).toHaveBeenCalled();
      expect(triggerLightHaptic).toHaveBeenCalled();
    });
  });
});
