import { useEffect, useState } from 'react';
import { BookOpen, Box, CheckCircle2, Clock3, ExternalLink, PanelRight, Pencil, Play, UserRound, X } from 'lucide-react';
import { resolveCapabilities } from './capabilities';
import { artifactDownloadUrl, executeProcessAction, loadCommandHistory } from './api';
import { ContextEditor } from './ContextEditor';
import { ElementComments } from './ElementComments';
import type { CommandExecution, ProcessInstance, ProcessNode } from './types';

type ContextPanelProps = {
  processId: string;
  node?: ProcessNode;
  onClose: () => void;
  onAction: (label: string) => void;
  onUpdated: (node: ProcessNode) => void;
  canExecute: boolean;
  canEdit: boolean;
  assignedUsers?: string[];
  activeInstance?: ProcessInstance;
  onStepStatus?: (status: 'InProgress' | 'Completed') => void;
};

export function ContextPanel({ processId, node, onClose, onAction, onUpdated, canExecute, canEdit, assignedUsers = [], activeInstance, onStepStatus }: ContextPanelProps) {
  const [editingId, setEditingId] = useState<string>();
  const [busyAction, setBusyAction] = useState<string>();
  const [lastCommand, setLastCommand] = useState<CommandExecution>();
  const [commandHistory, setCommandHistory] = useState<CommandExecution[]>([]);
  useEffect(() => {
    setLastCommand(undefined); setCommandHistory([]);
    if (node) loadCommandHistory(processId, node.id).then(setCommandHistory).catch(() => undefined);
  }, [processId, node?.id]);
  if (!node) return <aside className="context context--empty" title="Выберите элемент BPMN, чтобы открыть его контекст"><PanelRight size={18}/><span>Контекст</span></aside>;
  if (editingId === node.id) return <aside className="context context--editing"><ContextEditor processId={processId} node={node} onCancel={() => setEditingId(undefined)} onSaved={updated => { setEditingId(undefined); onUpdated(updated); }}/></aside>;

  const capabilities = resolveCapabilities(node);
  const actions = capabilities.filter(capability => capability.kind === 'action');
  const artifacts = capabilities.filter(capability => capability.kind === 'artifact');
  const step = activeInstance?.steps.find(item => item.elementId === node.id);
  const openArtifact = (reference: string | undefined, version: string | undefined, label: string) => {
    const url = reference ? artifactDownloadUrl(reference, version) : undefined;
    if (url) window.open(url, '_blank', 'noopener'); else onAction(`Открыть материал: ${label}`);
  };
  const runAction = async (actionId: string) => {
    setBusyAction(actionId);
    try {
      const result = await executeProcessAction(processId, node.id, actionId, activeInstance?.id);
      setLastCommand(result); setCommandHistory(await loadCommandHistory(processId, node.id)); onAction(result.message);
    } catch (reason) { onAction(reason instanceof Error ? reason.message : 'Не удалось выполнить команду'); }
    finally { setBusyAction(undefined); }
  };

  return <aside className="context">
    <div className="context-title-actions">{canEdit && <button className="icon-button" onClick={() => setEditingId(node.id)} aria-label="Редактировать контекст"><Pencil size={17}/></button>}<button className="icon-button" onClick={onClose} aria-label="Закрыть контекст"><X size={18}/></button></div>
    <span className="eyebrow">{node.type === 'task' ? 'Задача процесса' : 'Элемент BPMN'}</span><h2>{node.name}</h2><p className="description">{node.description}</p>
    <div className="facts"><div><UserRound size={17}/><span>Ответственная роль</span><strong>{node.responsible ?? 'Не назначена'}</strong></div>{node.duration && <div><Clock3 size={17}/><span>Норматив</span><strong>{node.duration}</strong></div>}</div>
    <section className="assigned-people"><h3>Назначенные сотрудники</h3>{assignedUsers.length ? assignedUsers.map(name => <div key={name}><span className="assigned-avatar"><UserRound size={14}/></span><strong>{name}</strong></div>) : <p className="permission-note">На ответственную дорожку пока никто не назначен.</p>}</section>
    {step && <section className="step-execution"><h3>Текущее выполнение</h3><div className={`step-status is-${step.status.toLowerCase()}`}><Clock3 size={16}/><span><strong>{step.status === 'NotStarted' ? 'Не начато' : step.status === 'InProgress' ? 'В работе' : 'Завершено'}</strong><small>{step.startedAt ? `Начато ${new Date(step.startedAt).toLocaleString('ru-RU')}` : activeInstance?.name}</small></span></div>{canExecute && step.status === 'NotStarted' && <button onClick={() => onStepStatus?.('InProgress')}><Play size={16}/>Начать шаг</button>}{canExecute && step.status === 'InProgress' && <button onClick={() => onStepStatus?.('Completed')}><CheckCircle2 size={16}/>Завершить шаг</button>}</section>}
    {!!actions.length && <section><h3>Действия</h3>{!canExecute && <p className="permission-note">Действия доступны исполнителю или администратору.</p>}{actions.map(capability => <button className="primary-action" key={capability.id} disabled={!canExecute || !!busyAction} onClick={() => capability.action && runAction(capability.action.id)}><Box size={18}/><span><strong>{capability.label}</strong>{capability.action?.target && <small>{capability.action.target}</small>}</span><ExternalLink size={15}/></button>)}{lastCommand && <div className={`command-result${lastCommand.status === 'Failed' ? ' is-failed' : ''}`}><CheckCircle2 size={16}/><span><strong>{lastCommand.message}</strong><small>{lastCommand.externalReference ?? new Date(lastCommand.executedAt).toLocaleString('ru-RU')}</small></span></div>}{commandHistory.length > 0 && <details className="command-history"><summary>Журнал запусков ({commandHistory.length})</summary>{commandHistory.map(item => <div key={item.id}><span>{item.actionLabel}</span><small>{new Date(item.executedAt).toLocaleString('ru-RU')} · {item.status}{item.externalReference ? ` · ${item.externalReference}` : ''}</small></div>)}</details>}</section>}
    {!!artifacts.length && <section><h3>Материалы</h3>{artifacts.map(capability => <button className="artifact" key={capability.id} onClick={() => openArtifact(capability.artifact?.reference, capability.artifact?.version, capability.label)}><BookOpen size={18}/><span><strong>{capability.label}</strong><small>{capability.artifact?.kind} · версия {capability.artifact?.version}{capability.artifact?.reference?.startsWith('artifact:') ? ' · репозиторий' : capability.artifact?.reference ? ` · ${capability.artifact.reference}` : ''}</small></span></button>)}</section>}
    <ElementComments key={node.id} processId={processId} elementId={node.id} onMessage={onAction}/>
  </aside>;
}
