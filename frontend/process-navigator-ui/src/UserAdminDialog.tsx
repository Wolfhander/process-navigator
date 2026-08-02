import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Save, ShieldCheck, UserRound, X } from 'lucide-react';
import { loadUserDirectory, updateUser } from './api';
import type { UserDirectory, UserProfile } from './types';

export function UserAdminDialog({ currentUserId, onClose, onChanged }: {
  currentUserId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [directory, setDirectory] = useState<UserDirectory>();
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<UserProfile>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => { loadUserDirectory().then(data => { setDirectory(data); setSelectedId(data.users[0]?.id ?? ''); }).catch(reason => setError(reason.message)); }, []);
  useEffect(() => setDraft(directory?.users.find(user => user.id === selectedId)), [directory, selectedId]);

  const save = async () => {
    if (!draft) return;
    setBusy(true); setError(''); setSaved('');
    try {
      const updated = await updateUser(draft.id, { displayName: draft.displayName, role: draft.role, isActive: draft.isActive });
      setDirectory(current => current ? { ...current, users: current.users.map(user => user.id === updated.id ? updated : user) } : current);
      setDraft(updated); setSaved('Изменения сохранены.'); await onChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить пользователя.'); }
    finally { setBusy(false); }
  };

  return createPortal(<div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="import-dialog user-admin-dialog" role="dialog" aria-modal="true" aria-labelledby="users-title">
      <button className="icon-button dialog-close" onClick={onClose} aria-label="Закрыть"><X size={18}/></button>
      <span className="eyebrow">Администрирование доступа</span><h2 id="users-title">Пользователи и роли</h2>
      <p>Назначайте организационные роли и временно отключайте доступ. Набор разрешений определяется выбранной ролью.</p>
      {!directory ? <div className="editor-loading"><div className="loader"/>{error || 'Загружаем пользователей…'}</div> : <div className="user-admin-layout">
        <div className="user-list">{directory.users.map(user => <button key={user.id} className={user.id === selectedId ? 'is-selected' : ''} onClick={() => { setSelectedId(user.id); setError(''); setSaved(''); }}><UserRound size={17}/><span><strong>{user.displayName}</strong><small>{user.roleName}{!user.isActive ? ' · отключён' : ''}</small></span></button>)}</div>
        {draft && <div className="user-edit-card">
          <div className="user-edit-title"><ShieldCheck size={19}/><div><strong>{draft.displayName}</strong><small>{draft.id}</small></div></div>
          <label className="dialog-field">Имя пользователя<input maxLength={160} value={draft.displayName} onChange={event => setDraft({ ...draft, displayName: event.target.value })}/></label>
          <label className="dialog-field">Роль<select value={draft.role} onChange={event => { const role = directory.roles.find(item => item.id === event.target.value)!; setDraft({ ...draft, role: role.id, roleName: role.name, permissions: role.permissions }); }}>{directory.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          <label className="user-active-toggle"><input type="checkbox" checked={draft.isActive} disabled={draft.id === currentUserId} onChange={event => setDraft({ ...draft, isActive: event.target.checked })}/><span><strong>Учётная запись активна</strong><small>{draft.id === currentUserId ? 'Текущего пользователя нельзя отключить' : 'Отключённый пользователь не сможет войти'}</small></span></label>
          <div className="permission-list"><strong>Разрешения роли</strong>{draft.permissions.map(permission => <span key={permission}>{permission}</span>)}</div>
          {error && <div className="import-message is-error"><AlertTriangle size={17}/>{error}</div>}{saved && <div className="context-save-notice"><CheckCircle2 size={17}/>{saved}</div>}
          <button className="import-submit" disabled={busy || !draft.displayName.trim()} onClick={save}><Save size={17}/>{busy ? 'Сохраняем…' : 'Сохранить пользователя'}</button>
        </div>}
      </div>}
    </section>
  </div>, document.body);
}
