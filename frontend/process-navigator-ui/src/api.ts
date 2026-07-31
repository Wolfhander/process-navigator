import type { ProcessModel } from './types';

export async function loadProcess(id: string, signal?: AbortSignal): Promise<ProcessModel> {
  const response = await fetch(`/api/processes/${encodeURIComponent(id)}`, { signal });
  if (!response.ok) throw new Error(response.status === 404 ? 'Процесс не найден.' : 'Не удалось загрузить процесс.');
  return response.json() as Promise<ProcessModel>;
}

