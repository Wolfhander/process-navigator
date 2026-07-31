import { BookOpen, Box, Clock3, ExternalLink, UserRound, X } from 'lucide-react';
import type { ProcessNode } from './types';

export function ContextPanel({ node, onClose, onAction }: { node?: ProcessNode; onClose: () => void; onAction: (label: string) => void }) {
  if (!node) return <aside className="context context--empty"><div><span className="eyebrow">Контекст</span><h2>Выберите элемент</h2><p>Нажмите на задачу, событие или развилку, чтобы увидеть ответственного, инструкции и действия ERP.</p></div></aside>;
  return <aside className="context"><button className="icon-button close" onClick={onClose} aria-label="Закрыть контекст"><X size={18}/></button><span className="eyebrow">{node.type === 'task' ? 'Задача процесса' : 'Элемент BPMN'}</span><h2>{node.name}</h2><p className="description">{node.description}</p>
    <div className="facts"><div><UserRound size={17}/><span>Ответственный</span><strong>{node.responsible ?? 'Не назначен'}</strong></div>{node.duration && <div><Clock3 size={17}/><span>Норматив</span><strong>{node.duration}</strong></div>}</div>
    {!!node.actions?.length && <section><h3>Действия</h3>{node.actions.map(action => <button className="primary-action" key={action.id} onClick={() => onAction(action.label)}><Box size={18}/><span>{action.label}</span><ExternalLink size={15}/></button>)}</section>}
    {!!node.artifacts?.length && <section><h3>Материалы</h3>{node.artifacts.map(a => <button className="artifact" key={a.name} onClick={() => onAction(`Открыт материал: ${a.name}`)}><BookOpen size={18}/><span><strong>{a.name}</strong><small>{a.kind} · версия {a.version}</small></span></button>)}</section>}
  </aside>;
}

