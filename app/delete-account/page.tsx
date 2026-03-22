'use client';

import { Container, Row, Col, Card } from 'react-bootstrap';
import Link from 'next/link';
import HapticButton from '@/components/HapticButton';
import { triggerLightHaptic } from '@/lib/utils/haptics';

export default function DeleteAccountPage() {

  return (
    <Container className="py-5 mt-5">
      <Row className="justify-content-center text-center">
        <Col lg={8}>
          <h1 className="h2 fw-bold text-uppercase letter-spacing-1 mb-4 text-white">Account Deletion Request</h1>
          
          <Card className="f1-glass-card border-secondary border-opacity-50 text-start">
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

              <h2 className="h5 text-white fw-bold mb-3 mt-4 text-uppercase">How to delete your account</h2>
              <p className="mb-4">
                You can delete your account and all associated data directly within the app by navigating to the{' '}
                <Link 
                  href="/settings" 
                  onClick={triggerLightHaptic}
                  className="text-danger p-0 d-inline fw-bold text-decoration-none"
                >
                  Settings
                </Link>{' '}
                page while signed in and selecting the <strong>&quot;Delete Account Data&quot;</strong> option.
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
                <Link href="/" passHref legacyBehavior>
                  <HapticButton variant="outline-light" className="rounded-pill px-4">
                    RETURN HOME
                  </HapticButton>
                </Link>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
