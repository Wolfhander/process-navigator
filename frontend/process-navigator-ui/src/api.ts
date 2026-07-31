import type { ProcessImportResult, ProcessModel, ProcessSummary } from './types';

async function errorMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json() as { message?: string; detail?: string; title?: string };
    return payload.message ?? payload.detail ?? payload.title ?? fallback;
  } catch {
    return fallback;
  }
}

export async function loadProcess(id: string, signal?: AbortSignal): Promise<ProcessModel> {
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}`, { signal });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось загрузить процесс.'));
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
  const response = await fetch('/api/processes/import', { method: 'POST', body });
  if (!response.ok) throw new Error(await errorMessage(response, 'Не удалось импортировать процесс.'));
  return response.json() as Promise<ProcessImportResult>;
}
