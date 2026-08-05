import { useMemo, useState } from 'react';
import { Building2, Network, Save, X } from 'lucide-react';
import { saveOrganization } from './api';
import type { CrossCompanyProcess, LaneOrganization, OrganizationMap, ProcessModel } from './types';
import './lane-organization-dialog.css';

type Props = { organization: OrganizationMap; process: ProcessModel; onClose: () => void; onSaved: (organization: OrganizationMap) => void };

export function LaneOrganizationDialog({ organization, process, onClose, onSaved }: Props) {
  const existing = organization.crossCompanyProcesses.find(item => item.processId === process.id);
  const [mappings, setMappings] = useState<LaneOrganization[]>(() => process.lanes.map(lane => existing?.laneOrganizations.find(item => item.laneId === lane.id) ?? { laneId: lane.id, legalEntityId: organization.legalEntities[0]?.id ?? '', department: '' }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const entityById = useMemo(() => new Map(organization.legalEntities.map(entity => [entity.id, entity])), [organization]);

  const update = (laneId: string, change: Partial<LaneOrganization>) => setMappings(items => items.map(item => item.laneId === laneId ? { ...item, ...change } : item));
  const save = async () => {
    const legalEntityIds = [...new Set(mappings.map(item => item.legalEntityId).filter(Boolean))];
    if (legalEntityIds.length < 2) { setError('Для сквозного процесса выберите не менее двух юридических лиц.'); return; }
    const link: CrossCompanyProcess = { processId: process.id, legalEntityIds, laneOrganizations: mappings, description: existing?.description ?? `Сквозной процесс «${process.name}».` };
    const updateOrganization = { ...organization, crossCompanyProcesses: [...organization.crossCompanyProcesses.filter(item => item.processId !== process.id), link] };
    setBusy(true); setError('');
    try { onSaved(await saveOrganization(updateOrganization)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить привязки.'); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="lane-organization-dialog" role="dialog" aria-modal="true" aria-label="Организационная принадлежность дорожек">
      <header><div><span className="eyebrow">Организационная модель процесса</span><h2>Дорожки и подразделения</h2><p>Каждая процессная роль связывается с устойчивым подразделением юридического лица.</p></div><button className="dialog-close" onClick={onClose}><X size={17}/></button></header>
      <div className="lane-mapping-list">{process.lanes.map(lane => {
        const mapping = mappings.find(item => item.laneId === lane.id)!;
        const entity = entityById.get(mapping.legalEntityId);
        return <article key={lane.id}>
          <div className="lane-mapping-role"><Network size={17}/><span><small>Дорожка BPMN</small><strong>{lane.name}</strong></span></div>
          <label><span><Building2 size={13}/>Юридическое лицо</span><select value={mapping.legalEntityId} onChange={event => update(lane.id, { legalEntityId: event.target.value, unitId: undefined, department: '' })}>{organization.legalEntities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span><Network size={13}/>Подразделение</span><select value={mapping.unitId ?? ''} onChange={event => { const unit = entity?.units?.find(item => item.id === event.target.value); update(lane.id, { unitId: unit?.id, department: unit?.name ?? '' }); }}><option value="">Выберите подразделение</option>{(entity?.units ?? []).map(unit => <option key={unit.id} value={unit.id}>{unit.id.split('.').slice(1).map(() => '—').join('')} {unit.name}</option>)}</select></label>
        </article>;
      })}</div>
      {error && <div className="lane-mapping-error">{error}</div>}
      <footer><button onClick={onClose}>Отмена</button><button className="primary" disabled={busy || mappings.some(item => !item.unitId)} onClick={save}><Save size={15}/>{busy ? 'Сохраняем…' : 'Сохранить привязки'}</button></footer>
    </section>
  </div>;
}
