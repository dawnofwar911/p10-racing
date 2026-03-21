'use client';

import React, { ReactNode } from 'react';
import { Container, Nav } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerMediumHaptic } from '@/lib/utils/haptics';
import PullToRefresh from '@/components/PullToRefresh';
import StandardPageHeader from './StandardPageHeader';

const SWIPE_THRESHOLD = 30;
const VELOCITY_THRESHOLD = 200;

export interface TabOption<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

interface SwipeablePageLayoutProps<T extends string> {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  activeTab: T;
  onTabChange: (tabId: T) => void;
  tabs: TabOption<T>[];
  children: ReactNode;
  onRefresh?: () => Promise<void>;
  badge?: ReactNode;
  onBack?: () => void;
}

/**
 * A reusable layout component that provides a standardized F1-styled header,
 * tab switcher, and horizontal swipe navigation between views.
 */
export default function SwipeablePageLayout<T extends string>({
  title,
  subtitle,
  icon,
  activeTab,
  onTabChange,
  tabs,
  children,
  onRefresh,
  badge,
  onBack
}: SwipeablePageLayoutProps<T>) {
  
  const handleTabChange = (tabId: T) => {
    if (tabId !== activeTab) {
      triggerMediumHaptic();
      onTabChange(tabId);
    }
  };

  const swipeHandlers = {
    onDragEnd: (event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => {
      const { offset, velocity } = info;
      const isRightSwipe = offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD;
      const isLeftSwipe = offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD;

      const currentIndex = tabs.findIndex(t => t.id === activeTab);

      if (isRightSwipe && currentIndex > 0) {
        handleTabChange(tabs[currentIndex - 1].id as T);
      } else if (isLeftSwipe && currentIndex < tabs.length - 1) {
        handleTabChange(tabs[currentIndex + 1].id as T);
      }
    }
  };

  const content = (
    <Container className="mt-4 mb-4 overflow-hidden">
      {/* 1. Standardized F1 Header */}
      <StandardPageHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        badge={badge}
        onBack={onBack}
      />

      {/* 2. Standardized F1 Tab Switcher */}
      <div className="mb-4">
        <Nav variant="pills" className="f1-tab-container p-1 bg-dark rounded-pill border border-secondary" style={{ width: 'fit-content' }}>
          {tabs.map((tab) => (
            <Nav.Item key={tab.id}>
              <Nav.Link 
                active={activeTab === tab.id} 
                onClick={() => handleTabChange(tab.id)}
                className="rounded-pill px-4 py-2 d-flex align-items-center"
              >
                {tab.icon && <span className="me-2 d-flex align-items-center">{tab.icon}</span>}
                {tab.label}
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>
      </div>

      {/* 3. Swipeable Content Area */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: tabs.findIndex(t => t.id === activeTab) === 0 ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: tabs.findIndex(t => t.id === activeTab) === 0 ? -20 : 20 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={swipeHandlers.onDragEnd}
          className="w-100 flex-grow-1 d-flex flex-column"
          style={{ minHeight: 'calc(100vh - 250px)' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </Container>
  );

  if (onRefresh) {
    return <PullToRefresh onRefresh={onRefresh}>{content}</PullToRefresh>;
  }

  return content;
}
