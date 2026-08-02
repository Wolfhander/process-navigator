import { useState } from 'react';
import { BookOpen, Box, Clock3, ExternalLink, PanelRight, Pencil, UserRound, X } from 'lucide-react';
import { resolveCapabilities } from './capabilities';
import { artifactDownloadUrl } from './api';
import { ContextEditor } from './ContextEditor';
import type { ProcessNode } from './types';

type ContextPanelProps = {
  processId: string;
  node?: ProcessNode;
  onClose: () => void;
  onAction: (label: string) => void;
  onUpdated: (node: ProcessNode) => void;
  canExecute: boolean;
  canEdit: boolean;
  assignedUsers?: string[];
};

export function ContextPanel({ processId, node, onClose, onAction, onUpdated, canExecute, canEdit, assignedUsers = [] }: ContextPanelProps) {
  const [editingId, setEditingId] = useState<string>();
  if (!node) return <aside className="context context--empty" title="Выберите элемент BPMN, чтобы открыть его контекст"><PanelRight size={18}/><span>Контекст</span></aside>;
  if (editingId === node.id) return <aside className="context context--editing"><ContextEditor processId={processId} node={node} onCancel={() => setEditingId(undefined)} onSaved={updated => { setEditingId(undefined); onUpdated(updated); }}/></aside>;

  const capabilities = resolveCapabilities(node);
  const actions = capabilities.filter(capability => capability.kind === 'action');
  const artifacts = capabilities.filter(capability => capability.kind === 'artifact');
  const openArtifact = (reference: string | undefined, version: string | undefined, label: string) => {
    const url = reference ? artifactDownloadUrl(reference, version) : undefined;
    if (url) window.open(url, '_blank', 'noopener'); else onAction(`Открыть материал: ${label}`);
  };

  return <aside className="context">
    <div className="context-title-actions">{canEdit && <button className="icon-button" onClick={() => setEditingId(node.id)} aria-label="Редактировать контекст"><Pencil size={17}/></button>}<button className="icon-button" onClick={onClose} aria-label="Закрыть контекст"><X size={18}/></button></div>
    <span className="eyebrow">{node.type === 'task' ? 'Задача процесса' : 'Элемент BPMN'}</span><h2>{node.name}</h2><p className="description">{node.description}</p>
    <div className="facts"><div><UserRound size={17}/><span>Ответственная роль</span><strong>{node.responsible ?? 'Не назначена'}</strong>{!!assignedUsers.length && <small>{assignedUsers.join(', ')}</small>}</div>{node.duration && <div><Clock3 size={17}/><span>Норматив</span><strong>{node.duration}</strong></div>}</div>
    {!!actions.length && <section><h3>Действия</h3>{!canExecute && <p className="permission-note">Действия доступны исполнителю или администратору.</p>}{actions.map(capability => <button className="primary-action" key={capability.id} disabled={!canExecute} onClick={() => onAction(capability.label)}><Box size={18}/><span><strong>{capability.label}</strong>{capability.action?.target && <small>{capability.action.target}</small>}</span><ExternalLink size={15}/></button>)}</section>}
    {!!artifacts.length && <section><h3>Материалы</h3>{artifacts.map(capability => <button className="artifact" key={capability.id} onClick={() => openArtifact(capability.artifact?.reference, capability.artifact?.version, capability.label)}><BookOpen size={18}/><span><strong>{capability.label}</strong><small>{capability.artifact?.kind} · версия {capability.artifact?.version}{capability.artifact?.reference?.startsWith('artifact:') ? ' · репозиторий' : capability.artifact?.reference ? ` · ${capability.artifact.reference}` : ''}</small></span></button>)}</section>}
  </aside>;
}
