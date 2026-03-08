'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Table } from 'react-bootstrap';
import { createClient } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import Link from 'next/link';
import AppNavbar from '@/components/AppNavbar';

interface League {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Create / Join State
  const [newLeagueName, setNewLeagueName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const supabase = createClient();

  useEffect(() => {
    async function init() {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      if (currentSession) {
        fetchLeagues(currentSession.user.id);
      } else {
        setLoading(false);
      }
    }
    init();
  }, [supabase]);

  async function fetchLeagues(userId: string) {
    setLoading(true);
    try {
      // Fetch leagues where user is a member
      const { data, error } = await supabase
        .from('leagues')
        .select('*, league_members!inner(user_id)')
        .eq('league_members.user_id', userId);

      if (error) throw error;
      setLeagues(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setActionLoading(true);
    Haptics.impact({ style: ImpactStyle.Medium });

    try {
      // 1. Create the league
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .insert([{ name: newLeagueName, created_by: session.user.id }])
        .select()
        .single();

      if (leagueError) throw leagueError;

      // 2. Add creator as a member
      const { error: memberError } = await supabase
        .from('league_members')
        .insert([{ league_id: league.id, user_id: session.user.id }]);

      if (memberError) throw memberError;

      setNewLeagueName('');
      fetchLeagues(session.user.id);
      alert(`League "${league.name}" created! Code: ${league.invite_code}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setActionLoading(true);
    Haptics.impact({ style: ImpactStyle.Medium });

    try {
      // 1. Find the league by code
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('id, name')
        .eq('invite_code', inviteCode.trim())
        .single();

      if (leagueError) throw new Error('Invalid invite code.');

      // 2. Join it
      const { error: joinError } = await supabase
        .from('league_members')
        .insert([{ league_id: league.id, user_id: session.user.id }]);

      if (joinError) {
        if (joinError.code === '23505') throw new Error('You are already a member of this league.');
        throw joinError;
      }

      setInviteCode('');
      fetchLeagues(session.user.id);
      alert(`Successfully joined "${league.name}"!`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!session && !loading) {
    return (
      <main>
        <AppNavbar />
        <Container className="mt-5 text-center">
          <div className="display-4 mb-4">🏆</div>
          <h1 className="fw-bold">Multiplayer Leagues</h1>
          <p className="text-muted mb-5">Sign in to create or join private leagues and compete with your friends.</p>
          <Link href="/auth" passHref legacyBehavior>
            <Button className="btn-f1 px-5 py-3 fw-bold">SIGN IN TO PLAY</Button>
          </Link>
        </Container>
      </main>
    );
  }

  return (
    <main>
      <AppNavbar />
      <Container className="mt-4 mb-5">
        <h1 className="h2 fw-bold text-uppercase letter-spacing-1 mb-4">Your Leagues</h1>

        {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}

        <Row className="g-4">
          <Col lg={8}>
            <Card className="border-secondary shadow-sm">
              <Card.Header className="bg-dark border-secondary py-3">
                <h3 className="h6 mb-0 text-uppercase fw-bold text-danger letter-spacing-1">Active Competitions</h3>
              </Card.Header>
              <Card.Body className="p-0">
                {loading ? (
                  <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
                ) : leagues.length > 0 ? (
                  <Table variant="dark" hover responsive className="mb-0">
                    <thead>
                      <tr className="bg-dark bg-opacity-50">
                        <th className="ps-4">League Name</th>
                        <th>Invite Code</th>
                        <th className="text-end pe-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leagues.map(league => (
                        <tr key={league.id} style={{ height: '60px', verticalAlign: 'middle' }}>
                          <td className="ps-4 fw-bold text-white">{league.name}</td>
                          <td><code className="text-danger fw-bold">{league.invite_code}</code></td>
                          <td className="text-end pe-4">
                            <Button variant="outline-light" size="sm" className="rounded-pill px-3">View</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <div className="text-center py-5 text-muted">
                    <p>You haven&apos;t joined any leagues yet.</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4}>
            <Card className="border-secondary mb-4 shadow-sm">
              <Card.Header className="bg-dark border-secondary py-3">
                <h3 className="h6 mb-0 text-uppercase fw-bold text-white letter-spacing-1">Create League</h3>
              </Card.Header>
              <Card.Body className="p-4">
                <Form onSubmit={handleCreateLeague}>
                  <Form.Group className="mb-3">
                    <Form.Label className="small text-muted text-uppercase fw-bold">League Name</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="e.g. The Silverstone Club" 
                      value={newLeagueName}
                      onChange={(e) => setNewLeagueName(e.target.value)}
                      required
                      className="bg-dark text-white border-secondary py-2"
                    />
                  </Form.Group>
                  <Button type="submit" className="btn-f1 w-100 py-2 fw-bold" disabled={actionLoading}>
                    {actionLoading ? <Spinner animation="border" size="sm" /> : 'CREATE'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>

            <Card className="border-danger border-opacity-50 shadow-sm">
              <Card.Header className="bg-dark border-danger border-opacity-25 py-3">
                <h3 className="h6 mb-0 text-uppercase fw-bold text-white letter-spacing-1">Join League</h3>
              </Card.Header>
              <Card.Body className="p-4">
                <Form onSubmit={handleJoinLeague}>
                  <Form.Group className="mb-3">
                    <Form.Label className="small text-muted text-uppercase fw-bold">Invite Code</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Enter 8-digit code" 
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      required
                      className="bg-dark text-white border-secondary py-2"
                    />
                  </Form.Group>
                  <Button type="submit" variant="outline-danger" className="w-100 py-2 fw-bold" disabled={actionLoading}>
                    {actionLoading ? <Spinner animation="border" size="sm" /> : 'JOIN'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </main>
  );
}
