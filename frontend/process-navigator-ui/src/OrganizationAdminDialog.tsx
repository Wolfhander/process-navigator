import { useState } from 'react';
import { Building2, Plus, Save, Trash2, X } from 'lucide-react';
import { saveOrganization } from './api';
import type { BusinessDirection, LegalEntity, OrganizationMap } from './types';
import './organization-admin.css';

type Props = { organization: OrganizationMap; onClose: () => void; onSaved: (organization: OrganizationMap) => void };
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const emptyDirection = (): BusinessDirection => ({ id: newId('direction'), name: 'Новое направление', description: '', icon: 'planning', processIds: [] });
const emptyEntity = (): LegalEntity => ({ id: newId('entity'), name: 'Новое юридическое лицо', description: '', directions: [emptyDirection()] });

export function OrganizationAdminDialog({ organization, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<OrganizationMap>(() => structuredClone(organization));
  const [selectedId, setSelectedId] = useState(draft.legalEntities[0]?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = draft.legalEntities.find(item => item.id === selectedId);
  const updateEntity = (change: Partial<LegalEntity>) => setDraft(current => ({ ...current, legalEntities: current.legalEntities.map(item => item.id === selectedId ? { ...item, ...change } : item) }));
  const updateDirection = (id: string, change: Partial<BusinessDirection>) => selected && updateEntity({ directions: selected.directions.map(item => item.id === id ? { ...item, ...change } : item) });
  const removeEntity = (id: string) => { const next = draft.legalEntities.filter(item => item.id !== id); setDraft(current => ({ ...current, legalEntities: next })); setSelectedId(next[0]?.id); };
  const submit = async () => { setBusy(true); setError(''); try { onSaved(await saveOrganization(draft)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить структуру.'); } finally { setBusy(false); } };

  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="organization-dialog" role="dialog" aria-modal="true" aria-label="Организационная структура">
    <header><div><span className="eyebrow">Системное администрирование</span><h2>Организационная структура</h2><p>Юридические лица и направления группы. Идентификаторы создаются автоматически и остаются стабильными.</p></div><button className="dialog-close" onClick={onClose}><X size={17}/></button></header>
    <div className="organization-group-fields"><label>Название группы<input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}/></label><label>Описание<input value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}/></label></div>
    <div className="organization-body"><aside><div className="organization-list-title"><strong>Юридические лица</strong><button onClick={() => { const entity = emptyEntity(); setDraft(current => ({ ...current, legalEntities: [...current.legalEntities, entity] })); setSelectedId(entity.id); }}><Plus size={15}/></button></div>{draft.legalEntities.map(entity => <button key={entity.id} className={entity.id === selectedId ? 'is-active' : ''} onClick={() => setSelectedId(entity.id)}><Building2 size={16}/><span><strong>{entity.name}</strong><small>{entity.directions.length} направлений</small></span></button>)}</aside>
      <div className="organization-editor">{selected ? <><div className="entity-fields"><label>Наименование<input value={selected.name} onChange={event => updateEntity({ name: event.target.value })}/></label><label>Описание<textarea value={selected.description} onChange={event => updateEntity({ description: event.target.value })}/></label></div><div className="directions-title"><strong>Направления</strong><button onClick={() => updateEntity({ directions: [...selected.directions, emptyDirection()] })}><Plus size={14}/>Добавить</button></div><div className="direction-editor-list">{selected.directions.map(direction => <article key={direction.id}><label>Название<input value={direction.name} onChange={event => updateDirection(direction.id, { name: event.target.value })}/></label><label>Описание<input value={direction.description} onChange={event => updateDirection(direction.id, { description: event.target.value })}/></label><button className="remove-direction" onClick={() => updateEntity({ directions: selected.directions.filter(item => item.id !== direction.id) })}><Trash2 size={14}/></button></article>)}</div><button className="remove-entity" disabled={draft.legalEntities.length === 1} onClick={() => removeEntity(selected.id)}><Trash2 size={14}/>Удалить юридическое лицо</button></> : <p>Выберите юридическое лицо.</p>}</div>
    </div>
    {error && <div className="organization-error">{error}</div>}
    <footer><button onClick={onClose}>Отмена</button><button className="primary" disabled={busy} onClick={submit}><Save size={15}/>{busy ? 'Сохраняем…' : 'Сохранить структуру'}</button></footer>
  </section></div>;
}
