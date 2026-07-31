import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileJson2, FileUp, Upload, X } from 'lucide-react';
import { importProcess, replaceDraft } from './api';
import type { ProcessImportResult } from './types';

export function ImportDialog({ onClose, onImported, processId }: { onClose: () => void; onImported: (result: ProcessImportResult) => void; processId?: string }) {
  const [bpmnFile, setBpmnFile] = useState<File>();
  const [contextFile, setContextFile] = useState<File>();
  const [result, setResult] = useState<ProcessImportResult>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bpmnFile) return;
    setBusy(true); setError(''); setResult(undefined);
    try { setResult(processId ? await replaceDraft(processId, bpmnFile, contextFile) : await importProcess(bpmnFile, contextFile)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось импортировать процесс.'); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <button className="icon-button dialog-close" onClick={onClose} aria-label="Закрыть"><X size={18}/></button>
      <span className="eyebrow">Репозиторий процессов</span><h2 id="import-title">{processId ? 'Заменить BPMN черновика' : 'Импортировать BPMN'}</h2>
      <p>Схема сначала проверяется и сохраняется только при отсутствии критических ошибок.</p>
      {!result && <form onSubmit={submit}>
        <label className="file-field"><FileUp size={21}/><span><strong>BPMN 2.0 XML</strong><small>{bpmnFile?.name ?? 'Обязательный файл .bpmn, до 2 МБ'}</small></span><input type="file" accept=".bpmn,application/xml,text/xml" required onChange={event => setBpmnFile(event.target.files?.[0])}/></label>
        <label className="file-field"><FileJson2 size={21}/><span><strong>Контекст Process Navigator</strong><small>{contextFile?.name ?? 'Необязательный файл .json, до 2 МБ'}</small></span><input type="file" accept=".json,application/json" onChange={event => setContextFile(event.target.files?.[0])}/></label>
        {error && <div className="import-message is-error"><AlertTriangle size={18}/><span><strong>Импорт отклонён</strong>{error}</span></div>}
        <button className="import-submit" disabled={!bpmnFile || busy}><Upload size={18}/>{busy ? 'Проверяем…' : 'Проверить и импортировать'}</button>
      </form>}
      {result && <div className="import-result"><CheckCircle2 size={30}/><h3>{result.process.name}</h3><p>Процесс импортирован как черновик: {result.process.nodeCount} элементов, {result.process.laneCount} дорожек.</p>{result.warnings.map(warning => <div className="import-message is-warning" key={warning}><AlertTriangle size={17}/>{warning}</div>)}<button className="import-submit" onClick={() => onImported(result)}>Открыть процесс</button></div>}
    </section>
  </div>;
}
