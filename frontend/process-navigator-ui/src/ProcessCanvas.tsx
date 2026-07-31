import type { Edge, ProcessModel, ProcessNode } from './types';

type Props = { process: ProcessModel; selectedId?: string; onSelect: (node?: ProcessNode) => void };
const world = { width: 1660, height: 820 };

function pathFor(edge: Edge) { return edge.points.map((p, index) => `${index ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '); }

function labelPoint(edge: Edge) {
  const index = Math.max(0, Math.floor((edge.points.length - 1) / 2));
  const a = edge.points[index], b = edge.points[index + 1] ?? a;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 9 };
}

function NodeShape({ node, selected, onSelect }: { node: ProcessNode; selected: boolean; onSelect: () => void }) {
  const common = { className: `node node--${node.type}${selected ? ' is-selected' : ''}`, onClick: onSelect, role: 'button', tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && onSelect() };
  const cx = node.x + node.width / 2, cy = node.y + node.height / 2;
  if (node.type === 'startEvent' || node.type === 'endEvent') return <g {...common}><circle cx={cx} cy={cy} r={node.width / 2 - 3}/>{node.type === 'endEvent' && <circle cx={cx} cy={cy} r={node.width / 2 - 7}/>}<title>{node.name}</title></g>;
  if (node.type === 'exclusiveGateway') return <g {...common}><path d={`M ${cx} ${node.y} L ${node.x + node.width} ${cy} L ${cx} ${node.y + node.height} L ${node.x} ${cy} Z`}/><path className="gateway-mark" d={`M ${cx-9} ${cy-9} L ${cx+9} ${cy+9} M ${cx+9} ${cy-9} L ${cx-9} ${cy+9}`}/><title>{node.name}</title></g>;
  return <g {...common}><rect x={node.x} y={node.y} width={node.width} height={node.height} rx="12"/><foreignObject x={node.x + 10} y={node.y + 8} width={node.width - 20} height={node.height - 16}><div className="node-label">{node.name}</div></foreignObject></g>;
}

export function ProcessCanvas({ process, selectedId, onSelect }: Props) {
  return <div className="canvas-wrap"><svg className="canvas" viewBox={`0 0 ${world.width} ${world.height}`} preserveAspectRatio="xMidYMid meet" onClick={() => onSelect()} aria-label="Диаграмма процесса">
    <defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#dfe2dc" strokeWidth="1"/></pattern><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#47524b"/></marker></defs>
    <rect width="100%" height="100%" fill="url(#grid)"/>
    <g className="lanes">{process.lanes.map(lane => <g key={lane.id}><rect className="lane" x="45" y={lane.y} width="1570" height={lane.height}/><foreignObject x="45" y={lane.y} width="55" height={lane.height}><div className="lane-title">{lane.name}</div></foreignObject></g>)}</g>
    <g className="edges">{process.edges.map(edge => { const lp = labelPoint(edge); return <g key={edge.id}><path d={pathFor(edge)} markerEnd="url(#arrow)"/><text x={lp.x} y={lp.y} textAnchor="middle">{edge.label}</text></g>; })}</g>
    <g className="nodes" onClick={e => e.stopPropagation()}>{process.nodes.map(node => <NodeShape key={node.id} node={node} selected={node.id === selectedId} onSelect={() => onSelect(node)}/>)}</g>
  </svg><div className="canvas-hint">Колесо мыши — масштаб · перетаскивание — обзор (следующая итерация)</div></div>;
}

