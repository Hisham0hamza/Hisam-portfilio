import { describe, expect, it } from 'vitest';

import { createClusterIndex } from './cluster';
import { regionChangedSignificantly, regionToBbox, regionToZoom, type Region } from './geo';

const cairoPoints = [
  { id: 'muizz', lat: 30.0548, lng: 31.2627 },
  { id: 'khan', lat: 30.0477, lng: 31.2622 },
  { id: 'azhar', lat: 30.041, lng: 31.264 },
];
const alex = { id: 'qaitbay', lat: 31.214, lng: 29.8856 };

const egypt: Region = { latitude: 28, longitude: 31, latitudeDelta: 10, longitudeDelta: 10 };
const street: Region = { latitude: 30.048, longitude: 31.263, latitudeDelta: 0.01, longitudeDelta: 0.01 };

describe('clustering', () => {
  const index = createClusterIndex([...cairoPoints, alex]);

  it('groups nearby events when zoomed out', () => {
    const nodes = index.getClusters(egypt);
    const cluster = nodes.find((n) => n.type === 'cluster');
    expect(cluster).toMatchObject({ type: 'cluster', count: 3 });
    expect(nodes.find((n) => n.type === 'point' && n.id === 'qaitbay')).toBeTruthy();
  });

  it('shows individual pins when zoomed in', () => {
    const nodes = index.getClusters(street);
    expect(nodes.every((n) => n.type === 'point')).toBe(true);
    expect(nodes.map((n) => n.id).sort()).toEqual(['azhar', 'khan', 'muizz']);
  });

  it('gives clusters a tighter region to zoom into', () => {
    const cluster = index.getClusters(egypt).find((n) => n.type === 'cluster');
    if (cluster?.type !== 'cluster') throw new Error('expected a cluster');
    expect(cluster.expansionRegion.longitudeDelta).toBeLessThan(egypt.longitudeDelta);
  });
});

describe('geo helpers', () => {
  it('converts a region to a bbox', () => {
    expect(regionToBbox({ latitude: 30, longitude: 31, latitudeDelta: 2, longitudeDelta: 4 })).toEqual({
      west: 29,
      east: 33,
      south: 29,
      north: 31,
    });
  });

  it('maps deltas to zoom levels', () => {
    expect(regionToZoom(egypt)).toBe(5);
    expect(regionToZoom(street)).toBe(15);
  });

  it('detects significant map moves', () => {
    expect(regionChangedSignificantly(street, { ...street, latitude: street.latitude + 0.001 })).toBe(false);
    expect(regionChangedSignificantly(street, { ...street, latitude: street.latitude + 0.01 })).toBe(true);
    expect(regionChangedSignificantly(street, { ...street, longitudeDelta: 0.03, latitudeDelta: 0.03 })).toBe(true);
  });
});
