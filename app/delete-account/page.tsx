'use client';

import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { useRouter } from 'next/navigation';

export default function DeleteAccountPage() {
  const router = useRouter();

  return (
    <Container className="py-5 mt-5">
      <Row className="justify-content-center text-center">
        <Col lg={8}>
          <h1 className="h2 fw-bold text-uppercase letter-spacing-1 mb-4 text-white">Account Deletion Request</h1>
          
          <Card className="border-secondary bg-dark shadow-sm text-start">
            <Card.Body className="p-4 p-md-5 text-white opacity-75">
              <p className="mb-4">
                At P10 Racing, we respect your privacy and your right to control your data. 
                If you wish to delete your account and all associated data, please follow the instructions below.
              </p>

              <h2 className="h5 text-white fw-bold mb-3 mt-4 text-uppercase">What data will be deleted?</h2>
              <ul className="ps-3 mb-4">
                <li className="mb-2">Your profile information (username, email).</li>
                <li className="mb-2">Your prediction history.</li>
                <li className="mb-2">Your league memberships and created leagues.</li>
                <li className="mb-2">Your historical scores and placements.</li>
              </ul>

              <h2 className="h5 text-white fw-bold mb-3 mt-4 text-uppercase">How to request deletion</h2>
              <p className="mb-4">
                You can delete your account directly within the mobile app by navigating to the navigation menu while signed in.
              </p>
              
              <p className="mb-4">
                Alternatively, if you no longer have the app installed, please send an email to:
                <br />
                <strong className="text-danger">support@p10racing.app</strong>
              </p>
              
              <p className="small border-top border-secondary pt-3 mt-4">
                Note: Account deletion is permanent and cannot be undone. Once processed, your data will be 
                removed from our active databases within 7 days.
              </p>
              
              <div className="text-center mt-5">
                <Button variant="outline-light" onClick={() => router.push('/')} className="rounded-pill px-4">
                  RETURN HOME
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
