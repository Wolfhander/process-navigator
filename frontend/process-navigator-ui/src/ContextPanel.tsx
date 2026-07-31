import { BookOpen, Box, Clock3, ExternalLink, PanelRight, UserRound, X } from 'lucide-react';
import { resolveCapabilities } from './capabilities';
import type { ProcessNode } from './types';

export function ContextPanel({ node, onClose, onAction, canExecute }: { node?: ProcessNode; onClose: () => void; onAction: (label: string) => void; canExecute: boolean }) {
  if (!node) return <aside className="context context--empty" title="Выберите элемент BPMN, чтобы открыть его контекст"><PanelRight size={18}/><span>Контекст</span></aside>;

  const capabilities = resolveCapabilities(node);
  const actions = capabilities.filter(capability => capability.kind === 'action');
  const artifacts = capabilities.filter(capability => capability.kind === 'artifact');

  return <aside className="context"><button className="icon-button close" onClick={onClose} aria-label="Закрыть контекст"><X size={18}/></button><span className="eyebrow">{node.type === 'task' ? 'Задача процесса' : 'Элемент BPMN'}</span><h2>{node.name}</h2><p className="description">{node.description}</p>
    <div className="facts"><div><UserRound size={17}/><span>Ответственный</span><strong>{node.responsible ?? 'Не назначен'}</strong></div>{node.duration && <div><Clock3 size={17}/><span>Норматив</span><strong>{node.duration}</strong></div>}</div>
    {!!actions.length && <section><h3>Действия</h3>{!canExecute && <p className="permission-note">Действия доступны исполнителю или администратору.</p>}{actions.map(capability => <button className="primary-action" key={capability.id} disabled={!canExecute} onClick={() => onAction(capability.label)}><Box size={18}/><span>{capability.label}</span><ExternalLink size={15}/></button>)}</section>}
    {!!artifacts.length && <section><h3>Материалы</h3>{artifacts.map(capability => <button className="artifact" key={capability.id} onClick={() => onAction(`Открыт материал: ${capability.label}`)}><BookOpen size={18}/><span><strong>{capability.label}</strong><small>{capability.artifact?.kind} · версия {capability.artifact?.version}</small></span></button>)}</section>}
  </aside>;
}
