import { Container, Row, Col, Button, Navbar } from 'react-bootstrap';

export default function Home() {
  return (
    <main>
      <Navbar variant="dark" className="px-3">
        <Navbar.Brand href="#home" className="fw-bold">
          P10 <span style={{ color: '#e10600' }}>RACING</span>
        </Navbar.Brand>
      </Navbar>

      <Container className="mt-5">
        <Row className="justify-content-center text-center">
          <Col md={8}>
            <h1 className="display-4 fw-bold mb-4">Master the Midfield.</h1>
            <p className="lead mb-5">
              Predict the 10th place finisher and the first DNF of the next Grand Prix.
            </p>
            <div className="d-grid gap-3 d-sm-flex justify-content-sm-center">
              <Button size="lg" className="btn-f1 px-5">
                Make Prediction
              </Button>
              <Button variant="outline-light" size="lg" className="px-5">
                Leaderboard
              </Button>
            </div>
          </Col>
        </Row>

        <Row className="mt-5 pt-5">
          <Col md={4}>
            <div className="p-4 border border-secondary rounded">
              <h3 className="h5 text-uppercase" style={{ color: '#e10600' }}>Next Race</h3>
              <p className="fs-4 fw-bold mb-0">Bahrain Grand Prix</p>
              <small className="text-muted">Sakhir Circuit • March 2nd</small>
            </div>
          </Col>
        </Row>
      </Container>
    </main>
  );
}
