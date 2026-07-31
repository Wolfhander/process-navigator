import type { ProcessImportResult, ProcessModel, ProcessSummary, ProcessVersion } from './types';

async function errorMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json() as { message?: string; detail?: string; title?: string };
    return payload.message ?? payload.detail ?? payload.title ?? fallback;
  } catch {
    return fallback;
  }
}

export async function loadProcess(id: string, signal?: AbortSignal, draft = false): Promise<ProcessModel> {
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}${draft ? '?draft=true' : ''}`, { signal });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить процесс.'));
  return response.json() as Promise<ProcessModel>;
}

export async function createDraft(id: string): Promise<ProcessSummary> {
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}/draft`, { method: 'POST' });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось создать новую редакцию.'));
  return response.json() as Promise<ProcessSummary>;
}

export async function replaceDraft(id: string, bpmnFile: File, contextFile?: File): Promise<ProcessImportResult> {
  const body = new FormData(); body.append('bpmnFile', bpmnFile); if (contextFile) body.append('contextFile', contextFile);
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}/draft`, { method: 'PUT', body });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось заменить BPMN черновика.'));
  return response.json() as Promise<ProcessImportResult>;
}

export async function publishDraft(id: string): Promise<ProcessSummary> {
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}/publish`, { method: 'POST' });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось опубликовать редакцию.'));
  return response.json() as Promise<ProcessSummary>;
}

export async function loadVersions(id: string): Promise<ProcessVersion[]> {
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}/versions`);
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить историю версий.'));
  return response.json() as Promise<ProcessVersion[]>;
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
  const response = await fetch('/api/processes/import', { method: 'POST', body });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось импортировать процесс.'));
  return response.json() as Promise<ProcessImportResult>;
}
