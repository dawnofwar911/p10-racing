'use client';

import { Spinner } from 'react-bootstrap';

export default function LoadingView({ text = "Loading Data..." }: { text?: string }) {
  return (
    <div className="d-flex flex-column justify-content-start align-items-center flex-grow-1 w-100" style={{ minHeight: '70vh', paddingTop: '20vh', paddingBottom: '10vh' }}>
      <div className="text-center">
        <Spinner animation="border" variant="danger" style={{ width: '3rem', height: '3rem' }} />
        <p className="mt-3 text-muted text-uppercase letter-spacing-1 fw-bold small">{text}</p>
      </div>
    </div>
  );
}
