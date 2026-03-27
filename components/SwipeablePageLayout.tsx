'use client';

import React, { ReactNode } from 'react';
import { Container, Nav, Row, Col } from 'react-bootstrap';
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
  subtitle?: React.ReactNode;
  icon: ReactNode;
  activeTab: T;
  onTabChange: (tabId: T) => void;
  tabs: TabOption<T>[];
  children?: ReactNode;
  onRefresh?: () => Promise<void>;
  badge?: ReactNode;
  onBack?: () => void;
  rightElement?: ReactNode;
  
  /**
   * If true, large screens will show all tabs side-by-side.
   */
  splitOnWide?: boolean;
  
  /**
   * Optional custom layout for the split view. 
   */
  customSplitLayout?: ReactNode;

  /**
   * Function to render content for a specific tab ID. 
   */
  renderTabContent?: (tabId: T) => ReactNode;

  /**
   * Optional custom column widths for split view (Bootstrap grid units, 1-12).
   * Must match the length of the tabs array.
   */
  splitWidths?: number[];
}

/**
 * A reusable layout component that provides a standardized F1-styled header,
 * tab switcher, and horizontal swipe navigation between views.
 * Supports a Split-Pane view for large screens (Foldables/Tablets).
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
  onBack,
  rightElement,
  splitOnWide = false,
  customSplitLayout,
  renderTabContent,
  splitWidths
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

  const header = (
    <StandardPageHeader
      title={title}
      subtitle={subtitle}
      icon={icon}
      badge={badge}
      onBack={onBack}
      rightElement={rightElement}
    />
  );

  const mainContent = (
    <>
      {/* 2. Standardized F1 Tab Switcher (Hidden on split view) */}
      <div className={`mb-4 ${splitOnWide ? 'd-lg-none' : ''}`}>
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

      {/* 3. Content Area */}
      <div className="flex-grow-1 d-flex flex-column">
        {/* LARGE SCREEN: Split Pane View */}
        {splitOnWide && (
          <div className="d-none d-lg-block w-100">
            {customSplitLayout || (
              <Row>
                {tabs.map((tab, idx) => (
                  <Col key={tab.id} lg={splitWidths?.[idx] || (12 / tabs.length)} className="mb-4">
                    <div className="f1-dashboard-pane">
                      <h3 className="h6 text-uppercase fw-bold text-muted mb-3 letter-spacing-1 d-flex align-items-center">
                        {tab.icon && <span className="me-2 text-danger">{tab.icon}</span>}
                        {tab.label}
                      </h3>
                      {renderTabContent ? renderTabContent(tab.id) : (children || null)}
                    </div>
                  </Col>
                ))}
              </Row>
            )}
          </div>
        )}

        {/* MOBILE & FALLBACK: Swipeable View */}
        <div className={splitOnWide ? 'd-lg-none' : 'w-100'}>
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
              {renderTabContent ? renderTabContent(activeTab) : (children || null)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );

  return (
    <Container className="mt-2 mt-md-3 mb-4" style={{ maxWidth: splitOnWide ? '1400px' : '800px' }}>
      {header}
      {onRefresh ? (
        <PullToRefresh onRefresh={onRefresh}>
          <div className="ptr-content-wrapper">
            {mainContent}
          </div>
        </PullToRefresh>
      ) : mainContent}
    </Container>
  );
}
