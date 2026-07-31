import { useEffect, useState } from 'react';
import { ChevronRight, FilePenLine, History, Home, Maximize2, Minus, Plus, Rocket, Search, Upload } from 'lucide-react';
import { createDraft, loadProcess, loadProcessCatalog, publishDraft } from './api';
import { ContextPanel } from './ContextPanel';
import { ImportDialog } from './ImportDialog';
import { ProcessCanvas } from './ProcessCanvas';
import { VersionDialog } from './VersionDialog';
import type { ProcessImportResult, ProcessModel, ProcessNode, ProcessSummary } from './types';

export default function App() {
  const [catalog, setCatalog] = useState<ProcessSummary[]>([]);
  const [processId, setProcessId] = useState('');
  const [process, setProcess] = useState<ProcessModel>();
  const [selected, setSelected] = useState<ProcessNode>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [draftView, setDraftView] = useState(false);
  const [revisionBusy, setRevisionBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [zoomCommand, setZoomCommand] = useState({ id: 0, factor: 1 });
  const [fitCommand, setFitCommand] = useState(0);

  const refreshCatalog = async (preferredId?: string) => {
    const items = await loadProcessCatalog();
    setCatalog(items);
    const nextId = preferredId && items.some(item => item.id === preferredId)
      ? preferredId
      : items.find(item => item.id === processId)?.id ?? items[0]?.id ?? '';
    setProcessId(nextId);
  };

  useEffect(() => {
    const controller = new AbortController();
    loadProcessCatalog(controller.signal).then(items => {
      setCatalog(items);
      setProcessId(items.find(item => item.id === 'purchase-materials')?.id ?? items[0]?.id ?? '');
    }).catch(reason => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!processId) return;
    const controller = new AbortController();
    setSelected(undefined); setProcess(undefined); setError('');
    loadProcess(processId, controller.signal, draftView).then(setProcess)
      .catch(reason => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, [processId, draftView, reloadKey]);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2800);
  };

  const imported = async (result: ProcessImportResult) => {
    setImportOpen(false);
    await refreshCatalog(result.process.id);
    if (draftView) setReloadKey(value => value + 1);
    notify(draftView ? 'BPMN черновика обновлена' : `Импортирован процесс «${result.process.name}»`);
  };

  const beginRevision = async () => {
    setRevisionBusy(true);
    try { await createDraft(processId); await refreshCatalog(processId); setDraftView(true); notify('Создана новая редакция процесса'); }
    catch (reason) { notify(reason instanceof Error ? reason.message : 'Не удалось создать редакцию'); }
    finally { setRevisionBusy(false); }
  };

  const publishRevision = async () => {
    if (!process) return;
    const version = process.version;
    if (!window.confirm(`Опубликовать версию ${version}? Текущая версия будет сохранена в истории.`)) return;
    setRevisionBusy(true);
    try { await publishDraft(processId); setDraftView(false); await refreshCatalog(processId); setReloadKey(value => value + 1); notify(`Версия ${version} опубликована`); }
    catch (reason) { notify(reason instanceof Error ? reason.message : 'Не удалось опубликовать редакцию'); }
    finally { setRevisionBusy(false); }
  };

  if (error) return <main className="state-page"><h1>Не удалось открыть Process Navigator</h1><p>{error}</p><button onClick={() => location.reload()}>Повторить</button></main>;
  if (!process) return <main className="state-page"><div className="loader"/><p>{catalog.length ? 'Загружаем карту процесса…' : 'Загружаем каталог процессов…'}</p></main>;

  return <div className="app-shell">
    <header><div className="brand"><span className="brand-mark">PN</span><span>Process Navigator</span></div><nav aria-label="Навигация"><Home size={16}/><span>ООО «Демо»</span><ChevronRight size={15}/><span>Процессы</span><ChevronRight size={15}/><select className="process-select" value={processId} onChange={event => { setProcessId(event.target.value); setDraftView(false); }} aria-label="Выбрать процесс">{catalog.map(item => <option key={item.id} value={item.id}>{item.name} · {item.hasDraft ? `черновик ${item.draftVersion}` : item.status}</option>)}</select></nav><button className="header-action" onClick={() => setImportOpen(true)}><Upload size={17}/>Импорт</button><button className="search"><Search size={17}/>Поиск</button></header>
    <div className="process-bar"><div><span className={`eyebrow ${draftView ? 'is-draft' : ''}`}>{draftView ? 'Черновик' : 'Действующая версия'} {process.version}</span><h1>{process.name}</h1></div><div className="revision-actions"><button className="revision-button" onClick={() => setVersionsOpen(true)}><History size={15}/>История</button>{draftView ? <><button className="revision-button" onClick={() => setImportOpen(true)} disabled={revisionBusy}><Upload size={15}/>Заменить BPMN</button><button className="revision-button is-primary" onClick={publishRevision} disabled={revisionBusy}><Rocket size={15}/>Опубликовать</button></> : catalog.find(item => item.id === processId)?.hasDraft ? <button className="revision-button" onClick={() => setDraftView(true)}><FilePenLine size={15}/>Открыть черновик</button> : <button className="revision-button" onClick={beginRevision} disabled={revisionBusy}><FilePenLine size={15}/>Новая редакция</button>}</div><div className="owner">Владелец процесса<strong>{process.owner}</strong></div><div className="view-controls"><button aria-label="Уменьшить" onClick={() => setZoomCommand(command => ({ id: command.id + 1, factor: 1 / 1.25 }))}><Minus size={18}/></button><button aria-label="Показать весь процесс" onClick={() => { setFitCommand(command => command + 1); setSelected(undefined); }}><Maximize2 size={18}/><span>Весь процесс</span></button><button aria-label="Увеличить" onClick={() => setZoomCommand(command => ({ id: command.id + 1, factor: 1.25 }))}><Plus size={18}/></button></div></div>
    <main className="workspace"><ProcessCanvas key={process.id} process={process} selectedId={selected?.id} onSelect={setSelected} zoomCommand={zoomCommand} fitCommand={fitCommand}/><ContextPanel node={selected} onClose={() => setSelected(undefined)} onAction={notify}/></main>
    <footer><span>BPMN 2.0 · только просмотр</span><span>{process.nodes.length} элементов · {process.lanes.length} роли</span><span>Canvas занимает {selected ? '76%' : '100%'} рабочего пространства</span></footer>
    {message && <div className="toast">{message}</div>}
    {importOpen && (
      <ImportDialog onClose={() => setImportOpen(false)} onImported={imported} processId={draftView ? processId : undefined}/>
    )}
    {versionsOpen && (
      <VersionDialog processId={processId} processName={process.name} onClose={() => setVersionsOpen(false)}/>
    )}
  </div>;
}
