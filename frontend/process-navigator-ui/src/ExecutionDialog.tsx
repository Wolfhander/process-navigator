import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Clock3, Play, X } from 'lucide-react';
import { loadInstances, startInstance } from './api';
import type { ProcessInstance } from './types';

export function ExecutionDialog({ processId, canStart, onClose, onOpen }: { processId: string; canStart: boolean; onClose: () => void; onOpen: (instance: ProcessInstance) => void }) {
  const [items, setItems] = useState<ProcessInstance[]>(); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { loadInstances(processId).then(setItems).catch(reason => setError(reason.message)); }, [processId]);
  const start = async () => { setBusy(true); setError(''); try { const created = await startInstance(processId, name); setItems(current => [created, ...(current ?? [])]); setName(''); onOpen(created); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось запустить процесс.'); } finally { setBusy(false); } };
  return createPortal(<div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="import-dialog execution-dialog" role="dialog" aria-modal="true" aria-labelledby="executions-title"><button className="icon-button dialog-close" onClick={onClose} aria-label="Закрыть"><X size={18}/></button><span className="eyebrow">Исполнение процесса</span><h2 id="executions-title">Экземпляры процесса</h2><p>Каждый экземпляр фиксирует фактическое прохождение шагов независимо от модели BPMN.</p>
    {canStart && <div className="execution-start"><input value={name} maxLength={160} onChange={event => setName(event.target.value)} placeholder="Название или номер заявки (необязательно)"/><button disabled={busy} onClick={start}><Play size={16}/>{busy ? 'Запускаем…' : 'Запустить'}</button></div>}
    {error && <div className="import-message is-error"><AlertTriangle size={17}/>{error}</div>}<div className="execution-list">{items?.map(instance => <button key={instance.id} onClick={() => onOpen(instance)}><span className={`execution-state is-${instance.status.toLowerCase()}`}>{instance.status === 'Active' ? <Clock3 size={16}/> : <CheckCircle2 size={16}/>}</span><span><strong>{instance.name}</strong><small>Версия {instance.processVersion} · {new Date(instance.startedAt).toLocaleString('ru-RU')} · выполнено {instance.steps.filter(step => step.status === 'Completed').length}/{instance.steps.length}</small></span></button>)}{items && !items.length && <p className="empty-collection">Процесс ещё ни разу не запускался.</p>}{!items && !error && <div className="editor-loading"><div className="loader"/>Загружаем выполнения…</div>}</div>
  </section></div>, document.body);
}
