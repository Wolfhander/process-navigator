import { lazy, Suspense, useEffect, useState } from 'react';
import { Activity, BarChart3, Bell, BriefcaseBusiness, ChevronRight, CircleHelp, FilePenLine, History, Home, Maximize2, Minus, Network, PencilRuler, PlugZap, Plus, Rocket, RotateCcw, Search, Upload, UserCog, Users } from 'lucide-react';
import { createDraft, loadArchivedProcess, loadAssignments, loadNotifications, loadOrganization, loadProcess, loadProcessCatalog, loadSession, markAllNotificationsRead, markNotificationRead, publishDraft, setActiveUser, updateStep } from './api';
import { ContextPanel } from './ContextPanel';
import { ImportDialog } from './ImportDialog';
import { ProcessCanvas } from './ProcessCanvas';
import { VersionDialog } from './VersionDialog';
import { UserMenu } from './UserMenu';
import { UserAdminDialog } from './UserAdminDialog';
import { AssignmentDialog } from './AssignmentDialog';
import { ExecutionDialog } from './ExecutionDialog';
import { AnalyticsDialog } from './AnalyticsDialog';
import { SearchDialog } from './SearchDialog';
import { HelpDialog } from './HelpDialog';
import { NotificationDialog } from './NotificationDialog';
import { OneCIntegrationDialog } from './OneCIntegrationDialog';
import { EnterpriseMap } from './EnterpriseMap';
import { OrganizationAdminDialog } from './OrganizationAdminDialog';
import { LaneOrganizationDialog } from './LaneOrganizationDialog';
import type { OrganizationMap, ProcessAssignments, ProcessImportResult, ProcessInstance, ProcessModel, ProcessNode, ProcessSummary, SearchResult, Session, UserNotification } from './types';

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
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const [assignments, setAssignments] = useState<ProcessAssignments>();
  const [personalMode, setPersonalMode] = useState(false);
  const [executionsOpen, setExecutionsOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [oneCOpen, setOneCOpen] = useState(false);
  const [enterpriseOpen, setEnterpriseOpen] = useState(false);
  const [organizationEditor, setOrganizationEditor] = useState<OrganizationMap>();
  const [laneOrganizationEditor, setLaneOrganizationEditor] = useState<OrganizationMap>();
  const [organizationReloadKey, setOrganizationReloadKey] = useState(0);
  const [pendingSearchResult, setPendingSearchResult] = useState<SearchResult>();
  const [activeInstance, setActiveInstance] = useState<ProcessInstance>();
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

  useEffect(() => {
    if (!processId || !session) return;
    loadAssignments(processId).then(setAssignments).catch(() => setAssignments(undefined));
  }, [processId, session?.currentUser.id]);

  useEffect(() => setPersonalMode(false), [processId, session?.currentUser.id]);
  useEffect(() => setActiveInstance(undefined), [processId]);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const refresh = () => loadNotifications(controller.signal).then(setNotifications).catch(() => undefined);
    refresh(); const timer = window.setInterval(refresh, 30000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [session?.currentUser.id]);

  useEffect(() => {
    if (!process || !pendingSearchResult || process.id !== pendingSearchResult.processId) return;
    setDraftView(false); setArchivedVersion(undefined); setPersonalMode(false);
    setSelected(pendingSearchResult.elementId ? process.nodes.find(node => node.id === pendingSearchResult.elementId) : undefined);
    setPendingSearchResult(undefined);
  }, [process, pendingSearchResult]);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2800);
  };

  const can = (permission: string) => session?.currentUser.permissions.includes(permission) === true;
  const personalLaneIds = assignments?.lanes.filter(lane => lane.userIds.includes(session?.currentUser.id ?? '')).map(lane => lane.laneId) ?? [];
  const unreadNotifications = notifications.filter(item => !item.readAt).length;
  const changeUser = async (userId: string) => {
    setActiveUser(userId);
    const nextSession = await loadSession();
    setSession(nextSession);
    const mayOpenDraft = nextSession.currentUser.permissions.some(permission => ['process.diagram.edit', 'process.context.edit', 'process.publish'].includes(permission));
    if (!mayOpenDraft) { setDraftView(false); setArchivedVersion(undefined); setEditorOpen(false); }
    notify(`Текущий пользователь: ${nextSession.currentUser.displayName}`);
  };

  const openProcess = (id: string) => {
    setProcessId(id);
    setDraftView(false);
    setArchivedVersion(undefined);
    setEditorOpen(false);
    setSelected(undefined);
    setEnterpriseOpen(false);
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

  const changeStepStatus = async (status: 'InProgress' | 'Completed') => {
    if (!activeInstance || !selected) return;
    try { const updated = await updateStep(processId, activeInstance.id, selected.id, status); setActiveInstance(updated); notify(status === 'InProgress' ? 'Шаг начат' : 'Шаг завершён'); }
    catch (reason) { notify(reason instanceof Error ? reason.message : 'Не удалось изменить состояние шага'); }
  };

  const openLaneOrganizationEditor = async () => {
    try { setLaneOrganizationEditor(await loadOrganization()); }
    catch (reason) { notify(reason instanceof Error ? reason.message : 'Не удалось загрузить организационную модель.'); }
  };

  if (error) return <main className="state-page"><h1>Не удалось открыть Process Navigator</h1><p>{error}</p><button onClick={() => location.reload()}>Повторить</button></main>;
  if (!process || !session) return <main className="state-page"><div className="loader"/><p>{catalog.length ? 'Загружаем рабочее пространство…' : 'Загружаем каталог процессов…'}</p></main>;

  return <div className="app-shell">
    <header><button className="brand app-home-button" onClick={() => setEnterpriseOpen(true)} aria-label="Открыть карту предприятия"><span className="brand-mark">PN</span><span>Process Navigator</span></button><nav aria-label="Навигация"><button className="breadcrumb-button" onClick={() => setEnterpriseOpen(true)}><Home size={16}/></button><button className="breadcrumb-button" onClick={() => setEnterpriseOpen(true)}>ООО «Демо»</button>{!enterpriseOpen && <><ChevronRight size={15}/><button className="breadcrumb-button" onClick={() => setEnterpriseOpen(true)}>Процессы</button><ChevronRight size={15}/><select className="process-select" value={processId} onChange={event => openProcess(event.target.value)} aria-label="Выбрать процесс">{catalog.map(item => <option key={item.id} value={item.id}>{item.name} · {item.hasDraft ? `черновик ${item.draftVersion}` : item.status}</option>)}</select></>}</nav>{can('process.import') && <button className="header-action" onClick={() => setImportOpen(true)}><Upload size={17}/>Импорт</button>}{can('users.manage') && <button className="header-action" onClick={() => setUsersOpen(true)}><Users size={17}/>Пользователи</button>}{can('system.manage') && <button className="header-action" onClick={() => setOneCOpen(true)}><PlugZap size={17}/>Интеграция 1С</button>}<button className="header-action notification-button" onClick={() => setNotificationsOpen(true)}><Bell size={17}/>Уведомления{unreadNotifications > 0 && <span>{unreadNotifications}</span>}</button><button className="header-action" onClick={() => setHelpOpen(true)}><CircleHelp size={17}/>Справка</button><UserMenu session={session} onChange={changeUser}/><button className="search" onClick={() => setSearchOpen(true)}><Search size={17}/>Поиск</button></header>
    <div className="process-bar"><div><span className={`eyebrow ${draftView ? 'is-draft' : archivedVersion ? 'is-archive' : ''}`}>{archivedVersion ? 'Архивная версия' : draftView ? 'Черновик' : 'Действующая версия'} {process.version}</span><h1>{process.name}</h1></div><div className="revision-actions"><button className="revision-button" onClick={() => setVersionsOpen(true)}><History size={15}/>История</button>{!draftView && !archivedVersion && <button className={`revision-button${activeInstance ? ' is-primary' : ''}`} onClick={() => setExecutionsOpen(true)}><Activity size={15}/>{activeInstance ? activeInstance.name : 'Выполнения'}</button>}{can('analytics.view') && !draftView && !archivedVersion && <button className="revision-button" onClick={() => setAnalyticsOpen(true)}><BarChart3 size={15}/>Аналитика</button>}{assignments && <button className={`revision-button${personalMode ? ' is-primary' : ''}`} disabled={!personalLaneIds.length} title={personalLaneIds.length ? 'Подсветить мои дорожки и задачи' : 'Текущий пользователь не назначен на дорожки процесса'} onClick={() => { setPersonalMode(value => !value); setSelected(undefined); }}><BriefcaseBusiness size={15}/>Мои шаги ({personalLaneIds.length})</button>}{can('process.assignments.manage') && !archivedVersion && <button className="revision-button" onClick={() => setAssignmentsOpen(true)}><UserCog size={15}/>Ответственные</button>}{can('system.manage') && !archivedVersion && <button className="revision-button" onClick={openLaneOrganizationEditor}><Network size={15}/>Оргпривязки</button>}{archivedVersion ? <button className="revision-button is-primary" onClick={() => setArchivedVersion(undefined)}><RotateCcw size={15}/>К действующей</button> : draftView ? <>{can('process.diagram.edit') && <><button className="revision-button" onClick={() => setEditorOpen(true)}><PencilRuler size={15}/>Редактировать</button><button className="revision-button" onClick={() => setImportOpen(true)} disabled={revisionBusy}><Upload size={15}/>Заменить BPMN</button></>}{can('process.publish') && <button className="revision-button is-primary" onClick={publishRevision} disabled={revisionBusy}><Rocket size={15}/>Опубликовать</button>}</> : catalog.find(item => item.id === processId)?.hasDraft ? (can('process.diagram.edit') || can('process.context.edit') || can('process.publish')) && <button className="revision-button" onClick={() => setDraftView(true)}><FilePenLine size={15}/>Открыть черновик</button> : can('process.draft.create') && <button className="revision-button" onClick={beginRevision} disabled={revisionBusy}><FilePenLine size={15}/>Новая редакция</button>}</div><div className="owner">Владелец процесса<strong>{process.owner}</strong></div><div className="view-controls"><button aria-label="Уменьшить" onClick={() => setZoomCommand(command => ({ id: command.id + 1, factor: 1 / 1.25 }))}><Minus size={18}/></button><button aria-label="Показать весь процесс" onClick={() => { setFitCommand(command => command + 1); setSelected(undefined); }}><Maximize2 size={18}/><span>Весь процесс</span></button><button aria-label="Увеличить" onClick={() => setZoomCommand(command => ({ id: command.id + 1, factor: 1.25 }))}><Plus size={18}/></button></div></div>
    {editorOpen ? <main className="workspace workspace--editor"><Suspense fallback={<div className="editor-loading"><div className="loader"/>Запускаем локальный BPMN-редактор…</div>}><BpmnEditor processId={processId} processName={process.name} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); setReloadKey(value => value + 1); notify('BPMN черновика сохранена'); }}/></Suspense></main> : <main className="workspace"><ProcessCanvas key={`${process.id}:${process.version}:${draftView ? 'draft' : archivedVersion ?? 'published'}`} process={process} selectedId={selected?.id} onSelect={setSelected} zoomCommand={zoomCommand} fitCommand={fitCommand} personalMode={personalMode} personalLaneIds={personalLaneIds} stepStatuses={Object.fromEntries(activeInstance?.steps.map(step => [step.elementId, step.status]) ?? [])}/><ContextPanel processId={processId} node={selected} onClose={() => setSelected(undefined)} onAction={notify} onUpdated={updated => { setSelected(updated); setProcess(current => current ? { ...current, nodes: current.nodes.map(node => node.id === updated.id ? updated : node) } : current); notify('Контекст элемента сохранён'); }} canExecute={can('process.execute') && !archivedVersion} canEdit={draftView && can('process.context.edit')} assignedUsers={selected ? assignments?.lanes.find(lane => lane.laneId === selected.laneId)?.userIds.map(id => assignments.users.find(user => user.id === id)?.displayName).filter((name): name is string => !!name) : []} activeInstance={activeInstance} onStepStatus={changeStepStatus}/></main>}
    <footer><span>{editorOpen ? 'BPMN 2.0 · редактирование черновика' : 'BPMN 2.0 · только просмотр'}</span><span>{process.nodes.length} элементов · {process.lanes.length} роли</span><span>Canvas занимает {selected ? '76%' : '100%'} рабочего пространства</span></footer>
    {message && <div className="toast">{message}</div>}
    {importOpen && (
      <ImportDialog onClose={() => setImportOpen(false)} onImported={imported} processId={draftView ? processId : undefined}/>
    )}
    {versionsOpen && (
      <VersionDialog processId={processId} processName={process.name} onClose={() => setVersionsOpen(false)} onOpen={version => { setVersionsOpen(false); setSelected(undefined); if (version.status === 'Archived') { setDraftView(false); setArchivedVersion(version.version); } else { setArchivedVersion(undefined); setDraftView(version.status === 'Draft'); } }}/>
    )}
    {usersOpen && <UserAdminDialog currentUserId={session.currentUser.id} onClose={() => setUsersOpen(false)} onChanged={async () => setSession(await loadSession())}/>}
    {assignmentsOpen && assignments && <AssignmentDialog assignments={assignments}
      onClose={() => setAssignmentsOpen(false)}
      onSaved={updated => { setAssignments(updated); setAssignmentsOpen(false); notify('Ответственные по дорожкам сохранены'); }}
    />}
    {executionsOpen && <ExecutionDialog processId={processId} canStart={can('process.execute')}
      onClose={() => setExecutionsOpen(false)}
      onOpen={instance => { setActiveInstance(instance); setExecutionsOpen(false); setSelected(undefined); notify(`Открыто выполнение «${instance.name}»`); }}
    />}
    {analyticsOpen && <AnalyticsDialog processId={processId}
      onClose={() => setAnalyticsOpen(false)}
      onSelectStep={elementId => { setAnalyticsOpen(false); setPersonalMode(false); setSelected(process.nodes.find(node => node.id === elementId)); }}
    />}
    {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} onOpen={result => {
      setSearchOpen(false); setDraftView(false); setArchivedVersion(undefined); setEditorOpen(false); setPendingSearchResult(result);
      if (result.processId !== processId) setProcessId(result.processId);
      else { setPersonalMode(false); setSelected(result.elementId ? process.nodes.find(node => node.id === result.elementId) : undefined); setPendingSearchResult(undefined); }
    }}
    />}
    {helpOpen && <HelpDialog user={session.currentUser} onClose={() => setHelpOpen(false)}/>}
    {notificationsOpen && <NotificationDialog notifications={notifications} onClose={() => setNotificationsOpen(false)} onReadAll={async () => { await markAllNotificationsRead(); setNotifications(items => items.map(item => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))); }} onOpen={async notification => {
      if (!notification.readAt) { const updated = await markNotificationRead(notification.id); setNotifications(items => items.map(item => item.id === updated.id ? updated : item)); }
      setNotificationsOpen(false); setDraftView(false); setArchivedVersion(undefined); setEditorOpen(false);
      setPendingSearchResult({ kind: 'element', label: notification.elementName ?? notification.processName, processId: notification.processId, processName: notification.processName, elementId: notification.elementId, elementName: notification.elementName, score: 1 });
      if (notification.processId !== processId) setProcessId(notification.processId);
      else { setPersonalMode(false); setSelected(notification.elementId ? process.nodes.find(node => node.id === notification.elementId) : undefined); setPendingSearchResult(undefined); }
    }}
    />}
    {oneCOpen && <OneCIntegrationDialog onClose={() => setOneCOpen(false)}/>}
    {enterpriseOpen && <EnterpriseMap key={organizationReloadKey} catalog={catalog} onOpenProcess={openProcess} canManage={can('system.manage')} onManage={setOrganizationEditor}/>}
    {organizationEditor && <OrganizationAdminDialog
      organization={organizationEditor}
      onClose={() => setOrganizationEditor(undefined)}
      onSaved={() => { setOrganizationEditor(undefined); setOrganizationReloadKey(value => value + 1); notify('Организационная структура сохранена'); }}
    />}
    {laneOrganizationEditor && <LaneOrganizationDialog
      organization={laneOrganizationEditor}
      process={process}
      onClose={() => setLaneOrganizationEditor(undefined)}
      onSaved={() => { setLaneOrganizationEditor(undefined); setReloadKey(value => value + 1); notify('Организационные привязки дорожек сохранены'); }}
    />}
  </div>;
}
