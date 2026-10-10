import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {Activity, AlertTriangle, CheckCircle2, ClipboardCheck, Factory, FilePlus2, History, LayoutDashboard, Search, ShieldCheck, Wrench} from 'lucide-react';
import type {Analysis, Equipment, RecordItem, ReviewStatus} from './types';

type View = 'dashboard' | 'equipment' | 'add' | 'history' | 'risk' | 'review';
const SCORE: Record<string, number> = {Low: 1, Medium: 2, High: 3, Critical: 4};

const api = async <T = unknown>(path: string, options?: RequestInit): Promise<T> => {
  let r: Response;
  try {
    r = await fetch('/api' + path, {headers: {'Content-Type': 'application/json'}, ...options});
  } catch {
    throw new Error('Unable to reach the ManuGuard API. Confirm the local server is running.');
  }
  const text = await r.text();
  let j: {error?: string} = {};
  try { j = text ? JSON.parse(text) : {}; } catch { throw new Error(r.ok ? 'Unexpected server response.' : 'Request failed.'); }
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j as T;
};

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const refresh = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [e, r] = await Promise.all([api('/equipment'), api('/records')]);
      setEquipment(Array.isArray(e) ? e : []);
      setRecords(Array.isArray(r) ? r : []);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Could not load maintenance data.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); }, []);
  const nav = [
    ['dashboard', 'Dashboard', LayoutDashboard],
    ['equipment', 'Equipment', Factory],
    ['add', 'Add Maintenance Note', FilePlus2],
    ['history', 'Maintenance History', History],
    ['risk', 'Risk Dashboard', AlertTriangle],
    ['review', 'Human Review', ClipboardCheck]
  ] as const;

  return (
    <div className="app">
      <aside>
        <div className="brand">
          <div className="logo" aria-hidden="true"><ShieldCheck/></div>
          <div><b>ManuGuard AI</b><small>Maintenance Intelligence</small></div>
        </div>
        <nav aria-label="Main">
          {nav.map(([id, label, Icon]) => (
            <button key={id} type="button" className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>
              <Icon size={18} aria-hidden="true"/>{label}
            </button>
          ))}
        </nav>
        <div className="side-note">
          <ShieldCheck size={18} aria-hidden="true"/>
          <b>Human-in-the-loop</b>
          <span>AI recommendations require human review before they become maintenance decisions.</span>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <span className="eyebrow">MANUFACTURING OPERATIONS</span>
            <h1>{nav.find(n => n[0] === view)?.[1]}</h1>
          </div>
          <div className="status"><span aria-hidden="true"></span> Local MVP</div>
        </header>
        <div className="notice" role="note">
          <ShieldCheck size={18} aria-hidden="true"/>
          <div>
            <b>Responsible AI notice</b>
            <span>ManuGuard provides decision support only. Follow site safety procedures and qualified maintenance judgment for final actions.</span>
          </div>
        </div>
        {loading ? <div className="empty" role="status" aria-live="polite">Loading maintenance data…</div>
          : loadError ? <div className="empty" role="alert"><b>Could not load data</b><span>{loadError}</span><button type="button" className="primary" onClick={() => void refresh()}>Retry</button></div>
          : <ViewContent view={view} equipment={equipment} records={records} refresh={refresh} go={setView}/>}
      </main>
    </div>
  );
}

function ViewContent({view, equipment, records, refresh, go}: {view: View, equipment: Equipment[], records: RecordItem[], refresh: () => Promise<void>, go: (v: View) => void}) {
  if (view === 'dashboard') return <Dashboard equipment={equipment} records={records} go={go}/>;
  if (view === 'equipment') return <EquipmentView equipment={equipment} records={records}/>;
  if (view === 'add') return <AddNote equipment={equipment} refresh={refresh} go={go}/>;
  if (view === 'history') return <HistoryView records={records} go={go}/>;
  if (view === 'risk') return <RiskView equipment={equipment} records={records}/>;
  return <ReviewView records={records} refresh={refresh}/>;
}

