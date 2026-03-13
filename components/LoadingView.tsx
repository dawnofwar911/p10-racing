'use client';

import { Spinner } from 'react-bootstrap';

export default function LoadingView({ text = "Loading Data..." }: { text?: string }) {
  return (
    <div className="d-flex flex-column justify-content-center align-items-center flex-grow-1 w-100" style={{ minHeight: '100%' }}>
      <div className="text-center">
        <Spinner animation="border" variant="danger" style={{ width: '3rem', height: '3rem' }} />
        <p className="mt-3 text-muted text-uppercase letter-spacing-1 fw-bold">{text}</p>
      </div>
    </div>
  );
}
