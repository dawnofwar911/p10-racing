'use client';

import { Spinner } from 'react-bootstrap';

export default function LoadingView({ text = "Loading Data..." }: { text?: string }) {
  return (
    <div className="loading-view-container">
      <div className="text-center">
        <Spinner animation="border" variant="danger" style={{ width: '3rem', height: '3rem' }} />
        <p className="mt-3 text-muted text-uppercase letter-spacing-1 fw-bold small">{text}</p>
      </div>
    </div>
  );
}
