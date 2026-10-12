import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { initialServers, statusLabels, statusOf, updateServers, visibleServers, type Server, type Status } from './model';

type IconName = 'server' | 'pulse' | 'clock' | 'chevron' | 'check' | 'warning' | 'arrow' | 'grid';
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    server: <>
      <rect x="4" y="3" width="16" height="7" rx="2"/>
      <rect x="4" y="14" width="16" height="7" rx="2"/>
      <path d="M8 6.5h.01M8 17.5h.01M12 7h5M12 18h5"/>
      </>,
    pulse: <path d="M2 12h5l3-8 4 16 3-8h5"/>, clock: <>
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3 2"/>
      </>,
    chevron: <path d="m9 5 7 7-7 7"/>, check: <>
      <circle cx="12" cy="12" r="9"/>
      <path d="m8 12 3 3 5-6"/>
      </>,
    warning: <>
      <path d="m10.3 4-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z"/>
      <path d="M12 9v5m0 3h.01"/>
      </>,
    arrow: <>
      <path d="M8 4v16m-4-4 4 4 4-4M16 20V4m-4 4 4-4 4 4"/>
      </>,
    grid: <>
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
      </>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function NumberDisplay({ value }: { value: number }) {
  return <span className="number" aria-label={`${value}`}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="digits">{String(value).split('').map((digit, index) => <span className="digit-window" key={index}>
      <span className="digit-reel" style={{ transform: `translateY(-${Number(digit) * 10}%)` }}>{Array.from({ length: 10 }, (_, n) => <span key={n}>{n}</span>)}</span>
      </span>)}</span>
      </span>; }
function Meter({ label, value, kind }: { label: string; value: number; kind: 'cpu' | 'memory' }) {
  return <div className={`metric ${kind}`}>
      <div className="metric-top">
      <span>{label}</span>
      <strong>
      <NumberDisplay value={value}/>
      <span className="percent">%</span>
      </strong>
      </div>
      <div className="meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span style={{ transform: `scaleX(${value / 100})` }}/>
      </div>
      </div>; }
