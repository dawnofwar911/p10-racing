'use client';

import React, { ReactNode } from 'react';
import { LayoutGrid } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  message: string;
  action?: ReactNode;
}

/**
 * A standardized component for displaying empty states across the application.
 */
export default function EmptyState({ 
  icon = <LayoutGrid size={48} className="text-secondary opacity-25 mb-3" />, 
  title, 
  message, 
  action 
}: EmptyStateProps) {
  return (
    <div className="text-center py-5 px-3 bg-dark bg-opacity-25 rounded-4 border border-secondary border-opacity-10">
      <div className="d-flex flex-column align-items-center justify-content-center">
        {icon}
        {title && <h3 className="h5 fw-bold text-white mb-2">{title}</h3>}
        <p className="text-muted small mb-4" style={{ maxWidth: '300px' }}>{message}</p>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
