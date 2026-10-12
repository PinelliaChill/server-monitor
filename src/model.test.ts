import { describe, expect, it } from 'vitest';
import { initialServers, statusOf, updateServers, visibleServers } from './model';
describe('模拟模型', () => {
 it('初始值与状态准确，默认 CPU 降序', () => { const servers=initialServers(0); expect(servers.map(s=>[s.cpu,s.memory])).toEqual([[45,62],[82,78],[23,45],[91,88],[67,55]]); expect(visibleServers(servers,'all','desc').map(s=>s.id)).toEqual(['srv-04','srv-02','srv-05','srv-01','srv-03']); });
 it('状态使用较高资源值，准确处理 80/90 边界',()=>{expect(statusOf({cpu:0,memory:79})).toBe('normal');expect(statusOf({cpu:0,memory:80})).toBe('warning');expect(statusOf({cpu:89,memory:0})).toBe('warning');expect(statusOf({cpu:0,memory:90})).toBe('critical');});
 it('独立波动并截断 0 与 100',()=>{const s=initialServers(0);s[0].cpu=1;s[0].memory=99;let i=0;const updated=updateServers(s,2000,()=>i++%2===0?0:.9999);expect(updated[0].cpu).toBe(0);expect(updated[0].memory).toBe(100);expect(updated[1].cpu).toBe(77);expect(updated[1].memory).toBe(83);});
 it('历史仅包含真实样本，最多31点且跨度不超过60秒',()=>{let s=initialServers(0);expect(s[0].history).toHaveLength(1);for(let n=1;n<=35;n++)s=updateServers(s,n*2000,()=>.5);expect(s[0].history).toHaveLength(31);expect(s[0].history[0].at).toBe(10000);expect(s[0].history.at(-1)!.at).toBe(70000);});
 it('同值以id排序，筛选实时派生',()=>{const s=initialServers(0);s.forEach(x=>x.cpu=80);expect(visibleServers(s,'warning','asc').map(x=>x.id)).toEqual(['srv-01','srv-02','srv-03','srv-04','srv-05']);expect(visibleServers(updateServers(s,2000,()=>0),'warning','desc')).toHaveLength(1);});
});
