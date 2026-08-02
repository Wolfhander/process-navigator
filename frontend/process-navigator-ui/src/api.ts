import type { CommandExecution, ElementComment, ElementContextUpdate, ProcessAnalytics, ProcessAssignments, ProcessImportResult, ProcessInstance, ProcessModel, ProcessNode, ProcessSummary, ProcessVersion, RepositoryArtifact, RepositoryArtifactUpload, SearchResult, Session, UserDirectory, UserNotification, UserProfile, UserUpdate } from './types';

let activeUser = localStorage.getItem('pn.demoUser') ?? 'demo-employee';
export function setActiveUser(userId: string) { activeUser = userId; localStorage.setItem('pn.demoUser', userId); }
const roleHeaders = () => ({ 'X-Process-Navigator-User': activeUser });

export async function loadSession(signal?: AbortSignal): Promise<Session> {
  const response = await fetch('/api/session', { signal, headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить профиль пользователя.'));
  return response.json() as Promise<Session>;
}

export async function loadProcessAnalytics(processId: string): Promise<ProcessAnalytics> {
  const response = await fetch(`/api/processes/${encodeURIComponent(processId)}/analytics`, { headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить аналитику процесса.'));
  return response.json() as Promise<ProcessAnalytics>;
}

export async function executeProcessAction(processId: string, elementId: string, actionId: string, instanceId?: string): Promise<CommandExecution> {
  const response = await fetch(`/api/processes/${encodeURIComponent(processId)}/elements/${encodeURIComponent(elementId)}/actions/${encodeURIComponent(actionId)}/execute`, {
    method: 'POST', headers: { ...roleHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId })
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось выполнить команду процесса.'));
  return response.json() as Promise<CommandExecution>;
}

export async function loadCommandHistory(processId: string, elementId: string): Promise<CommandExecution[]> {
  const response = await fetch(`/api/processes/${encodeURIComponent(processId)}/elements/${encodeURIComponent(elementId)}/commands`, { headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить журнал команд.'));
  return response.json() as Promise<CommandExecution[]>;
}

export async function searchProcesses(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal, headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось выполнить поиск.'));
  return response.json() as Promise<SearchResult[]>;
}

export async function loadElementComments(processId: string, elementId: string, signal?: AbortSignal): Promise<ElementComment[]> {
  const response = await fetch(`/api/processes/${encodeURIComponent(processId)}/elements/${encodeURIComponent(elementId)}/comments`, { signal, headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить комментарии.'));
  return response.json() as Promise<ElementComment[]>;
}

export async function addElementComment(processId: string, elementId: string, text: string): Promise<ElementComment> {
  const response = await fetch(`/api/processes/${encodeURIComponent(processId)}/elements/${encodeURIComponent(elementId)}/comments`, {
    method: 'POST', headers: { ...roleHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось сохранить комментарий.'));
  return response.json() as Promise<ElementComment>;
}

export async function loadNotifications(signal?: AbortSignal): Promise<UserNotification[]> {
  const response = await fetch('/api/notifications', { signal, headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить уведомления.'));
  return response.json() as Promise<UserNotification[]>;
}

export async function markNotificationRead(notificationId: string): Promise<UserNotification> {
  const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PUT', headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось отметить уведомление прочитанным.'));
  return response.json() as Promise<UserNotification>;
}

export async function markAllNotificationsRead(): Promise<void> {
  const response = await fetch('/api/notifications/read-all', { method: 'PUT', headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось отметить уведомления прочитанными.'));
}

export async function loadUserDirectory(): Promise<UserDirectory> {
  const response = await fetch('/api/admin/users', { headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить список пользователей.'));
  return response.json() as Promise<UserDirectory>;
}

export async function updateUser(userId: string, update: UserUpdate): Promise<UserProfile> {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT', headers: { ...roleHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(update)
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось сохранить пользователя.'));
  return response.json() as Promise<UserProfile>;
}

export async function loadAssignments(processId: string): Promise<ProcessAssignments> {
  const response = await fetch(`/api/processes/${encodeURIComponent(processId)}/assignments`, { headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить ответственных по дорожкам.'));
  return response.json() as Promise<ProcessAssignments>;
}

export async function saveAssignments(processId: string, assignments: ProcessAssignments): Promise<ProcessAssignments> {
  const response = await fetch(`/api/processes/${encodeURIComponent(processId)}/assignments`, {
    method: 'PUT', headers: { ...roleHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ lanes: assignments.lanes.map(lane => ({ laneId: lane.laneId, userIds: lane.userIds })) })
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось сохранить ответственных.'));
  return response.json() as Promise<ProcessAssignments>;
}

export async function loadInstances(processId: string): Promise<ProcessInstance[]> {
  const response = await fetch(`/api/processes/${encodeURIComponent(processId)}/instances`, { headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить выполнения процесса.'));
  return response.json() as Promise<ProcessInstance[]>;
}

export async function startInstance(processId: string, name?: string): Promise<ProcessInstance> {
  const response = await fetch(`/api/processes/${encodeURIComponent(processId)}/instances`, { method: 'POST', headers: { ...roleHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось запустить процесс.'));
  return response.json() as Promise<ProcessInstance>;
}

export async function updateStep(processId: string, instanceId: string, elementId: string, status: 'InProgress' | 'Completed'): Promise<ProcessInstance> {
  const response = await fetch(`/api/processes/${encodeURIComponent(processId)}/instances/${encodeURIComponent(instanceId)}/steps/${encodeURIComponent(elementId)}`, { method: 'PUT', headers: { ...roleHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось изменить состояние шага.'));
  return response.json() as Promise<ProcessInstance>;
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json() as { message?: string; detail?: string; title?: string };
    return payload.message ?? payload.detail ?? payload.title ?? fallback;
  } catch {
    return fallback;
  }
}

export async function loadProcess(id: string, signal?: AbortSignal, draft = false): Promise<ProcessModel> {
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}${draft ? '?draft=true' : ''}`, { signal, headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить процесс.'));
  return response.json() as Promise<ProcessModel>;
}

export async function createDraft(id: string): Promise<ProcessSummary> {
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}/draft`, { method: 'POST', headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось создать новую редакцию.'));
  return response.json() as Promise<ProcessSummary>;
}

export async function replaceDraft(id: string, bpmnFile: File, contextFile?: File): Promise<ProcessImportResult> {
  const body = new FormData(); body.append('bpmnFile', bpmnFile); if (contextFile) body.append('contextFile', contextFile);
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}/draft`, { method: 'PUT', body, headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось заменить BPMN черновика.'));
  return response.json() as Promise<ProcessImportResult>;
}

export async function loadDraftBpmn(id: string): Promise<string> {
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}/draft/bpmn`, { headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить BPMN черновика.'));
  return response.text();
}

export async function saveDraftBpmn(id: string, xml: string): Promise<ProcessImportResult> {
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}/draft/bpmn`, {
    method: 'PUT', headers: { ...roleHeaders(), 'Content-Type': 'application/xml; charset=utf-8' }, body: xml
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось сохранить BPMN черновика.'));
  return response.json() as Promise<ProcessImportResult>;
}

export async function saveElementContext(processId: string, elementId: string, update: ElementContextUpdate): Promise<ProcessNode> {
  const response = await fetch(`/api/processes/${encodeURIComponent(processId)}/draft/elements/${encodeURIComponent(elementId)}/context`, {
    method: 'PUT', headers: { ...roleHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(update)
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось сохранить контекст элемента.'));
  return response.json() as Promise<ProcessNode>;
}

export async function loadArtifacts(): Promise<RepositoryArtifact[]> {
  const response = await fetch('/api/artifacts', { headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить репозиторий документов.'));
  return response.json() as Promise<RepositoryArtifact[]>;
}

export async function uploadArtifact(file: File, name: string, kind: string, version: string, artifactId?: string): Promise<RepositoryArtifactUpload> {
  const body = new FormData(); body.append('file', file); body.append('name', name); body.append('kind', kind); body.append('version', version); if (artifactId) body.append('artifactId', artifactId);
  const response = await fetch('/api/artifacts', { method: 'POST', headers: roleHeaders(), body });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить документ.'));
  return response.json() as Promise<RepositoryArtifactUpload>;
}

export function artifactDownloadUrl(reference: string, version?: string) {
  const id = reference.startsWith('artifact:') ? reference.slice('artifact:'.length) : '';
  return id ? `/api/artifacts/${encodeURIComponent(id)}/content${version ? `?version=${encodeURIComponent(version)}` : ''}` : undefined;
}

export async function publishDraft(id: string): Promise<ProcessSummary> {
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}/publish`, { method: 'POST', headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось опубликовать редакцию.'));
  return response.json() as Promise<ProcessSummary>;
}

export async function loadVersions(id: string): Promise<ProcessVersion[]> {
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}/versions`, { headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить историю версий.'));
  return response.json() as Promise<ProcessVersion[]>;
}

export async function loadArchivedProcess(id: string, version: string, signal?: AbortSignal): Promise<ProcessModel> {
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}`, { signal });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить архивную версию.'));
  return response.json() as Promise<ProcessModel>;
}

export async function loadProcessCatalog(signal?: AbortSignal): Promise<ProcessSummary[]> {
  const response = await fetch('/api/processes', { signal });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить каталог процессов.'));
  return response.json() as Promise<ProcessSummary[]>;
}

export async function importProcess(bpmnFile: File, contextFile?: File): Promise<ProcessImportResult> {
  const body = new FormData();
  body.append('bpmnFile', bpmnFile);
  if (contextFile) body.append('contextFile', contextFile);
  const response = await fetch('/api/processes/import', { method: 'POST', body, headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось импортировать процесс.'));
  return response.json() as Promise<ProcessImportResult>;
}
