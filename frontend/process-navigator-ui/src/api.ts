import type { ProcessImportResult, ProcessModel, ProcessSummary, ProcessVersion, Session } from './types';

let activeRole = localStorage.getItem('pn.demoRole') ?? 'employee';
export function setActiveRole(role: string) { activeRole = role; localStorage.setItem('pn.demoRole', role); }
const roleHeaders = () => ({ 'X-Process-Navigator-Role': activeRole });

export async function loadSession(signal?: AbortSignal): Promise<Session> {
  const response = await fetch('/api/session', { signal, headers: roleHeaders() });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить профиль пользователя.'));
  return response.json() as Promise<Session>;
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
