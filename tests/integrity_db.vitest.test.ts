import { describe, it, expect, beforeEach } from 'vitest';
import { newDb } from 'pg-mem';

/**
 * DATABASE INTEGRITY TESTS
 * This test uses pg-mem to simulate the Supabase Postgres schema and verify 
 * that the ON DELETE CASCADE and ON DELETE SET NULL constraints work correctly.
 */
describe('Supabase Database Integrity (Constraints)', () => {
  let db: any;

  beforeEach(() => {
    db = newDb();
    
    // 1. Create a mock auth.users table
    db.public.none(`
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (
        id UUID PRIMARY KEY,
        email TEXT
      );
    `);

    // 2. Create the P10 Racing Schema
    db.public.none(`
      -- Profiles (ON DELETE CASCADE)
      CREATE TABLE profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        username TEXT NOT NULL
      );

      -- Leagues (ON DELETE SET NULL for creator)
      CREATE TABLE leagues (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
      );

      -- Predictions (ON DELETE CASCADE)
      CREATE TABLE predictions (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        race_id TEXT NOT NULL,
        p10_driver_id TEXT NOT NULL,
        dnf_driver_id TEXT NOT NULL
      );

      -- League Members (ON DELETE CASCADE)
      CREATE TABLE league_members (
        league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        PRIMARY KEY (league_id, user_id)
      );
    `);
  });

  it('should DELETE profiles and predictions when a user is deleted (CASCADE)', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    
    // Insert initial data
    db.public.none(`INSERT INTO auth.users (id, email) VALUES ('${userId}', 'test@p10.racing')`);
    db.public.none(`INSERT INTO profiles (id, username) VALUES ('${userId}', 'testuser')`);
    db.public.none(`INSERT INTO predictions (id, user_id, race_id, p10_driver_id, dnf_driver_id) VALUES ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c50', '${userId}', '2026_1', 'verstappen', 'perez')`);

    // Verify presence
    const pBefore = db.public.many(`SELECT * FROM profiles WHERE id = '${userId}'`);
    expect(pBefore.length).toBe(1);

    // Delete the user from auth.users
    db.public.none(`DELETE FROM auth.users WHERE id = '${userId}'`);

    // Verify CASCADE deletion
    const pAfter = db.public.many(`SELECT * FROM profiles WHERE id = '${userId}'`);
    const predAfter = db.public.many(`SELECT * FROM predictions WHERE user_id = '${userId}'`);
    
    expect(pAfter.length).toBe(0);
    expect(predAfter.length).toBe(0);
  });

  it('should NOT delete a league when the creator is deleted (SET NULL)', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440001';
    const leagueId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
    
    // Insert initial data
    db.public.none(`INSERT INTO auth.users (id, email) VALUES ('${userId}', 'creator@p10.racing')`);
    db.public.none(`INSERT INTO leagues (id, name, created_by) VALUES ('${leagueId}', 'Best League', '${userId}')`);

    // Verify creator is set
    const lBefore = db.public.one(`SELECT * FROM leagues WHERE id = '${leagueId}'`);
    expect(lBefore.created_by).toBe(userId);

    // Delete the user
    db.public.none(`DELETE FROM auth.users WHERE id = '${userId}'`);

    // Verify league persists but creator is NULL
    const lAfter = db.public.one(`SELECT * FROM leagues WHERE id = '${leagueId}'`);
    expect(lAfter).toBeDefined();
    expect(lAfter.created_by).toBeNull();
    expect(lAfter.name).toBe('Best League');
  });

  it('should DELETE league memberships when a profile is deleted (CASCADE)', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440002';
    const leagueId = 'f1f2f3f4-e5f6-4a5b-8c9d-0e1f2a3b4c5e';
    
    // Insert initial data
    db.public.none(`INSERT INTO auth.users (id, email) VALUES ('${userId}', 'member@p10.racing')`);
    db.public.none(`INSERT INTO profiles (id, username) VALUES ('${userId}', 'member')`);
    db.public.none(`INSERT INTO leagues (id, name) VALUES ('${leagueId}', 'Public League')`);
    db.public.none(`INSERT INTO league_members (league_id, user_id) VALUES ('${leagueId}', '${userId}')`);

    // Verify membership
    const mBefore = db.public.many(`SELECT * FROM league_members WHERE user_id = '${userId}'`);
    expect(mBefore.length).toBe(1);

    // Delete the profile (which is CASCADE-ed from auth.users)
    db.public.none(`DELETE FROM auth.users WHERE id = '${userId}'`);

    // Verify membership is gone
    const mAfter = db.public.many(`SELECT * FROM league_members WHERE user_id = '${userId}'`);
    expect(mAfter.length).toBe(0);
  });
});
