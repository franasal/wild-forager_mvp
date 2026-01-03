export const state = {
  plants: [],          // all loaded plants
  selectedPlants: [],  // top N (or filtered set) we actually show
  region: null,
  userLat: 51.3397,
  userLon: 12.3731,
  selected: null,
  filters: {
    topN: 12,
    vizHotspots: true,
    vizPoints: false,
    sortMode: "timeless" // "timeless" | "season"
  }
};
