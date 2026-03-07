import { Container, Spinner } from 'react-bootstrap';
import AppNavbar from '@/components/AppNavbar';

export default function Loading() {
  return (
    <main>
      <AppNavbar />
      <Container className="mt-5 text-center p-5">
        <Spinner animation="border" variant="danger" />
        <p className="mt-3 text-muted">Loading...</p>
      </Container>
    </main>
  );
}
