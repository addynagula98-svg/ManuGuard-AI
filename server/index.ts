import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const app = express();
app.use(cors({
  origin: [/https?:\/\/localhost:\d+$/, /https?:\/\/127\.0\.0\.1:\d+$/]
}));
app.use(express.json({limit: '100kb'}));
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err) return res.status(400).json({error: 'Invalid request body.'});
  next();
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(__dirname, '../data/records.json');
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
const STATUSES = ['Accepted', 'Edited', 'Rejected'] as const;
const NOTE_MIN = 12;
const NOTE_MAX = 3000;

const equipment = [
  {id: 'eq1', name: 'Hydraulic Press HP-04', type: 'Hydraulic Press', area: 'Line A', status: 'At Risk'},
  {id: 'eq2', name: 'Conveyor CV-12', type: 'Conveyor', area: 'Packaging', status: 'Watch'},
  {id: 'eq3', name: 'CNC Mill CNC-07', type: 'CNC Mill', area: 'Machining', status: 'Normal'},
  {id: 'eq4', name: 'Air Compressor AC-02', type: 'Compressor', area: 'Utilities', status: 'Watch'},
  {id: 'eq5', name: 'Cooling Pump CP-03', type: 'Pump', area: 'Line B', status: 'Normal'}
];

const seed = [
  {id: 'r1', equipmentId: 'eq1', equipmentName: 'Hydraulic Press HP-04', date: '2026-09-12', note: 'Operator reports stronger vibration during high-pressure cycle and oil temperature running hotter than normal.', analysis: {summary: 'Increased vibration with elevated hydraulic oil temperature.', category: 'Hydraulic / Vibration', priority: 'High', explanation: 'Combined vibration and heat can indicate pump wear, restriction, alignment issues, or degraded fluid. This is a suggested reading of the note, not a confirmed diagnosis.', nextStep: 'Inspect fluid condition, filters, pump noise and mounting before the next extended production run.', recurring: true, matchedRecords: 2}, reviewStatus: 'Accepted'},
  {id: 'r2', equipmentId: 'eq2', equipmentName: 'Conveyor CV-12', date: '2026-09-20', note: 'Intermittent belt tracking alarm near end of shift. Belt drifts toward drive side.', analysis: {summary: 'Intermittent conveyor belt tracking deviation.', category: 'Mechanical / Alignment', priority: 'Medium', explanation: 'Repeated tracking alarms may indicate tension, roller alignment or buildup. Treat this as decision support until a technician confirms the cause.', nextStep: 'Inspect belt tension, rollers and buildup; compare with previous tracking events.', recurring: true, matchedRecords: 1}, reviewStatus: 'Pending'},
  {id: 'r3', equipmentId: 'eq3', equipmentName: 'CNC Mill CNC-07', date: '2026-09-28', note: 'Brief spindle noise at startup. No alarm and normal operation after warmup.', analysis: {summary: 'Short-duration spindle noise during startup.', category: 'Mechanical / Spindle', priority: 'Low', explanation: 'No alarms or continued symptoms suggest monitoring is appropriate, but recurrence should be tracked. Incomplete or brief notes leave more uncertainty.', nextStep: 'Record recurrence and inspect lubrication at next planned maintenance window.', recurring: false, matchedRecords: 0}, reviewStatus: 'Accepted'}
];

function asArray(value: unknown) {
  return Array.isArray(value) ? value : seed;
}

function read() {
  try {
    return asArray(JSON.parse(fs.readFileSync(dataFile, 'utf8')));
  } catch {
    return seed;
  }
}

function write(v: unknown) {
  fs.writeFileSync(dataFile, JSON.stringify(v, null, 2));
}

if (!fs.existsSync(dataFile)) write(seed);

function normalizeNote(note: unknown) {
  if (typeof note !== 'string') return '';
  return note.trim().slice(0, NOTE_MAX);
}

