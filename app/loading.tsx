import { Container, Spinner } from 'react-bootstrap';
import AppNavbar from '@/components/AppNavbar';

export default function Loading() {
  return (
    <main>
      <AppNavbar />
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" />
        <p className="mt-3 text-muted">Loading...</p>
      </div>
    </main>
  );
}
