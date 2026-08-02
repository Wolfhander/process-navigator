import { lazy, Suspense, useEffect, useState } from 'react';
import { ChevronRight, FilePenLine, History, Home, Maximize2, Minus, PencilRuler, Plus, Rocket, RotateCcw, Search, Upload, Users } from 'lucide-react';
import { createDraft, loadArchivedProcess, loadProcess, loadProcessCatalog, loadSession, publishDraft, setActiveUser } from './api';
import { ContextPanel } from './ContextPanel';
import { ImportDialog } from './ImportDialog';
import { ProcessCanvas } from './ProcessCanvas';
import { VersionDialog } from './VersionDialog';
import { UserMenu } from './UserMenu';
import { UserAdminDialog } from './UserAdminDialog';
import type { ProcessImportResult, ProcessModel, ProcessNode, ProcessSummary, Session } from './types';

const BpmnEditor = lazy(() => import('./BpmnEditor').then(module => ({ default: module.BpmnEditor })));

export default function App() {
  const [catalog, setCatalog] = useState<ProcessSummary[]>([]);
  const [session, setSession] = useState<Session>();
  const [processId, setProcessId] = useState('');
  const [process, setProcess] = useState<ProcessModel>();
  const [selected, setSelected] = useState<ProcessNode>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [draftView, setDraftView] = useState(false);
  const [archivedVersion, setArchivedVersion] = useState<string>();
  const [revisionBusy, setRevisionBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
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
    const controller = new AbortController();
    loadSession(controller.signal).then(setSession).catch(reason => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!processId) return;
    const controller = new AbortController();
    setSelected(undefined); setProcess(undefined); setError('');
    const request = archivedVersion
      ? loadArchivedProcess(processId, archivedVersion, controller.signal)
      : loadProcess(processId, controller.signal, draftView);
    request.then(setProcess)
      .catch(reason => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, [processId, draftView, archivedVersion, reloadKey]);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2800);
  };

  const can = (permission: string) => session?.currentUser.permissions.includes(permission) === true;
  const changeUser = async (userId: string) => {
    setActiveUser(userId);
    const nextSession = await loadSession();
    setSession(nextSession);
    const mayOpenDraft = nextSession.currentUser.permissions.some(permission => ['process.diagram.edit', 'process.context.edit', 'process.publish'].includes(permission));
    if (!mayOpenDraft) { setDraftView(false); setArchivedVersion(undefined); setEditorOpen(false); }
    notify(`Текущий пользователь: ${nextSession.currentUser.displayName}`);
  };

  const imported = async (result: ProcessImportResult) => {
    setImportOpen(false);
    await refreshCatalog(result.process.id);
    if (draftView) setReloadKey(value => value + 1);
    notify(draftView ? 'BPMN черновика обновлена' : `Импортирован процесс «${result.process.name}»`);
  };

  const beginRevision = async () => {
    setRevisionBusy(true);
    try { await createDraft(processId); await refreshCatalog(processId); setArchivedVersion(undefined); setDraftView(true); notify('Создана новая редакция процесса'); }
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
  if (!process || !session) return <main className="state-page"><div className="loader"/><p>{catalog.length ? 'Загружаем рабочее пространство…' : 'Загружаем каталог процессов…'}</p></main>;

  return <div className="app-shell">
    <header><div className="brand"><span className="brand-mark">PN</span><span>Process Navigator</span></div><nav aria-label="Навигация"><Home size={16}/><span>ООО «Демо»</span><ChevronRight size={15}/><span>Процессы</span><ChevronRight size={15}/><select className="process-select" value={processId} onChange={event => { setProcessId(event.target.value); setDraftView(false); setArchivedVersion(undefined); setEditorOpen(false); }} aria-label="Выбрать процесс">{catalog.map(item => <option key={item.id} value={item.id}>{item.name} · {item.hasDraft ? `черновик ${item.draftVersion}` : item.status}</option>)}</select></nav>{can('process.import') && <button className="header-action" onClick={() => setImportOpen(true)}><Upload size={17}/>Импорт</button>}{can('users.manage') && <button className="header-action" onClick={() => setUsersOpen(true)}><Users size={17}/>Пользователи</button>}<UserMenu session={session} onChange={changeUser}/><button className="search"><Search size={17}/>Поиск</button></header>
    <div className="process-bar"><div><span className={`eyebrow ${draftView ? 'is-draft' : archivedVersion ? 'is-archive' : ''}`}>{archivedVersion ? 'Архивная версия' : draftView ? 'Черновик' : 'Действующая версия'} {process.version}</span><h1>{process.name}</h1></div><div className="revision-actions"><button className="revision-button" onClick={() => setVersionsOpen(true)}><History size={15}/>История</button>{archivedVersion ? <button className="revision-button is-primary" onClick={() => setArchivedVersion(undefined)}><RotateCcw size={15}/>К действующей</button> : draftView ? <>{can('process.diagram.edit') && <><button className="revision-button" onClick={() => setEditorOpen(true)}><PencilRuler size={15}/>Редактировать</button><button className="revision-button" onClick={() => setImportOpen(true)} disabled={revisionBusy}><Upload size={15}/>Заменить BPMN</button></>}{can('process.publish') && <button className="revision-button is-primary" onClick={publishRevision} disabled={revisionBusy}><Rocket size={15}/>Опубликовать</button>}</> : catalog.find(item => item.id === processId)?.hasDraft ? (can('process.diagram.edit') || can('process.context.edit') || can('process.publish')) && <button className="revision-button" onClick={() => setDraftView(true)}><FilePenLine size={15}/>Открыть черновик</button> : can('process.draft.create') && <button className="revision-button" onClick={beginRevision} disabled={revisionBusy}><FilePenLine size={15}/>Новая редакция</button>}</div><div className="owner">Владелец процесса<strong>{process.owner}</strong></div><div className="view-controls"><button aria-label="Уменьшить" onClick={() => setZoomCommand(command => ({ id: command.id + 1, factor: 1 / 1.25 }))}><Minus size={18}/></button><button aria-label="Показать весь процесс" onClick={() => { setFitCommand(command => command + 1); setSelected(undefined); }}><Maximize2 size={18}/><span>Весь процесс</span></button><button aria-label="Увеличить" onClick={() => setZoomCommand(command => ({ id: command.id + 1, factor: 1.25 }))}><Plus size={18}/></button></div></div>
    {editorOpen ? <main className="workspace workspace--editor"><Suspense fallback={<div className="editor-loading"><div className="loader"/>Запускаем локальный BPMN-редактор…</div>}><BpmnEditor processId={processId} processName={process.name} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); setReloadKey(value => value + 1); notify('BPMN черновика сохранена'); }}/></Suspense></main> : <main className="workspace"><ProcessCanvas key={`${process.id}:${process.version}:${draftView ? 'draft' : archivedVersion ?? 'published'}`} process={process} selectedId={selected?.id} onSelect={setSelected} zoomCommand={zoomCommand} fitCommand={fitCommand}/><ContextPanel processId={processId} node={selected} onClose={() => setSelected(undefined)} onAction={notify} onUpdated={updated => { setSelected(updated); setProcess(current => current ? { ...current, nodes: current.nodes.map(node => node.id === updated.id ? updated : node) } : current); notify('Контекст элемента сохранён'); }} canExecute={can('process.execute') && !archivedVersion} canEdit={draftView && can('process.context.edit')}/></main>}
    <footer><span>{editorOpen ? 'BPMN 2.0 · редактирование черновика' : 'BPMN 2.0 · только просмотр'}</span><span>{process.nodes.length} элементов · {process.lanes.length} роли</span><span>Canvas занимает {selected ? '76%' : '100%'} рабочего пространства</span></footer>
    {message && <div className="toast">{message}</div>}
    {importOpen && (
      <ImportDialog onClose={() => setImportOpen(false)} onImported={imported} processId={draftView ? processId : undefined}/>
    )}
    {versionsOpen && (
      <VersionDialog processId={processId} processName={process.name} onClose={() => setVersionsOpen(false)} onOpen={version => { setVersionsOpen(false); setSelected(undefined); if (version.status === 'Archived') { setDraftView(false); setArchivedVersion(version.version); } else { setArchivedVersion(undefined); setDraftView(version.status === 'Draft'); } }}/>
    )}
    {usersOpen && <UserAdminDialog currentUserId={session.currentUser.id} onClose={() => setUsersOpen(false)} onChanged={async () => setSession(await loadSession())}/>}
  </div>;
}
