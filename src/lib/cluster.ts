// Marker clustering on top of supercluster (pure — testable in Node).
import Supercluster from 'supercluster';

import { regionToBbox, regionToZoom, zoomToDelta, type Region } from './geo';

export type PointItem = { id: string; lat: number; lng: number };

export type ClusterNode<T extends PointItem> =
  | { type: 'point'; id: string; lat: number; lng: number; item: T }
  | { type: 'cluster'; id: string; lat: number; lng: number; count: number; expansionRegion: Region };

export function createClusterIndex<T extends PointItem>(items: T[], radius = 60) {
  const index = new Supercluster<{ item: T }>({ radius, maxZoom: 16 });
  index.load(
    items.map((item) => ({
      type: 'Feature' as const,
      properties: { item },
      geometry: { type: 'Point' as const, coordinates: [item.lng, item.lat] },
    })),
  );

  return {
    getClusters(region: Region): ClusterNode<T>[] {
      // Pad the viewport so pins just outside the edges are already rendered while panning.
      const b = regionToBbox({
        ...region,
        latitudeDelta: region.latitudeDelta * 2,
        longitudeDelta: region.longitudeDelta * 2,
      });
      const zoom = regionToZoom(region);
      return index.getClusters([b.west, b.south, b.east, b.north], zoom).map((f) => {
        const [lng, lat] = f.geometry.coordinates;
        const props = f.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; item?: T };
        if (props.cluster && props.cluster_id != null) {
          const expansionZoom = Math.min(index.getClusterExpansionZoom(props.cluster_id), 18);
          const delta = zoomToDelta(expansionZoom);
          return {
            type: 'cluster',
            id: `cluster-${props.cluster_id}`,
            lat,
            lng,
            count: props.point_count ?? 0,
            expansionRegion: { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta },
          };
        }
        const item = props.item as T;
        return { type: 'point', id: item.id, lat, lng, item };
      });
    },
  };
}