function Dashboard({equipment, records, go}: {equipment: Equipment[], records: RecordItem[], go: (v: View) => void}) {
  const high = records.filter(r => ['High', 'Critical'].includes(r.analysis?.priority)).length;
  const rec = records.filter(r => r.analysis?.recurring).length;
  const pending = records.filter(r => r.reviewStatus === 'Pending').length;
  return (
    <>
      <div className="metrics">
        <Metric label="Equipment Tracked" value={equipment.length} icon={<Factory aria-hidden="true"/>}/>
        <Metric label="High / Critical" value={high} icon={<AlertTriangle aria-hidden="true"/>}/>
        <Metric label="Recurring Signals" value={rec} icon={<Activity aria-hidden="true"/>}/>
        <Metric label="Awaiting Review" value={pending} icon={<ClipboardCheck aria-hidden="true"/>}/>
      </div>
      <section className="grid2">
        <div className="card">
          <div className="cardhead">
            <div><span className="eyebrow">PRIORITY QUEUE</span><h2>Records needing attention</h2></div>
            <button type="button" className="link" onClick={() => go('risk')}>View risk dashboard</button>
          </div>
          {records.filter(r => ['High', 'Critical'].includes(r.analysis?.priority)).slice(0, 4).map(r => <RecordRow key={r.id} r={r}/>)}
        </div>
        <div className="card">
          <span className="eyebrow">WORKFLOW</span>
          <h2>From note to reviewed decision</h2>
          <div className="steps">
            <Step n="01" t="Capture" d="Technician enters an equipment note."/>
            <Step n="02" t="Analyze" d="AI-style logic structures the issue and priority."/>
            <Step n="03" t="Compare" d="History is checked for recurring signals."/>
            <Step n="04" t="Review" d="A human accepts, edits, or rejects the recommendation."/>
          </div>
          <button type="button" className="primary" onClick={() => go('add')}><FilePlus2 size={17} aria-hidden="true"/> Add maintenance note</button>
        </div>
      </section>
    </>
  );
}

function Metric({label, value, icon}: {label: string, value: number, icon: ReactNode}) {
  return <div className="metric"><div className="metricicon">{icon}</div><div><strong>{value}</strong><span>{label}</span></div></div>;
}

