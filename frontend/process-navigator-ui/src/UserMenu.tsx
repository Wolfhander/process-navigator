import { ShieldCheck, UserRound } from 'lucide-react';
import type { Session } from './types';

export function UserMenu({ session, onChange }: { session: Session; onChange: (role: string) => void }) {
  return <label className="user-menu" title="Демонстрационное переключение пользователя">
    <span className="user-avatar"><UserRound size={15}/></span>
    <span className="user-caption"><strong>{session.currentUser.displayName}</strong><small><ShieldCheck size={11}/>{session.currentUser.roleName}</small></span>
    <select value={session.currentUser.role} onChange={event => onChange(event.target.value)} aria-label="Текущий пользователь">
      {session.availableUsers.map(user => <option value={user.role} key={user.role}>{user.roleName} — {user.displayName}</option>)}
    </select>
  </label>;
}