function analyze(note: string, equipmentId: string) {
  const n = note.toLowerCase();
  const history = read().filter((r: {equipmentId?: string}) => r.equipmentId === equipmentId);
  let category = 'General / Inspection';
  let priority: typeof PRIORITIES[number] = 'Medium';
  let nextStep = 'Perform a focused inspection and compare findings with recent maintenance history.';
  const signals: string[] = [];
  if (/vibrat|shake|bearing/.test(n)) {
    category = 'Mechanical / Vibration';
    signals.push('vibration');
    nextStep = 'Inspect bearings, mounting, alignment and lubrication before continued heavy operation.';
  }
  if (/overheat|hot|temperature|heat/.test(n)) {
    category = category === 'Mechanical / Vibration' ? 'Mechanical / Heat & Vibration' : 'Thermal / Overheating';
    signals.push('heat');
    priority = 'High';
    nextStep = 'Check lubrication, cooling, load and temperature trend; escalate if temperature continues rising.';
  }
  if (/shutdown|trip|smoke|burn|leak|pressure loss/.test(n)) {
    priority = 'Critical';
    signals.push('critical condition');
    nextStep = 'Stop or isolate equipment as required by site procedure and request qualified maintenance review before restart.';
  } else if (/repeat|again|frequent|intermittent|alarm/.test(n) || signals.length > 1) {
    priority = 'High';
  } else if (/noise|drift|slow|wear/.test(n)) {
    priority = 'Medium';
  }
  const words = new Set(n.split(/\W+/).filter((x: string) => x.length > 5));
  const matched = history.filter((r: {note?: string}) => String(r.note || '').toLowerCase().split(/\W+/).some((w: string) => words.has(w))).length;
  const recurring = matched > 0;
  const uncertain = note.length < 40;
  return {
    summary: note.length > 125 ? note.slice(0, 122) + '...' : note,
    category,
    priority,
    explanation: `Suggested interpretation only: the note contains ${signals.length ? signals.join(' and ') : 'limited maintenance'} indicators. ${recurring ? `Similar language appears in ${matched} prior record(s), so recurrence should be reviewed.` : 'No strong recurring pattern was found in the current local history.'}${uncertain ? ' The information provided is incomplete or weakly specified, so this is not a confirmed finding.' : ''} A qualified reviewer must confirm any action.`,
    nextStep,
    recurring,
    matchedRecords: matched
  };
}

function sanitizeAnalysis(raw: unknown, note: string, equipmentId: string) {
  const generated = analyze(note, equipmentId);
  if (!raw || typeof raw !== 'object') return generated;
  const a = raw as Record<string, unknown>;
  return {
    summary: String(a.summary || generated.summary).slice(0, 300),
    category: String(a.category || generated.category).slice(0, 80),
    priority: PRIORITIES.includes(a.priority as typeof PRIORITIES[number]) ? a.priority : generated.priority,
    explanation: String(a.explanation || generated.explanation).slice(0, 1200),
    nextStep: String(a.nextStep || generated.nextStep).slice(0, 500),
    recurring: Boolean(a.recurring),
    matchedRecords: Math.max(0, Math.min(999, Number(a.matchedRecords) || 0))
  };
}

app.get('/api/equipment', (_req, res) => res.json(equipment));
app.get('/api/records', (_req, res) => res.json(read()));

app.post('/api/analyze', (req, res) => {
  const equipmentId = typeof req.body?.equipmentId === 'string' ? req.body.equipmentId : '';
  const note = normalizeNote(req.body?.note);
  if (!equipmentId || note.length < NOTE_MIN) {
    return res.status(400).json({error: 'Select equipment and enter at least 12 characters of maintenance detail.'});
  }
  const eq = equipment.find(e => e.id === equipmentId);
  if (!eq) return res.status(404).json({error: 'Equipment not found.'});
  res.json(analyze(note, equipmentId));
});

app.post('/api/records', (req, res) => {
  const equipmentId = typeof req.body?.equipmentId === 'string' ? req.body.equipmentId : '';
  const note = normalizeNote(req.body?.note);
  const eq = equipment.find(e => e.id === equipmentId);
  if (!eq || note.length < NOTE_MIN) {
    return res.status(400).json({error: 'Incomplete maintenance record. Select equipment and enter at least 12 characters.'});
  }
  if (!req.body?.analysis) return res.status(400).json({error: 'Incomplete maintenance record.'});
  const analysis = sanitizeAnalysis(req.body.analysis, note, equipmentId);
  const all = read();
  const item = {
    id: 'r' + Date.now(),
    equipmentId,
    equipmentName: eq.name,
    date: new Date().toISOString().slice(0, 10),
    note,
    analysis,
    reviewStatus: 'Pending'
  };
  all.unshift(item);
  write(all);
  res.status(201).json(item);
});

app.patch('/api/records/:id/review', (req, res) => {
  const reviewStatus = req.body?.reviewStatus;
  if (!STATUSES.includes(reviewStatus as typeof STATUSES[number])) return res.status(400).json({error: 'Invalid review decision.'});
  const id = String(req.params.id || '').slice(0, 64);
  const all = read();
  const i = all.findIndex((r: {id?: string}) => r.id === id);
  if (i < 0) return res.status(404).json({error: 'Record not found.'});
  all[i] = {
    ...all[i],
    reviewStatus,
    reviewNote: String(req.body.reviewNote || '').slice(0, 500)
  };
  write(all);
  res.json(all[i]);
});

app.post('/api/reset', (req, res) => {
  const host = String(req.ip || '');
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(host)) {
    return res.status(403).json({error: 'Reset is limited to local use.'});
  }
  write(seed);
  res.json({ok: true});
});

// Serve the production React application
const distPath = path.resolve(__dirname, '../dist');

app.use(express.static(distPath));

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ManuGuard API running on port ${PORT}`);
});
