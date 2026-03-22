'use client';

import React, { ReactNode } from 'react';
import { Row, Col } from 'react-bootstrap';
import { ChevronLeft } from 'lucide-react';
import HapticButton from './HapticButton';

interface StandardPageHeaderProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  badge?: ReactNode;
  onBack?: () => void;
  rightElement?: ReactNode;
}

/**
 * A reusable F1-styled page header with a circular icon, title, optional subtitle,
 * badge, and back button.
 */
export default function StandardPageHeader({
  title,
  subtitle,
  icon,
  badge,
  onBack,
  rightElement
}: StandardPageHeaderProps) {
  return (
    <Row className="mb-4 align-items-center">
      <Col xs={rightElement ? 12 : true} md={rightElement ? 7 : true}>
        <div className="d-flex align-items-center">
          {onBack && (
            <HapticButton 
              variant="link" 
              className="text-white p-0 me-3 opacity-75 hover-opacity-100 border-0 d-flex align-items-center"
              onClick={onBack}
            >
              <ChevronLeft size={28} />
            </HapticButton>
          )}
          <div className="bg-danger rounded-3 p-2 me-3 d-flex align-items-center justify-content-center shadow-sm" style={{ width: '45px', height: '45px', flexShrink: 0 }}>
            {icon}
          </div>
          <div>
            <div className="d-flex align-items-center gap-2">
              <h1 className="h2 mb-0 f1-page-title text-white">{title}</h1>
              {badge}
            </div>
            {subtitle && (
              <small className="text-muted text-uppercase fw-bold letter-spacing-1" style={{ fontSize: '0.65rem' }}>
                {subtitle}
              </small>
            )}
          </div>
        </div>
      </Col>
      {rightElement && (
        <Col xs={12} md={5} className="text-md-end mt-3 mt-md-0">
          {rightElement}
        </Col>
      )}
    </Row>
  );
}
