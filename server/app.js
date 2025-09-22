import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: ['http://localhost:3000', 'https://amazing-app-123.netlify.app'], // Replace with your actual Netlify URL
    credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static hosting for client and server pages
app.use('/client', express.static(path.join(__dirname, '..', 'client')));
app.use('/portal', express.static(path.join(__dirname)));

// Static hosting for uploaded media
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Simple file-based persistence
const dataDir = path.join(__dirname, 'data');
const issuesFile = path.join(dataDir, 'issues.json');
const departmentsFile = path.join(dataDir, 'departments.json');
const archiveFile = path.join(dataDir, 'archive.json');

function ensureDataFiles() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(issuesFile)) fs.writeFileSync(issuesFile, JSON.stringify([], null, 2));
  if (!fs.existsSync(departmentsFile)) {
    const defaultDepts = [
      { id: 'electrical', name: 'Electrical Department' },
      { id: 'sanitation', name: 'Sanitation Department' },
      { id: 'public-works', name: 'Public Works Department' },
      { id: 'water-supply', name: 'Water Supply Department' },
      { id: 'traffic', name: 'Traffic Management' }
    ];
    fs.writeFileSync(departmentsFile, JSON.stringify(defaultDepts, null, 2));
  }
  if (!fs.existsSync(archiveFile)) fs.writeFileSync(archiveFile, JSON.stringify([], null, 2));
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

ensureDataFiles();

// File upload (multer)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${nanoid(6)}`;
    const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${unique}-${safe}`);
  }
});
const upload = multer({ storage });

app.post('/api/upload', upload.array('files', 10), (req, res) => {
  const files = (req.files || []).map(f => ({
    filename: f.filename,
    url: `/uploads/${f.filename}`,
    mimetype: f.mimetype,
    size: f.size
  }));
  res.json({ files });
});

// API routes
app.get('/api/issues', (req, res) => {
  const issues = readJson(issuesFile);
  res.json(issues);
});

app.post('/api/issues', (req, res) => {
  const issues = readJson(issuesFile);
  const now = new Date().toISOString();
  const id = 'ISS-' + nanoid(6).toUpperCase();
  const issue = {
    id,
    type: req.body.type,
    title: req.body.title,
    description: req.body.description,
    location: req.body.location || req.body.manualAddress || '',
    coordinates: req.body.coordinates || null,
    status: 'pending',
    priority: req.body.priority || 'medium',
    reportedBy: req.body.reportedBy || 'Citizen User',
    reportedAt: now,
    assignedTo: null,
    assignedAt: null,
    department: null,
    media: req.body.media || [],
    voiceNote: req.body.voiceNote || null,
    updates: []
  };
  issues.push(issue);
  writeJson(issuesFile, issues);
  res.status(201).json(issue);
});

app.patch('/api/issues/:id/status', (req, res) => {
  const issues = readJson(issuesFile);
  const issue = issues.find(i => i.id === req.params.id);
  if (!issue) return res.status(404).json({ error: 'Not found' });
  issue.status = req.body.status || issue.status;
  writeJson(issuesFile, issues);
  res.json(issue);
});

app.post('/api/issues/:id/assign', (req, res) => {
  const issues = readJson(issuesFile);
  const issue = issues.find(i => i.id === req.params.id);
  if (!issue) return res.status(404).json({ error: 'Not found' });
  issue.department = req.body.department || issue.department;
  issue.assignedTo = req.body.assignedTo || issue.assignedTo;
  issue.priority = req.body.priority || issue.priority;
  issue.assignedAt = new Date().toISOString();
  if (issue.status === 'pending') issue.status = 'in-progress';
  if (req.body.instructions) {
    issue.updates = issue.updates || [];
    issue.updates.push({ date: new Date().toISOString(), note: `Assignment note: ${req.body.instructions}`, by: 'Authority' });
  }
  writeJson(issuesFile, issues);
  res.json(issue);
});

// Archive or delete resolved issues
app.post('/api/issues/clear-resolved', (req, res) => {
  const keepUnresolved = !!req.body.keepUnresolved; // unused, reserved
  const issues = readJson(issuesFile);
  const resolved = issues.filter(i => i.status === 'resolved');
  const remaining = issues.filter(i => i.status !== 'resolved');
  const archive = readJson(archiveFile);
  const now = new Date().toISOString();
  resolved.forEach(i => archive.push({ ...i, archivedAt: now }));
  writeJson(archiveFile, archive);
  writeJson(issuesFile, remaining);
  res.json({ removed: resolved.length, remaining: remaining.length });
});

app.delete('/api/issues/:id', (req, res) => {
  const issues = readJson(issuesFile);
  const idx = issues.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [removed] = issues.splice(idx, 1);
  const archive = readJson(archiveFile);
  archive.push({ ...removed, archivedAt: new Date().toISOString() });
  writeJson(archiveFile, archive);
  writeJson(issuesFile, issues);
  res.json({ ok: true });
});

app.get('/api/departments', (req, res) => {
  res.json(readJson(departmentsFile));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Client: http://localhost:${PORT}/client/index.html`);
  console.log(`Authority: http://localhost:${PORT}/portal/authority.html`);
});
