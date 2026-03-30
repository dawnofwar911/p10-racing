'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Automatically resets the scroll position of the main scroll container
 * whenever the pathname changes. This mimics native browser behavior
 * for our custom scroll container.
 */
export default function ScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }, [pathname]);

  return null;
}
