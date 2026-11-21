// Marisol Bay: tuning numbers, names and colours for the whole game.
// Nothing here is copied from any commercial game: city, people and cars
// are all invented for this entry.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_STEP = 400; // distance between road centre lines
export const ROAD_HALF = 34; // half width of a road
export const BLOCK = 400; // city block size (same as road step)

export const COLORS = {
  water: '#1b6f8f',
  deepWater: '#145a76',
  sand: '#e8cf9a',
  grass: '#5d9b4a',
  park: '#4c8a3e',
  road: '#33363d',
  roadEdge: '#23252b',
  lane: '#c8c25a',
  sidewalk: '#9a938a',
  buildingRoof: ['#b0563a', '#7a6a9b', '#4a7a8c', '#a8894f', '#6b8f5e', '#96506a', '#5b6e9e', '#8c5a3c'],
  buildingSide: '#00000033',
  car: ['#c0392b', '#2471a3', '#f1c40f', '#7d3c98', '#16a085', '#e67e22', '#ecf0f1', '#2c3e50'],
  police: '#1e4f9c',
  taxi: '#f4c20d',
};

export const CAR_TYPES = {
  sedan: { name: 'Solano', accel: 420, top: 520, turn: 2.9, hp: 100, color: 0 },
  coupe: { name: 'Comet GT', accel: 560, top: 680, turn: 3.3, hp: 80, color: 2 },
  truck: { name: 'Hauler', accel: 300, top: 420, turn: 2.2, hp: 160, color: 5 },
  taxi: { name: 'Bay Cab', accel: 430, top: 530, turn: 3.0, hp: 100, color: 1 },
  police: { name: 'MBPD Cruiser', accel: 540, top: 640, turn: 3.4, hp: 140, color: 0 },
  van: { name: 'Dune Van', accel: 360, top: 470, turn: 2.5, hp: 120, color: 3 },
};

export const RANKS = [
  'Street Driver',
  'Wheelman',
  'Bay Runner',
  'Fixer’s Favourite',
  'Kingpin-in-Waiting',
  'Bay Legend',
];

export const SAVE_KEY = 'marisol-bay-save-v1';
export const SHOT_PARAM = 'shot';