function Trend({ server }: { server: Server }) {
  const history = server.history, latest = history[history.length - 1].at;
  const x = (at: number) => 12 + ((at - (latest - 60_000)) / 60_000) * 396;
  const y = (value: number) => 112 - value * .88;
  const line = (key: 'cpu' | 'memory') => history.map(p => `${x(p.at)},${y(p[key])}`).join(' ');
  return <div className="trend">
      <div className="trend-heading">
      <strong>最近 60 秒</strong>
      <div className="legend">
      <span className="cpu-dot"/>CPU<span className="memory-dot"/>内存</div>
      </div>
      <svg viewBox="0 0 420 140" role="img" aria-label={`${server.name}最近60秒CPU与内存趋势，${history.length}个真实模拟采样点`}>
      <g className="chart-grid">{[0, 50, 100].map(n => <g key={n}>
      <line x1="12" y1={y(n)} x2="408" y2={y(n)}/>
      <text x="14" y={y(n)-5}>{n}%</text>
      </g>)}</g>
      <polyline className="cpu-line" points={line('cpu')}/>
      <polyline className="memory-line" points={line('memory')}/>{history.length === 1 && <>
      <circle cx={x(latest)} cy={y(server.cpu)} r="3" className="cpu-point"/>
      <circle cx={x(latest)} cy={y(server.memory)} r="3" className="memory-point"/>
      </>}<text className="chart-time" x="12" y="135">60 秒前</text>
      <text className="chart-time" x="408" y="135" textAnchor="end">现在</text>
      </svg>
      <p className="sample-note">{history.length === 1 ? '开始采样，趋势将随刷新逐步生成' : `已采集 ${history.length} 个模拟样本 · 每 2 秒更新`}</p>
      </div>;
}
function ServerCard({ server, expanded, onToggle }: { server: Server; expanded: boolean; onToggle: () => void }) {
  const status = statusOf(server), previousStatus = useRef(status), [changed, setChanged] = useState(false);
  useEffect(() => { if (previousStatus.current === status) return; previousStatus.current = status; setChanged(true); const timer = setTimeout(() => setChanged(false), 650); return () => clearTimeout(timer); }, [status]);
  return <article className={`server-card ${status}${changed ? ' status-changed' : ''}${expanded ? ' expanded' : ''}`} data-server-id={server.id}>
      <button className="card-button" onClick={onToggle} aria-expanded={expanded} aria-controls={`details-${server.id}`} aria-label={`${server.name}，${statusLabels[status]}，${expanded ? '收起' : '展开'}详情`}>
      <div className="card-heading">
      <div className="server-icon">
      <Icon name="server" size={23}/>
      </div>
      <div className="server-name">
      <h3>{server.name}</h3>
      <span>节点 · {server.id}</span>
      </div>
      <span className={`status-badge ${status}`}>
      <i/>{statusLabels[status]}</span>
      </div>
      <div className="metrics">
      <Meter label="CPU 使用率" value={server.cpu} kind="cpu"/>
      <Meter label="内存使用率" value={server.memory} kind="memory"/>
      </div>
      <div className="card-footer">
      <span>
      <span className="small-dot"/>模拟监控中</span>
      <span className="detail-toggle">{expanded ? '收起详情' : '查看详情'}<span className="chevron">
      <Icon name="chevron" size={14}/>
      </span>
      </span>
      </div>
      </button>{expanded && <section id={`details-${server.id}`} className="card-details" aria-label={`${server.name}详情`}>
      <div className="detail-facts">
      <div>
      <span>服务器 ID</span>
      <strong>{server.id}</strong>
      </div>
      <div>
      <span>运行时长</span>
      <strong>{server.uptime}</strong>
      </div>
      </div>
      <Trend server={server}/>
      </section>}</article>;
}
export default function App() {
  const [servers, setServers] = useState(initialServers), [filter, setFilter] = useState<Status | 'all'>('all'), [direction, setDirection] = useState<'asc' | 'desc'>('desc'), [expanded, setExpanded] = useState<Set<string>>(new Set());
  const grid = useRef<HTMLDivElement>(null), positions = useRef(new Map<string, DOMRect>());
  useEffect(() => { const timer = setInterval(() => { const at = Date.now(); const samples = Array.from({ length: 10 }, () => Math.random()); setServers(current => { let index = 0; return updateServers(current, at, () => samples[index++]); }); }, 2000); return () => clearInterval(timer); }, []);
  const visible = visibleServers(servers, filter, direction), lastUpdated = servers[0].history.at(-1)!.at;
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    grid.current?.querySelectorAll<HTMLElement>('[data-server-id]').forEach(card => { const id = card.dataset.serverId!, rect = card.getBoundingClientRect(), before = positions.current.get(id); next.set(id, rect); if (before && card.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { const dx = before.left - rect.left, dy = before.top - rect.top; if (dx || dy) card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: 280, easing: 'ease-out' }); } }); positions.current = next;
  }, [servers, filter, direction, expanded]);
  const counts = { normal: 0, warning: 0, critical: 0 }; servers.forEach(server => counts[statusOf(server)]++);
  const toggle = (id: string) => setExpanded(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return <>
      <header className="topbar">
      <div className="topbar-inner">
      <a className="brand" href="#">
      <span className="brand-symbol">
      <Icon name="server" size={22}/>
      </span>节点瞭望<span className="brand-divider"/>
      <span className="brand-subtitle">运维控制台</span>
      </a>
      <span className="environment">
      <span/>模拟环境</span>
      </div>
      </header>
      <main>
      <div className="page-heading">
      <div>
      <div className="eyebrow">
      <Icon name="pulse" size={15}/>基础设施 / 实时概览</div>
      <h1>服务器监控<span className="heading-dot"/>
      </h1>
      <p>一眼掌握资源状态，让每一次运行都心中有数。</p>
      </div>
      <div className="refresh-info">
      <span className="refresh-label">
      <span className="live-dot"/>每 2 秒自动刷新</span>
      <span className="updated">
      <Icon name="clock" size={14}/>更新于 <time dateTime={new Date(lastUpdated).toISOString()}>{new Date(lastUpdated).toLocaleTimeString('zh-CN', { hour12: false })}</time>
      </span>
      </div>
      </div>
      <section className="summary" aria-label="服务器状态统计">
      <div className="summary-item total">
      <div className="summary-icon">
      <Icon name="server"/>
      </div>
      <div>
      <span>服务器总数</span>
      <strong>05<span>台</span>
      </strong>
      </div>
      <span className="summary-note">全部节点</span>
      </div>{(['normal','warning','critical'] as Status[]).map(status => <div className={`summary-item ${status}`} key={status}>
      <div className="summary-icon">
      <Icon name={status === 'normal' ? 'check' : 'warning'}/>
      </div>
      <div>
      <span>{statusLabels[status]}</span>
      <strong>{String(counts[status]).padStart(2, '0')}<span>台</span>
      </strong>
      </div>
      <span className="summary-note">{status === 'normal' ? '资源运行平稳' : status === 'warning' ? '建议关注负载' : '资源负载较高'}</span>
      </div>)}</section>
      <section className="server-section" aria-labelledby="server-list-heading">
      <div className="section-heading">
      <h2 id="server-list-heading">
      <Icon name="grid" size={19}/>服务器列表<span>{visible.length}</span>
      </h2>
      <span className="section-caption">CPU 与内存实时资源概览</span>
      </div>
      <div className="toolbar">
      <div className="filters" role="group" aria-label="按服务器状态筛选">{(['all','normal','warning','critical'] as const).map(status => <button key={status} aria-pressed={filter === status} className={filter === status ? 'selected' : ''} onClick={() => setFilter(status)}>{status !== 'all' && <i className={`filter-dot ${status}`}/>} {status === 'all' ? '全部服务器' : statusLabels[status]}<span>{status === 'all' ? servers.length : counts[status]}</span>
      </button>)}</div>
      <label className="sort-control">
      <Icon name="arrow" size={16}/>
      <span className="sr-only">CPU 排序</span>
      <select value={direction} onChange={event => setDirection(event.target.value as 'asc' | 'desc')} aria-label="CPU 排序">
      <option value="desc">CPU 使用率：从高到低</option>
      <option value="asc">CPU 使用率：从低到高</option>
      </select>
      </label>
      </div>
      <div className="server-grid" ref={grid}>{visible.map(server => <ServerCard key={server.id} server={server} expanded={expanded.has(server.id)} onToggle={() => toggle(server.id)}/>)}</div>{visible.length === 0 && <div className="empty">
      <Icon name="check" size={32}/>
      <h3>当前没有{statusLabels[filter as Status]}服务器</h3>
      <p>所有状态会随模拟数据刷新自动更新。</p>
      <button onClick={() => setFilter('all')}>查看全部服务器</button>
      </div>}</section>
      <footer className="page-footer">
      <span>
      <Icon name="pulse" size={14}/>模拟数据 · 仅用于演示，不连接真实服务器</span>
      <span>状态按 CPU / 内存较高值判断 · ≥80% 警告，≥90% 严重</span>
      </footer>
      </main>
      </>;
}
