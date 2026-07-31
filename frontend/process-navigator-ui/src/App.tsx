import { useEffect, useState } from 'react';
import { ChevronRight, Home, Maximize2, Minus, Plus, Search } from 'lucide-react';
import { loadProcess } from './api';
import { ContextPanel } from './ContextPanel';
import { ProcessCanvas } from './ProcessCanvas';
import type { ProcessModel, ProcessNode } from './types';

export default function App() {
  const [process, setProcess] = useState<ProcessModel>();
  const [selected, setSelected] = useState<ProcessNode>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [zoomCommand, setZoomCommand] = useState({ id: 0, factor: 1 });
  const [fitCommand, setFitCommand] = useState(0);
  useEffect(() => { const controller = new AbortController(); loadProcess('purchase-materials', controller.signal).then(setProcess).catch(e => { if (e.name !== 'AbortError') setError(e.message); }); return () => controller.abort(); }, []);
  const notify = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(''), 2800); };
  if (error) return <main className="state-page"><h1>Не удалось открыть Process Navigator</h1><p>{error}</p><button onClick={() => location.reload()}>Повторить</button></main>;
  if (!process) return <main className="state-page"><div className="loader"/><p>Загружаем карту процесса…</p></main>;
  return <div className="app-shell"><header><div className="brand"><span className="brand-mark">PN</span><span>Process Navigator</span></div><nav aria-label="Навигация"><Home size={16}/><span>ООО «Демо»</span><ChevronRight size={15}/><span>Закупки</span><ChevronRight size={15}/><strong>{process.name}</strong></nav><button className="search"><Search size={17}/>Поиск</button></header>
    <div className="process-bar"><div><span className="eyebrow">Действующая версия {process.version}</span><h1>{process.name}</h1></div><div className="owner">Владелец процесса<strong>{process.owner}</strong></div><div className="view-controls"><button aria-label="Уменьшить" onClick={() => setZoomCommand(command => ({ id: command.id + 1, factor: 1 / 1.25 }))}><Minus size={18}/></button><button aria-label="Показать весь процесс" onClick={() => { setFitCommand(command => command + 1); setSelected(undefined); }}><Maximize2 size={18}/><span>Весь процесс</span></button><button aria-label="Увеличить" onClick={() => setZoomCommand(command => ({ id: command.id + 1, factor: 1.25 }))}><Plus size={18}/></button></div></div>
    <main className="workspace"><ProcessCanvas process={process} selectedId={selected?.id} onSelect={setSelected} zoomCommand={zoomCommand} fitCommand={fitCommand}/><ContextPanel node={selected} onClose={() => setSelected(undefined)} onAction={notify}/></main>
    <footer><span>BPMN 2.0 · только просмотр</span><span>{process.nodes.length} элементов · {process.lanes.length} роли</span><span>Canvas занимает {selected ? '76%' : '100%'} рабочего пространства</span></footer>{message && <div className="toast">{message}</div>}</div>;
}
