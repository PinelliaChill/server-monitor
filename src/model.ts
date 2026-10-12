export type Status = 'normal' | 'warning' | 'critical';
export type Sample = { at: number; cpu: number; memory: number };
export type Server = { id: string; name: string; role: string; cpu: number; memory: number; uptime: string; history: Sample[] };
export const statusLabels: Record<Status, string> = { normal: '正常', warning: '警告', critical: '严重' };
export function statusOf(server: Pick<Server, 'cpu' | 'memory'>): Status { const max = Math.max(server.cpu, server.memory); return max >= 90 ? 'critical' : max >= 80 ? 'warning' : 'normal'; }
export function initialServers(at = Date.now()): Server[] {
  return [
    { id: 'srv-01', name: '网页服务器', role: 'WEB SERVER', cpu: 45, memory: 62, uptime: '15 天 3 小时' },
    { id: 'srv-02', name: '数据库服务器', role: 'DATABASE', cpu: 82, memory: 78, uptime: '7 天 12 小时' },
    { id: 'srv-03', name: '缓存服务器', role: 'CACHE SERVER', cpu: 23, memory: 45, uptime: '30 天 1 小时' },
    { id: 'srv-04', name: 'API 网关', role: 'API GATEWAY', cpu: 91, memory: 88, uptime: '2 天 5 小时' },
    { id: 'srv-05', name: '工作节点', role: 'WORKER NODE', cpu: 67, memory: 55, uptime: '10 天 8 小时' },
  ].map(server => ({ ...server, history: [{ at, cpu: server.cpu, memory: server.memory }] }));
}
export function updateServers(servers: Server[], at: number, random = Math.random): Server[] {
  const next = (value: number) => Math.max(0, Math.min(100, value + Math.floor(random() * 11) - 5));
  return servers.map(server => { const cpu = next(server.cpu), memory = next(server.memory); return { ...server, cpu, memory, history: [...server.history, { at, cpu, memory }].filter(point => point.at >= at - 60_000).slice(-31) }; });
}
export function visibleServers(servers: Server[], filter: Status | 'all', direction: 'asc' | 'desc') { return servers.filter(server => filter === 'all' || statusOf(server) === filter).sort((a, b) => (direction === 'asc' ? a.cpu - b.cpu : b.cpu - a.cpu) || a.id.localeCompare(b.id)); }
