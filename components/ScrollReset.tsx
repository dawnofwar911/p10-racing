'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { MAIN_SCROLL_CONTAINER_ID } from '@/lib/navigation';

/**
 * Automatically resets the scroll position of the main scroll container
 * whenever the pathname or search parameters change. 
 * This mimics native browser behavior for our custom scroll container.
 */
export default function ScrollReset() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const scrollContainer = document.getElementById(MAIN_SCROLL_CONTAINER_ID);
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }, [pathname, searchParams]);

  return null;
}