function EquipmentView({equipment, records}: {equipment: Equipment[], records: RecordItem[]}) {
  return (
    <div className="card">
      <div className="cardhead"><div><span className="eyebrow">ASSET REGISTER</span><h2>Equipment overview</h2></div></div>
      <div className="table" role="table" aria-label="Equipment overview">
        <div className="tr th" role="row"><span role="columnheader">Equipment</span><span role="columnheader">Area</span><span role="columnheader">Status</span><span role="columnheader">Records</span></div>
        {equipment.map(e => (
          <div className="tr" role="row" key={e.id}>
            <span role="cell"><b>{e.name}</b><small>{e.type}</small></span>
            <span role="cell">{e.area}</span>
            <span role="cell"><span className={'pill ' + e.status.toLowerCase().replace(' ', '')}>{e.status}</span></span>
            <span role="cell">{records.filter(r => r.equipmentId === e.id).length}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddNote({equipment, refresh, go}: {equipment: Equipment[], refresh: () => Promise<void>, go: (v: View) => void}) {
  const examples = [
    {name: 'Press vibration + heat', equipmentId: 'eq1', note: 'Hydraulic Press HP-04 has stronger vibration during the high-pressure cycle again. Oil temperature reached 188°F near the end of the shift and the operator noticed a louder pump sound. No visible leak, but this has happened more than once this month.'},
    {name: 'Conveyor tracking alarm', equipmentId: 'eq2', note: 'Conveyor CV-12 triggered an intermittent belt tracking alarm three times during packaging. The belt is drifting toward the drive side and there is light material buildup near one roller. Production can continue at reduced speed but the issue keeps returning.'},
    {name: 'Compressor pressure loss', equipmentId: 'eq4', note: 'Air Compressor AC-02 had a sudden pressure loss followed by an automatic shutdown. The discharge area felt unusually hot before the trip. Operators restarted once, but pressure began dropping again. Equipment is currently stopped pending maintenance review.'}
  ];
  const [equipmentId, setEquipmentId] = useState(equipment[0]?.id || '');
  const [note, setNote] = useState('');
  const [example, setExample] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loadExample = () => {
    const x = examples.find(e => e.name === example);
    if (x) { setEquipmentId(x.equipmentId); setNote(x.note); setAnalysis(null); setError(''); }
  };
  const analyze = async () => {
    setError('');
    setAnalysis(null);
    if (!equipmentId) { setError('Select equipment before analyzing.'); return; }
    if (note.trim().length < 12) { setError('Enter at least 12 characters of maintenance detail.'); return; }
    setBusy(true);
    try { setAnalysis(await api<Analysis>('/analyze', {method: 'POST', body: JSON.stringify({equipmentId, note})})); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Analysis failed.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!analysis || busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/records', {method: 'POST', body: JSON.stringify({equipmentId, note, analysis})});
      await refresh();
      go('review');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save the record.');
    } finally { setBusy(false); }
  };
  return (
    <div className="grid2">
      <div className="card">
        <span className="eyebrow">NEW MAINTENANCE CASE</span>
        <h2>Create and analyze a maintenance case</h2>
        <p className="sub">Enter a new case from scratch or load a demo scenario for testing.</p>
        <div className="examplebar">
          <label>Example case
            <select value={example} onChange={e => setExample(e.target.value)}>
              <option value="">Choose a demo scenario</option>
              {examples.map(x => <option key={x.name}>{x.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={loadExample} disabled={!example}>Prefill Case</button>
          <button type="button" onClick={() => { setExample(''); setEquipmentId(equipment[0]?.id || ''); setNote(''); setAnalysis(null); setError(''); }}>Start Blank Case</button>
        </div>
        <label>Equipment
          <select value={equipmentId} onChange={e => { setEquipmentId(e.target.value); setAnalysis(null); }}>
            {!equipment.length && <option value="">No equipment loaded</option>}
            {equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label>Maintenance note
          <textarea value={note} onChange={e => { setNote(e.target.value); setAnalysis(null); }} maxLength={3000} placeholder="Example: Pump vibration has increased over the last three shifts and casing temperature is higher than normal…"/>
        </label>
        <div className="helper">Include symptoms, timing, alarms, operating conditions, and anything that changed.</div>
        {error && <div className="error" role="alert">{error}</div>}
        <button type="button" className="primary" onClick={() => void analyze()} disabled={busy} aria-busy={busy}>{busy ? (analysis ? 'Saving…' : 'Analyzing…') : 'Analyze maintenance note'}</button>
      </div>
      <div className="card analysis">
        <span className="eyebrow">STRUCTURED RECOMMENDATION</span>
        {!analysis ? (
          <div className="empty">
            <Wrench size={32} aria-hidden="true"/>
            <b>No analysis yet</b>
            <span>Submit a maintenance note to generate a summary, classification, priority and next step.</span>
          </div>
        ) : (
          <>
            <div className="analysisTop">
              <Priority p={analysis.priority}/>
              {analysis.recurring && <span className="repeat">Recurring signal · {analysis.matchedRecords} match</span>}
            </div>
            <h2>{analysis.summary}</h2>
            <p className="sub">Suggested for human review. This is not an automatic maintenance or safety decision.</p>
            <Info label="Issue category" value={analysis.category}/>
            <Info label="Why this priority?" value={analysis.explanation}/>
            <Info label="Recommended next step" value={analysis.nextStep}/>
            <button type="button" className="primary" onClick={() => void save()} disabled={busy}><CheckCircle2 size={17} aria-hidden="true"/> Save for human review</button>
          </>
        )}
      </div>
    </div>
  );
}

function HistoryView({records, go}: {records: RecordItem[], go: (v: View) => void}) {
  const [q, setQ] = useState('');
  const [p, setP] = useState('All');
  const filtered = useMemo(() => records.filter(r =>
    ((r.equipmentName || '') + ' ' + (r.note || '') + ' ' + (r.analysis?.category || '')).toLowerCase().includes(q.toLowerCase()) &&
    (p === 'All' || r.analysis?.priority === p)
  ), [records, q, p]);
  return (
    <div className="card">
      <div className="cardhead">
        <div><span className="eyebrow">SEARCH & FILTER</span><h2>Maintenance record history</h2></div>
        <div className="filters">
          <button type="button" className="primary" onClick={() => go('add')}><FilePlus2 size={15} aria-hidden="true"/> Add New Case</button>
          <div className="search">
            <Search size={16} aria-hidden="true"/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search notes or equipment" aria-label="Search notes or equipment"/>
          </div>
          <label className="sr-only" htmlFor="priority-filter">Filter by priority</label>
          <select id="priority-filter" value={p} onChange={e => setP(e.target.value)} aria-label="Filter by priority">
            <option>All</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
          </select>
        </div>
      </div>
      {filtered.length ? filtered.map(r => <RecordRow key={r.id} r={r}/>) : <div className="empty">No matching records.</div>}
    </div>
  );
}

function RiskView({equipment, records}: {equipment: Equipment[], records: RecordItem[]}) {
  const ranked = equipment.map(e => {
    const rr = records.filter(r => r.equipmentId === e.id);
    const score = rr.reduce((s, r) => s + (SCORE[r.analysis?.priority] || 0) + (r.analysis?.recurring ? 1 : 0), 0);
    return {...e, score, count: rr.length, recurring: rr.filter(r => r.analysis?.recurring).length};
  }).sort((a, b) => b.score - a.score);
  return (
    <div className="card">
      <span className="eyebrow">PRIORITIZATION</span>
      <h2>Equipment risk dashboard</h2>
      <p className="sub">A transparent MVP score combines record priority and recurring-pattern signals. It supports review; it does not authorize maintenance action.</p>
      <div className="risklist">
        {ranked.map((e, i) => (
          <div className="risk" key={e.id}>
            <div className="rank">0{i + 1}</div>
            <div className="grow"><b>{e.name}</b><span>{e.area} · {e.count} record(s) · {e.recurring} recurring</span></div>
            <div className="score"><b>{e.score}</b><span>risk score</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewView({records, refresh}: {records: RecordItem[], refresh: () => Promise<void>}) {
  const pending = records.filter(r => r.reviewStatus === 'Pending');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const decide = async (id: string, status: ReviewStatus) => {
    if (busyId) return;
    setBusyId(id);
    setError('');
    try {
      await api('/records/' + encodeURIComponent(id) + '/review', {method: 'PATCH', body: JSON.stringify({reviewStatus: status})});
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Review update failed.');
    } finally { setBusyId(''); }
  };
  return (
    <div className="card">
      <span className="eyebrow">HUMAN OVERSIGHT</span>
      <h2>Review AI recommendations</h2>
      <p className="sub">A supervisor or technician remains responsible for the final decision.</p>
      {error && <div className="error" role="alert">{error}</div>}
      {pending.length ? pending.map(r => (
        <div className="review" key={r.id}>
          <div className="reviewTop">
            <div><b>{r.equipmentName}</b><span>{r.date}</span></div>
            <Priority p={r.analysis?.priority || 'Medium'}/>
          </div>
          <p>{r.note}</p>
          <Info label="AI recommendation" value={`${r.analysis?.category || 'Unclassified'} — ${r.analysis?.nextStep || 'No next step provided.'}`}/>
          <div className="actions">
            <button type="button" className="accept" disabled={!!busyId} onClick={() => void decide(r.id, 'Accepted')}>Accept</button>
            <button type="button" className="edit" disabled={!!busyId} onClick={() => void decide(r.id, 'Edited')}>Accept with edit</button>
            <button type="button" className="reject" disabled={!!busyId} onClick={() => void decide(r.id, 'Rejected')}>Reject</button>
          </div>
        </div>
      )) : (
        <div className="empty">
          <CheckCircle2 size={32} aria-hidden="true"/>
          <b>Review queue is clear</b>
          <span>There are no pending AI recommendations.</span>
        </div>
      )}
    </div>
  );
}

function RecordRow({r}: {r: RecordItem}) {
  return (
    <div className="record">
      <div className="grow">
        <div className="recordtitle"><b>{r.equipmentName}</b><Priority p={r.analysis?.priority || 'Medium'}/></div>
        <span>{r.analysis?.summary || r.note}</span>
        <small>{r.date} · {r.analysis?.category || 'Unclassified'} · Review: {r.reviewStatus}</small>
      </div>
      {r.analysis?.recurring && <span className="repeat">Recurring</span>}
    </div>
  );
}

function Priority({p}: {p: string}) {
  return <span className={'priority ' + p.toLowerCase()}>{p}</span>;
}

function Info({label, value}: {label: string, value: string}) {
  return <div className="info"><b>{label}</b><span>{value}</span></div>;
}

function Step({n, t, d}: {n: string, t: string, d: string}) {
  return <div className="step"><span>{n}</span><div><b>{t}</b><small>{d}</small></div></div>;
}
