'use client';

import { Spinner } from 'react-bootstrap';

export default function Loading() {
  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-dark">
      <div className="text-center">
        <Spinner animation="border" variant="danger" style={{ width: '3rem', height: '3rem' }} />
        <p className="mt-3 text-muted text-uppercase letter-spacing-1 fw-bold">Loading Data...</p>
      </div>
    </div>
  );
}
