import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { fetchRecentResults, DriverFormMap } from '@/lib/api';
import { server } from './setup';
import { http, HttpResponse } from 'msw';

describe('Driver Insights API Logic', () => {
  afterEach(() => server.resetHandlers());

  it('transforms Jolpica results into a DriverFormMap correctly', async () => {
    const mockApiResponse = {
      MRData: {
        RaceTable: {
          Races: [
            {
              round: "1",
              Results: [
                { position: "1", Driver: { driverId: "verstappen" }, status: "Finished" },
                { position: "10", Driver: { driverId: "hamilton" }, status: "Finished" }
              ]
            },
            {
              round: "2",
              Results: [
                { position: "2", Driver: { driverId: "verstappen" }, status: "Finished" },
                { position: "15", Driver: { driverId: "hamilton" }, status: "Finished" },
                { position: "20", Driver: { driverId: "leclerc" }, status: "Accident" }
              ]
            }
          ]
        }
      }
    };

    server.use(
      http.get('*/results.json', () => {
        return HttpResponse.json(mockApiResponse);
      })
    );

    const formMap = await fetchRecentResults(2026, 2);

    expect(formMap['verstappen']).toHaveLength(2);
    expect(formMap['verstappen'][0].pos).toBe(1);
    expect(formMap['verstappen'][1].pos).toBe(2);

    expect(formMap['hamilton']).toHaveLength(2);
    expect(formMap['hamilton'][1].pos).toBe(15);

    expect(formMap['leclerc']).toHaveLength(1);
    expect(formMap['leclerc'][0].status).toBe('Accident');
  });

  it('handles empty results gracefully', async () => {
    server.use(
      http.get('*/results.json', () => {
        return HttpResponse.json({ MRData: { RaceTable: { Races: [] } } });
      })
    );

    const formMap = await fetchRecentResults(2026, 3);
    expect(formMap).toEqual({});
  });
});
