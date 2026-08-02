import { useState } from 'react';
import { AlertTriangle, FileUp, Plus, Save, Trash2, X } from 'lucide-react';
import { saveElementContext } from './api';
import { ArtifactUploadDialog } from './ArtifactUploadDialog';
import type { Artifact, ProcessAction, ProcessNode } from './types';

export function ContextEditor({ processId, node, onCancel, onSaved }: {
  processId: string;
  node: ProcessNode;
  onCancel: () => void;
  onSaved: (node: ProcessNode) => void;
}) {
  const [description, setDescription] = useState(node.description ?? '');
  const [responsible, setResponsible] = useState(node.responsible ?? '');
  const [duration, setDuration] = useState(node.duration ?? '');
  const [artifacts, setArtifacts] = useState<Artifact[]>(node.artifacts ?? []);
  const [actions, setActions] = useState<ProcessAction[]>(node.actions ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  const patchArtifact = (index: number, patch: Partial<Artifact>) =>
    setArtifacts(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const patchAction = (index: number, patch: Partial<ProcessAction>) =>
    setActions(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      onSaved(await saveElementContext(processId, node.id, { description, responsible, duration, artifacts, actions }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить контекст элемента.');
    } finally { setBusy(false); }
  };

  return <form className="context-editor" onSubmit={submit}>
    <div className="context-editor__heading"><div><span className="eyebrow">Контекст черновика</span><h2>{node.name}</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Отменить редактирование"><X size={18}/></button></div>
    <label>Описание<textarea value={description} maxLength={4000} rows={4} onChange={event => setDescription(event.target.value)} placeholder="Что должен сделать сотрудник и какой результат ожидается"/></label>
    <div className="context-form-grid"><label>Ответственный<input value={responsible} maxLength={200} onChange={event => setResponsible(event.target.value)} placeholder="Роль или должность"/></label><label>Норматив<input value={duration} maxLength={100} onChange={event => setDuration(event.target.value)} placeholder="Например, 2 часа"/></label></div>

    <section className="context-collection"><div className="collection-heading"><h3>Материалы и шаблоны</h3><div><button type="button" onClick={() => setArtifacts(items => [...items, { name: '', kind: 'Инструкция', version: '1.0', reference: '' }])}><Plus size={15}/>Ссылка</button><button type="button" onClick={() => setUploadOpen(true)}><FileUp size={15}/>Файл</button></div></div>
      {artifacts.map((artifact, index) => <div className="collection-card" key={`artifact-${index}`}><button type="button" className="remove-row" onClick={() => setArtifacts(items => items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Удалить материал"><Trash2 size={15}/></button><label>Название<input required value={artifact.name} maxLength={200} onChange={event => patchArtifact(index, { name: event.target.value })}/></label><div className="context-form-grid"><label>Тип<input required value={artifact.kind} maxLength={80} onChange={event => patchArtifact(index, { kind: event.target.value })}/></label><label>Версия<input required value={artifact.version} maxLength={40} onChange={event => patchArtifact(index, { version: event.target.value })}/></label></div><label>Файл, ссылка или идентификатор<input value={artifact.reference ?? ''} maxLength={500} onChange={event => patchArtifact(index, { reference: event.target.value })} placeholder="Например, ХранилищеЗначения:..."/></label></div>)}
      {!artifacts.length && <p className="empty-collection">К элементу пока не прикреплены материалы.</p>}
    </section>

    <section className="context-collection"><div className="collection-heading"><h3>Действия ERP</h3><button type="button" onClick={() => setActions(items => [...items, { id: `action-${crypto.randomUUID().slice(0, 8)}`, label: '', kind: 'erp', target: '' }])}><Plus size={15}/>Добавить</button></div>
      {actions.map((action, index) => <div className="collection-card" key={action.id}><button type="button" className="remove-row" onClick={() => setActions(items => items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Удалить действие"><Trash2 size={15}/></button><label>Название команды<input required value={action.label} maxLength={200} onChange={event => patchAction(index, { label: event.target.value })}/></label><div className="context-form-grid"><label>Тип<select value={action.kind} onChange={event => patchAction(index, { kind: event.target.value })}><option value="erp">ERP</option><option value="report">Отчёт</option><option value="file">Файл</option><option value="url">Ссылка</option></select></label><label>Идентификатор<input required value={action.id} maxLength={100} onChange={event => patchAction(index, { id: event.target.value })}/></label></div><label>Цель команды<input value={action.target ?? ''} maxLength={500} onChange={event => patchAction(index, { target: event.target.value })} placeholder="Например, Документ.ЗаказПоставщику"/></label></div>)}
      {!actions.length && <p className="empty-collection">Для элемента пока не настроены действия.</p>}
    </section>

    {error && <div className="context-save-error"><AlertTriangle size={17}/>{error}</div>}
    <div className="context-editor__actions"><button type="button" onClick={onCancel}>Отмена</button><button className="is-primary" disabled={busy}><Save size={16}/>{busy ? 'Сохраняем…' : 'Сохранить контекст'}</button></div>
    {uploadOpen && (
      <ArtifactUploadDialog
      onClose={() => setUploadOpen(false)}
      onUploaded={artifact => { setArtifacts(items => [...items, artifact]); setUploadOpen(false); }}/>
    )}
  </form>;
}
