import { useEffect, useRef, useState } from 'react';
import { Check, Maximize2, Redo2, Save, Undo2, X } from 'lucide-react';
import Modeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { loadDraftBpmn, saveDraftBpmn } from './api';

type EditorService = { zoom?: (value: string) => void; canUndo?: () => boolean; canRedo?: () => boolean; undo?: () => void; redo?: () => void };

export function BpmnEditor({ processId, processName, onClose, onSaved }: { processId: string; processName: string; onClose: () => void; onSaved: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const modeler = useRef<Modeler | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!container.current) return;
    const instance = new Modeler({ container: container.current });
    let active = true;
    modeler.current = instance;
    const changed = () => setDirty(true);
    (instance as unknown as { on: (event: string, handler: () => void) => void }).on('commandStack.changed', changed);
    loadDraftBpmn(processId).then(async xml => {
      if (!active) return;
      await instance.importXML(xml);
      if (!active) return;
      (instance.get('canvas') as EditorService).zoom?.('fit-viewport');
      setDirty(false);
    }).catch(reason => { if (active) { console.error('BPMN import failed', reason); setError(reason instanceof Error ? reason.message : 'Не удалось открыть редактор.'); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; instance.destroy(); if (modeler.current === instance) modeler.current = null; };
  }, [processId]);

  const close = () => {
    if (!dirty || window.confirm('Закрыть редактор без сохранения изменений?')) onClose();
  };
  const command = (name: 'undo' | 'redo') => (modeler.current?.get('commandStack') as EditorService | undefined)?.[name]?.();
  const fit = () => (modeler.current?.get('canvas') as EditorService | undefined)?.zoom?.('fit-viewport');
  const save = async () => {
    if (!modeler.current) return;
    setSaving(true); setError('');
    try {
      const { xml } = await modeler.current.saveXML({ format: true });
      if (!xml) throw new Error('Редактор не сформировал BPMN XML.');
      await saveDraftBpmn(processId, xml);
      setDirty(false); onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить BPMN.'); }
    finally { setSaving(false); }
  };

  return <section className="bpmn-editor" aria-label={`Редактор BPMN: ${processName}`}>
    <div className="editor-toolbar"><div><span className="eyebrow">Редактор BPMN 2.0</span><strong>{processName}</strong>{dirty && <small>Есть несохранённые изменения</small>}</div><div className="editor-commands"><button onClick={() => command('undo')} title="Отменить"><Undo2 size={17}/></button><button onClick={() => command('redo')} title="Повторить"><Redo2 size={17}/></button><button onClick={fit} title="Показать всю схему"><Maximize2 size={17}/></button><button className="editor-cancel" onClick={close}><X size={17}/>Закрыть</button><button className="editor-save" onClick={save} disabled={saving || loading}><Save size={17}/>{saving ? 'Проверяем…' : 'Сохранить'}</button></div></div>
    {error && <div className="editor-error"><X size={17}/>{error}</div>}
    {loading && <div className="editor-loading"><div className="loader"/>Загружаем модель…</div>}
    {!loading && !error && <div className="editor-ready"><Check size={14}/>Изменения сохраняются в черновик и не видны исполнителям до публикации.</div>}
    <div className="bpmn-modeler" ref={container}/>
  </section>;
}
