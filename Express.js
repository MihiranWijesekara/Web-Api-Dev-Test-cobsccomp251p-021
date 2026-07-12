const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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

// 2. REST API Routes

// GET /provinces
app.get('/provinces', (req, res) => {
  res.json(db.provinces || []);
});

// GET /provinces/:provinceId
app.get('/provinces/:provinceId', (req, res) => {
  const item = db.provinces?.find(p => p.id === req.params.provinceId);
  if (!item) return res.status(404).json({ error: 'Province not found' });
  res.json(item);
});

// GET /districts
app.get('/districts', (req, res) => {
  res.json(db.districts || []);
});

// GET /districts/:districtId
app.get('/districts/:districtId', (req, res) => {
  const item = db.districts?.find(d => d.id === req.params.districtId);
  if (!item) return res.status(404).json({ error: 'District not found' });
  res.json(item);
});

// GET /stations
app.get('/stations', (req, res) => {
  res.json(db.stations || []);
});

// GET /stations/:stationId
app.get('/stations/:stationId', (req, res) => {
  const item = db.stations?.find(s => s.id === req.params.stationId);
  if (!item) return res.status(404).json({ error: 'Station not found' });
  res.json(item);
});

// GET /vehicles
app.get('/vehicles', (req, res) => {
  res.json(db.vehicles || []);
});

// GET /vehicles/:vehicleId
app.get('/vehicles/:vehicleId', (req, res) => {
  const item = db.vehicles?.find(v => v.id === req.params.vehicleId);
  if (!item) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(item);
});

// GET /vehicles/:vehicleId/pings
app.get('/vehicles/:vehicleId/pings', (req, res) => {
  // Verifies if the vehicle exists first
  const vehicleExists = db.vehicles?.some(v => v.id === req.params.vehicleId);
  if (!vehicleExists) return res.status(404).json({ error: 'Vehicle not found' });

  // Filters pings belonging to this specific vehicle
  const vehiclePings = db.pings?.filter(p => p.vehicleId === req.params.vehicleId) || [];
  res.json(vehiclePings);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});