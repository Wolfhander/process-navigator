import { ArrowRight, Boxes, Factory, Landmark, PackageOpen, ShoppingCart, UsersRound, Workflow } from 'lucide-react';
import type { ProcessSummary } from './types';
import './enterprise-map.css';

type Props = {
  catalog: ProcessSummary[];
  onOpenProcess: (processId: string) => void;
};

const directions = [
  { id: 'sales', name: 'Продажи', description: 'От потребности клиента до выполнения обязательств.', icon: UsersRound, processIds: [] as string[] },
  { id: 'procurement', name: 'Закупки', description: 'Обеспечение предприятия материалами и услугами.', icon: ShoppingCart, processIds: ['purchase-materials'] },
  { id: 'production', name: 'Производство', description: 'Планирование, выпуск и контроль качества продукции.', icon: Factory, processIds: [] as string[] },
  { id: 'warehouse', name: 'Склад и логистика', description: 'Приёмка, хранение и движение материальных потоков.', icon: PackageOpen, processIds: [] as string[] },
  { id: 'finance', name: 'Финансы', description: 'Бюджетирование, платежи и управленческий контроль.', icon: Landmark, processIds: [] as string[] },
  { id: 'support', name: 'Обеспечивающие процессы', description: 'Персонал, ИТ, качество и административные функции.', icon: Boxes, processIds: [] as string[] }
];

export function EnterpriseMap({ catalog, onOpenProcess }: Props) {
  const assigned = new Set(directions.flatMap(direction => direction.processIds));
  const unassigned = catalog.filter(process => !assigned.has(process.id));

  return <main className="enterprise-map">
    <section className="enterprise-intro">
      <div><span className="eyebrow">Карта предприятия</span><h1>ООО «Демо»</h1><p>Выберите направление, чтобы перейти к его процессам. Карта показывает только опубликованные и доступные вам модели.</p></div>
      <div className="enterprise-summary"><span><Workflow size={20}/><strong>{catalog.length}</strong><small>процессов в каталоге</small></span><span><Boxes size={20}/><strong>{directions.length}</strong><small>направлений</small></span></div>
    </section>
    <section className="direction-grid" aria-label="Направления деятельности">
      {directions.map(direction => {
        const processes = catalog.filter(process => direction.processIds.includes(process.id));
        return <article className={`direction-card${processes.length ? ' has-processes' : ''}`} key={direction.id}>
          <header><span className="direction-icon"><direction.icon size={21}/></span><div><h2>{direction.name}</h2><p>{direction.description}</p></div></header>
          <div className="direction-processes">
            {processes.map(process => <button key={process.id} onClick={() => onOpenProcess(process.id)}>
              <span><strong>{process.name}</strong><small>Версия {process.version} · {process.nodeCount} элементов · {process.laneCount} ролей</small></span><ArrowRight size={18}/>
            </button>)}
            {!processes.length && <div className="direction-empty"><span>Процессы ещё не описаны</span><small>Направление подготовлено для дальнейшего наполнения.</small></div>}
          </div>
        </article>;
      })}
      {unassigned.length > 0 && <article className="direction-card has-processes direction-card--other">
        <header><span className="direction-icon"><Workflow size={21}/></span><div><h2>Другие процессы</h2><p>Импортированные модели, для которых направление пока не назначено.</p></div></header>
        <div className="direction-processes">{unassigned.map(process => <button key={process.id} onClick={() => onOpenProcess(process.id)}><span><strong>{process.name}</strong><small>Версия {process.version}</small></span><ArrowRight size={18}/></button>)}</div>
      </article>}
    </section>
  </main>;
}
