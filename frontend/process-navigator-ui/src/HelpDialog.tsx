import { useMemo, useState } from 'react';
import { BarChart3, BookOpen, Check, CircleHelp, FilePenLine, Play, Search, ShieldCheck, Users, Workflow, X } from 'lucide-react';
import type { UserProfile } from './types';
import './help.css';

type Props = { user: UserProfile; onClose: () => void };
type Tab = 'start' | 'roles' | 'capabilities';

const capabilities = [
  ['BPMN-репозиторий', 'Импорт, просмотр и полностью локальное хранение BPMN 2.0.', 'Готово'],
  ['Встроенный редактор', 'Создание и изменение дорожек, задач, событий, шлюзов и переходов.', 'Готово'],
  ['Версии процессов', 'Черновики, публикация, архив и просмотр прежних редакций.', 'Готово'],
  ['Контекст элементов', 'Описания, роли, нормативы, инструкции, шаблоны и ERP-действия.', 'Готово'],
  ['Репозиторий документов', 'Актуальные версии файлов со стабильными ссылками из процессов.', 'Готово'],
  ['Пользователи и роли', 'Исполнитель, руководитель, аналитик, владелец и администраторы.', 'Готово'],
  ['Ответственные по дорожкам', 'Назначение реальных сотрудников на устойчивые процессные роли.', 'Готово'],
  ['Выполнение процесса', 'Экземпляры, фактические исполнители и время прохождения шагов.', 'Готово'],
  ['Аналитика', 'Средний цикл, длительность шагов, нормативы и превышения.', 'Готово'],
  ['Адаптер команд', 'Проверяемые ERP-команды и аудит запусков с границей для 1С.', 'Готово'],
  ['Глобальный поиск', 'Поиск по процессам, шагам, ролям, материалам и действиям.', 'Готово'],
  ['Обсуждения', 'Рабочие комментарии в контексте BPMN-элемента.', 'Готово'],
  ['Настоящий адаптер 1С', 'Обмен с документами и формами конкретной конфигурации ERP.', 'Следующий контур'],
  ['Уведомления и упоминания', 'Адресные сообщения участникам процесса и контроль реакции.', 'Запланировано'],
  ['Карта предприятия', 'Навигация между направлениями и связанными процессами.', 'Запланировано']
] as const;

const roleGuides: Record<string, { title: string; text: string; steps: string[] }> = {
  employee: { title: 'Исполнитель', text: 'Работает через назначенные дорожки и контекст текущего шага.', steps: ['Откройте «Мои шаги».', 'Выберите задачу и прочитайте инструкцию.', 'Начните шаг, выполните ERP-действие и завершите его.'] },
  manager: { title: 'Руководитель', text: 'Контролирует прохождения, сроки и узкие места.', steps: ['Откройте «Выполнения».', 'Выберите экземпляр процесса.', 'Используйте «Аналитику» для проверки превышений.'] },
  analyst: { title: 'Аналитик', text: 'Проектирует BPMN и наполняет элементы рабочим контекстом.', steps: ['Создайте новую редакцию.', 'Измените схему во встроенном редакторе.', 'Добавьте инструкции, нормативы и действия в карточках элементов.'] },
  owner: { title: 'Владелец процесса', text: 'Управляет содержанием, ответственными и публикацией.', steps: ['Проверьте черновик аналитика.', 'Назначьте сотрудников на дорожки.', 'Опубликуйте согласованную редакцию.'] },
  administrator: { title: 'Администратор', text: 'Настраивает пользователей и поддерживает работу платформы.', steps: ['Проверьте пользователей и роли.', 'Настройте назначения процесса.', 'Контролируйте импорт, публикации и доступ.'] },
  superadministrator: { title: 'СуперАдминистратор', text: 'Имеет полный доступ к платформе и системным настройкам.', steps: ['Управляйте всеми пользователями.', 'Проверяйте интеграции и журналы.', 'Поддерживайте резервное копирование данных.'] }
};

export function HelpDialog({ user, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('start');
  const [filter, setFilter] = useState('');
  const guide = roleGuides[user.role] ?? roleGuides.employee;
  const filtered = useMemo(() => capabilities.filter(item => `${item[0]} ${item[1]} ${item[2]}`.toLowerCase().includes(filter.toLowerCase())), [filter]);

  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="help-dialog" role="dialog" aria-modal="true" aria-label="Справка Process Navigator">
      <header><div><span className="eyebrow">Центр знаний</span><h2>Как работать в Process Navigator</h2></div><button className="dialog-close" onClick={onClose}><X size={17}/></button></header>
      <nav>{([['start','Быстрый старт'],['roles','Моя роль'],['capabilities','Возможности']] as const).map(item => <button key={item[0]} className={tab === item[0] ? 'is-active' : ''} onClick={() => setTab(item[0])}>{item[1]}</button>)}</nav>
      <div className="help-content">
        {tab === 'start' && <div className="help-start">
          <article><Workflow/><span><strong>1. Увидьте процесс целиком</strong><p>Дорожки показывают ответственные роли, а подписи на стрелках объясняют варианты перехода.</p></span></article>
          <article><CircleHelp/><span><strong>2. Откройте контекст шага</strong><p>Нажмите задачу, чтобы увидеть ответственных, норматив, материалы, действия и обсуждение.</p></span></article>
          <article><Play/><span><strong>3. Выполните работу</strong><p>Откройте экземпляр процесса, начните свой шаг и запускайте разрешённые ERP-команды из схемы.</p></span></article>
          <article><Search/><span><strong>4. Найдите нужное</strong><p>Поиск находит процесс, действие или актуальный документ и возвращает к его месту на BPMN.</p></span></article>
          <div className="help-tip"><BookOpen size={17}/><span><strong>Главное правило</strong>Схема остаётся чистой, а рабочая информация находится в контекстной панели выбранного элемента.</span></div>
        </div>}
        {tab === 'roles' && <div className="role-guide"><span className="role-guide-icon"><ShieldCheck size={28}/></span><div><small>Ваша роль</small><h3>{guide.title}</h3><p>{guide.text}</p></div><ol>{guide.steps.map(step => <li key={step}><Check size={15}/><span>{step}</span></li>)}</ol><p className="role-permissions"><strong>Разрешения:</strong> {user.permissions.join(' · ')}</p></div>}
        {tab === 'capabilities' && <div className="capability-guide"><label><Search size={15}/><input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Найти возможность…"/></label><div>{filtered.map(item => <article key={item[0]}><span className="capability-icon">{item[0].includes('редактор') ? <FilePenLine size={16}/> : item[0].includes('Аналитика') ? <BarChart3 size={16}/> : item[0].includes('Пользователи') ? <Users size={16}/> : <Check size={16}/>}</span><span><strong>{item[0]}</strong><p>{item[1]}</p></span><em className={item[2] === 'Готово' ? 'is-ready' : ''}>{item[2]}</em></article>)}</div></div>}
      </div>
    </section>
  </div>;
}
