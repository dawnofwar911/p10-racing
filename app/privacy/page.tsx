'use client';

import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { useRouter } from 'next/navigation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
// import AppNavbar from '@/components/AppNavbar'; // Removed

export default function PrivacyPage() {
  const router = useRouter();

  const handleBack = () => {
    Haptics.impact({ style: ImpactStyle.Light });
    router.back();
  };

  return (
    <>
      <Container className="py-5">
        <Row className="justify-content-center">
          <Col lg={8}>
            <div className="d-flex align-items-center mb-4">
              <Button 
                variant="outline-light" 
                size="sm" 
                onClick={handleBack}
                className="rounded-pill px-3 me-3 opacity-75"
              >
                ← BACK
              </Button>
              <h1 className="h2 fw-bold text-uppercase letter-spacing-1 mb-0 text-white">Privacy Policy</h1>
            </div>

            <Card className="border-secondary bg-dark shadow-sm">
              <Card.Body className="p-4 p-md-5 text-white opacity-75">
                <p className="small text-danger fw-bold text-uppercase letter-spacing-1 mb-4">Last Updated: March 8, 2026</p>

                <p className="mb-4">
                  P10 Racing (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the P10 Racing mobile application. 
                  This page informs you of our policies regarding the collection, use, and disclosure of 
                  personal data when you use our Service.
                </p>

                <h2 className="h5 text-white fw-bold mb-3 mt-4 text-uppercase">1. Information Collection and Use</h2>
                <p>We collect several different types of information for various purposes to provide and improve our Service to you:</p>
                <ul className="ps-3 mb-4">
                  <li className="mb-2"><strong>Personal Data:</strong> While using our Service, we may ask you to provide us with certain personally identifiable information that can be used to contact or identify you (&quot;Personal Data&quot;), such as your email address for account creation.</li>
                  <li className="mb-2"><strong>Usage Data:</strong> We may collect information on how the Service is accessed and used. This may include information such as your device type, operating system, and interaction with the app features.</li>
                </ul>

                <h2 className="h5 text-white fw-bold mb-3 mt-4 text-uppercase">2. Data Storage</h2>
                <p className="mb-4">Your data is stored securely using Supabase (PostgreSQL). We implement industry-standard security measures to protect your information.</p>

                <h2 className="h5 text-white fw-bold mb-3 mt-4 text-uppercase">3. Use of Data</h2>
                <p>P10 Racing uses the collected data for various purposes:</p>
                <ul className="ps-3 mb-4">
                  <li className="mb-2">To provide and maintain the Service</li>
                  <li className="mb-2">To notify you about changes to our Service</li>
                  <li className="mb-2">To allow you to participate in interactive features (Leagues, Predictions)</li>
                  <li className="mb-2">To provide customer care and support</li>
                  <li className="mb-2">To monitor the usage of the Service</li>
                </ul>

                <h2 className="h5 text-white fw-bold mb-3 mt-4 text-uppercase">4. Third-Party Services</h2>
                <p>We use the following third-party services:</p>
                <ul className="ps-3 mb-4">
                  <li className="mb-2"><strong>Supabase:</strong> For authentication and database management.</li>
                  <li className="mb-2"><strong>Jolpica F1 API:</strong> For retrieving Formula 1 race data.</li>
                </ul>

                <h2 className="h5 text-white fw-bold mb-3 mt-4 text-uppercase">5. Contact Us</h2>
                <p>If you have any questions about this Privacy Policy, please contact us at support@p10racing.app</p>
              </Card.Body>
            </Card>
            
            <div className="text-center mt-5 opacity-25">
               <p className="small text-white">&copy; 2026 P10 Racing. All rights reserved.</p>
            </div>
          </Col>
        </Row>
      </Container>
    </>
  );
}
