const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// 1. Load seed data into memory at startup
let db = {
  provinces: [],
  districts: [],
  stations: [],
  vehicles: [],
  pings: [] // Assuming pings are stored with a vehicleId foreign key
};

try {
  const seedPath = path.join(__dirname, 'seed.json');
  const rawData = fs.readFileSync(seedPath, 'utf8');
  db = JSON.parse(rawData);
  console.log('Seed data successfully loaded into memory.');
} catch (error) {
  console.error('Error loading seed.json. Starting with empty datasets:', error.message);
}

const deviceKeys = (db.vehicles || []).reduce((keys, vehicle) => {
  const paddedId = String(vehicle.id).padStart(2, '0');
  const deviceKey = `key_v${paddedId}`;

  keys[`v-${paddedId}`] = deviceKey;
  keys[String(vehicle.id)] = deviceKey;

  return keys;
}, {});

const getVehicleById = (vehicleId) => db.vehicles?.find(vehicle => {
  const paddedId = String(vehicle.id).padStart(2, '0');
  return String(vehicle.id) === String(vehicleId) || `v-${paddedId}` === String(vehicleId);
});

const normalizePing = (ping) => ({
  ping_id: String(ping.id),
  vehicle_id: String(ping.vehicle_id),
  timestamp: ping.timestamp,
  lat: ping.lat ?? ping.lattitude,
  lng: ping.lng ?? ping.longitude,
  speed: ping.speed ?? 0
});

const normalizeProvince = (province) => ({
  province_id: String(province.id),
  name: province.name
});

const normalizeDistrict = (district) => ({
  district_id: String(district.id),
  name: district.name,
  province_id: String(district.province_id)
});

const normalizeStation = (station) => ({
  station_id: String(station.id),
  name: station.name,
  district_id: String(station.district_id)
});

const normalizeVehicle = (vehicle) => ({
  vehicle_id: String(vehicle.id),
  reg_number: vehicle.registration_number,
  device_id: vehicle.device_id,
  station_id: String(vehicle.station_id)
});

const getLatestPingForVehicle = (vehicleId) => {
  const vehicle = getVehicleById(vehicleId);
  if (!vehicle) return null;

  const latestPing = (db.pings || [])
    .filter(ping => String(ping.vehicle_id) === String(vehicle.id))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

  if (!latestPing) return null;

  return normalizePing(latestPing);
};

const getLastPositionForVehicle = (vehicleId) => {
  const vehicle = getVehicleById(vehicleId);
  if (!vehicle) return null;

  const latestPing = (db.pings || [])
    .filter(ping => String(ping.vehicle_id) === String(vehicle.id))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

  if (!latestPing) return null;

  return {
    vehicle_id: String(latestPing.vehicle_id),
    timestamp: latestPing.timestamp,
    lat: latestPing.lattitude ?? latestPing.lat,
    lng: latestPing.longitude ?? latestPing.lng,
    speed: latestPing.speed ?? 0
  };
};

const getPingByIdForVehicle = (vehicleId, pingId) => {
  const vehicle = getVehicleById(vehicleId);
  if (!vehicle) return null;

  const ping = (db.pings || []).find(item =>
    String(item.vehicle_id) === String(vehicle.id) && String(item.id) === String(pingId)
  );

  return ping ? normalizePing(ping) : null;
};

const getNextPingId = () => {
  const maxId = (db.pings || []).reduce((highest, ping) => Math.max(highest, Number(ping.id) || 0), 0);
  return String(maxId + 1);
};

// 2. REST API Routes

// GET /provinces
app.get('/provinces', (req, res) => {
  res.json((db.provinces || []).map(normalizeProvince));
});

// GET /provinces/:provinceId
app.get('/provinces/:provinceId', (req, res) => {
  const item = db.provinces?.find(p => p.id === req.params.provinceId);
  if (!item) return res.status(404).json({ error: 'Province not found' });
  res.json(normalizeProvince(item));
});

// GET /districts
app.get('/districts', (req, res) => {
  res.json((db.districts || []).map(normalizeDistrict));
});

// GET /districts/:districtId
app.get('/districts/:districtId', (req, res) => {
  const item = db.districts?.find(d => d.id === req.params.districtId);
  if (!item) return res.status(404).json({ error: 'District not found' });
  res.json(normalizeDistrict(item));
});

// GET /stations
app.get('/stations', (req, res) => {
  res.json((db.stations || []).map(normalizeStation));
});

// GET /stations/:stationId
app.get('/stations/:stationId', (req, res) => {
  const item = db.stations?.find(s => s.id === req.params.stationId);
  if (!item) return res.status(404).json({ error: 'Station not found' });
  res.json(normalizeStation(item));
});

// GET /vehicles
app.get('/vehicles', (req, res) => {
  res.json((db.vehicles || []).map(normalizeVehicle));
});

// GET /vehicles/:vehicleId
app.get('/vehicles/:vehicleId', (req, res) => {
  const vehicle = getVehicleById(req.params.vehicleId);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  res.json({
    ...normalizeVehicle(vehicle),
    last_ping: getLatestPingForVehicle(vehicle.id)
  });
});

// GET /vehicles/:vehicleId/last-position
app.get('/vehicles/:vehicleId/last-position', (req, res) => {
  const lastPosition = getLastPositionForVehicle(req.params.vehicleId);
  if (!lastPosition) return res.status(404).json({ error: 'Vehicle ping not found' });

  res.json(lastPosition);
});

// GET /vehicles/:vehicleId/pings
app.get('/vehicles/:vehicleId/pings', (req, res) => {
  // Verifies if the vehicle exists first
  const vehicleExists = Boolean(getVehicleById(req.params.vehicleId));
  if (!vehicleExists) return res.status(404).json({ error: 'Vehicle not found' });

  // Filters pings belonging to this specific vehicle
  const vehicle = getVehicleById(req.params.vehicleId);
  const vehiclePings = (db.pings || [])
    .filter(p => String(p.vehicle_id) === String(vehicle.id))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(normalizePing);

  res.json(vehiclePings);
});

// POST /vehicles/:vehicleId/pings
app.post('/vehicles/:vehicleId/pings', (req, res) => {
  const apiKey = req.get('X-API-Key');
  if (!apiKey) return res.status(401).json({ error: 'X-API-Key header is required' });

  const vehicleId = req.params.vehicleId;
  const vehicle = getVehicleById(vehicleId);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  const expectedKey = deviceKeys[String(vehicleId)];
  if (apiKey !== expectedKey) return res.status(403).json({ error: 'Invalid API key' });

  const { latitude, longitude, speed } = req.body || {};
  if (latitude === undefined || longitude === undefined || speed === undefined) {
    return res.status(400).json({ error: 'latitude, longitude, and speed are required' });
  }

  const pingId = getNextPingId();
  const timestamp = new Date().toISOString();
  const createdPing = {
    id: pingId,
    vehicle_id: String(vehicle.id),
    timestamp,
    lat: latitude,
    lng: longitude,
    speed
  };

  db.pings = db.pings || [];
  db.pings.push(createdPing);

  res.set({
    Location: `/vehicles/${vehicleId}/pings/${pingId}`,
    ETag: `"${pingId}"`,
    'Last-Modified': new Date(timestamp).toUTCString()
  });

  res.status(201).json(normalizePing(createdPing));
});

// GET /vehicles/:vehicleId/pings/:pingId
app.get('/vehicles/:vehicleId/pings/:pingId', (req, res) => {
  const ping = getPingByIdForVehicle(req.params.vehicleId, req.params.pingId);
  if (!ping) return res.status(404).json({ error: 'Ping not found' });

  res.json(ping);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});