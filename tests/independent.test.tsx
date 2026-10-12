import React, { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { initialServers, statusOf, updateServers, visibleServers } from '../src/model';
import App from '../src/App';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('独立模型验收', () => {
  it('原始五台数据、状态分布和默认排序', () => {
    const servers = initialServers(1000);
    expect(servers.map(s => [s.cpu, s.memory])).toEqual([[45,62],[82,78],[23,45],[91,88],[67,55]]);
    expect(servers.map(statusOf)).toEqual(['normal','warning','normal','critical','normal']);
    expect(servers.map(s => s.history)).toEqual(servers.map(s => [{at:1000,cpu:s.cpu,memory:s.memory}]));
    expect(visibleServers(servers,'all','desc').map(s => s.id)).toEqual(['srv-04','srv-02','srv-05','srv-01','srv-03']);
  });
  it('80/90 精确边界及内存单独触发', () => {
    for (const [cpu,memory,status] of [[79,79,'normal'],[80,0,'warning'],[0,80,'warning'],[89,89,'warning'],[90,0,'critical'],[0,90,'critical']] as const)
      expect(statusOf({cpu,memory})).toBe(status);
  });
  it('每台每项独立随机、含 -5 和 +5，0/100 封顶；输入不被修改', () => {
    const input = initialServers(0);
    input[0].cpu=2; input[0].memory=98;
    const before=structuredClone(input);
    const samples=[0,.999,.5,0,.999,.5,0,.999,.5,0];
    const rng=vi.fn(() => samples.shift()!);
    const result=updateServers(input,2000,rng);
    expect(rng).toHaveBeenCalledTimes(10);
    expect(result.map(s => [s.cpu,s.memory])).toEqual([[0,100],[82,73],[28,45],[86,93],[67,50]]);
    expect(input).toEqual(before);
  });
  it('采样只含真实更新，60秒窗口最多31，延迟采样不补造', () => {
    let servers=initialServers(0);
    for(let t=2000;t<=64000;t+=2000) servers=updateServers(servers,t,() => .5);
    expect(servers[0].history.map(s => s.at)).toEqual(Array.from({length:31},(_,i)=>4000+i*2000));
    servers=updateServers(servers,150000,()=>.5);
    expect(servers[0].history).toEqual([{at:150000,cpu:45,memory:62}]);
  });
  it('实时排序、同值id顺序、过滤空态', () => {
    const servers=initialServers(0);
    servers[0].cpu=82;
    expect(visibleServers(servers,'all','desc').map(s=>s.id)).toEqual(['srv-04','srv-01','srv-02','srv-05','srv-03']);
    expect(visibleServers(servers,'all','asc').map(s=>s.id)).toEqual(['srv-03','srv-05','srv-01','srv-02','srv-04']);
    const normal=servers.map(s=>({...s,cpu:0,memory:0}));
    expect(visibleServers(normal,'critical','desc')).toEqual([]);
    const updated=updateServers(servers,2000,()=>0);
    expect(visibleServers(updated,'warning','desc').map(s=>s.id)).toEqual(['srv-04']);
  });
});

describe('独立组件假时钟验收', () => {
  const order = () => [...document.querySelectorAll<HTMLElement>('[data-server-id]')].map(n=>n.dataset.serverId);
  const card = (id:string) => document.querySelector<HTMLElement>(`[data-server-id="${id}"]`)!;
  const advance = (ms:number) => act(()=>vi.advanceTimersByTime(ms));
  const setup = () => { vi.useFakeTimers(); vi.setSystemTime(0); return render(<StrictMode><App/></StrictMode>); };
  it('StrictMode保留一个2秒timer，每tick变化一次，卸载清理，重载原始值', () => {
    vi.spyOn(Math,'random').mockReturnValue(.999);
    const view=setup();
    expect(vi.getTimerCount()).toBe(1);
    advance(1999);
    expect(card('srv-01').querySelector('[role="progressbar"]')).toHaveAttribute('aria-valuenow','45');
    advance(1);
    expect(card('srv-01').querySelector('[role="progressbar"]')).toHaveAttribute('aria-valuenow','50');
    advance(2000);
    expect(card('srv-01').querySelector('[role="progressbar"]')).toHaveAttribute('aria-valuenow','55');
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    render(<StrictMode><App/></StrictMode>);
    expect(card('srv-01').querySelector('[role="progressbar"]')).toHaveAttribute('aria-valuenow','45');
  });
  it('多卡展开在排序与过滤恢复后保留，历史仅真实采样且最多31', () => {
    vi.spyOn(Math,'random').mockReturnValue(.5); setup();
    fireEvent.click(card('srv-01').querySelector('button')!);
    fireEvent.click(card('srv-03').querySelector('button')!);
    expect(screen.getByRole('region',{name:'网页服务器详情'})).toHaveTextContent('15 天 3 小时');
    expect(screen.getByRole('region',{name:'缓存服务器详情'})).toHaveTextContent('30 天 1 小时');
    expect(screen.getByRole('img',{name:/网页服务器最近60秒.*1个/})).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('CPU 排序'),{target:{value:'asc'}});
    expect(order()).toEqual(['srv-03','srv-01','srv-05','srv-02','srv-04']);
    fireEvent.click(screen.getByRole('button',{name:/^警告/}));
    expect(order()).toEqual(['srv-02']);
    advance(2000);
    fireEvent.click(screen.getByRole('button',{name:/全部服务器/}));
    expect(card('srv-01').querySelector('button')).toHaveAttribute('aria-expanded','true');
    expect(card('srv-03').querySelector('button')).toHaveAttribute('aria-expanded','true');
    expect(screen.getByRole('img',{name:/网页服务器最近60秒.*2个/})).toBeInTheDocument();
    advance(64000);
    expect(screen.getByRole('img',{name:/网页服务器最近60秒.*31个/})).toBeInTheDocument();
  });
  it('数据变化即重新过滤；空态可返回全部；跨排名实时重排', () => {
    const random=vi.spyOn(Math,'random').mockReturnValue(0); setup();
    fireEvent.click(screen.getByRole('button',{name:/^严重/}));
    expect(order()).toEqual(['srv-04']);
    advance(2000);
    expect(order()).toEqual([]);
    expect(screen.getByText('当前没有严重服务器')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'查看全部服务器'}));
    // Database gains +5 while gateway loses -5: 77->82 crosses 86->81.
    const values=[.5,.5,.999,.5,.5,.5,0,.5,.5,.5];
    random.mockImplementation(()=>values.shift()??.5);
    advance(2000);
    expect(order().slice(0,2)).toEqual(['srv-02','srv-04']);
  });
});
