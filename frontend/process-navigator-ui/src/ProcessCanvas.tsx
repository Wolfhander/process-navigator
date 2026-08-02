import { useEffect, useRef, useState } from 'react';
import { resolveCapabilities } from './capabilities';
import type { Edge, Point, ProcessModel, ProcessNode } from './types';

type ZoomCommand = { id: number; factor: number };
type Props = {
  process: ProcessModel;
  selectedId?: string;
  onSelect: (node?: ProcessNode) => void;
  zoomCommand?: ZoomCommand;
  fitCommand?: number;
  personalMode?: boolean;
  personalLaneIds?: string[];
  stepStatuses?: Record<string, string>;
};

const world = { x: 0, y: 0, width: 1660, height: 820 };
const minZoom = 1;
const maxZoom = 4;
type Camera = { x: number; y: number; width: number; height: number };

function pathFor(edge: Edge) {
  return edge.points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
}

function labelPoint(edge: Edge) {
  const index = Math.max(0, Math.floor((edge.points.length - 1) / 2));
  const a = edge.points[index], b = edge.points[index + 1] ?? a;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 9 };
}

function clampCamera(camera: Camera): Camera {
  const width = Math.min(world.width, Math.max(world.width / maxZoom, camera.width));
  const height = Math.min(world.height, Math.max(world.height / maxZoom, camera.height));
  return {
    width,
    height,
    x: Math.min(world.width - width, Math.max(world.x, camera.x)),
    y: Math.min(world.height - height, Math.max(world.y, camera.y))
  };
}

function zoomAt(camera: Camera, factor: number, anchor: Point): Camera {
  const width = camera.width / factor;
  const height = camera.height / factor;
  const ratioX = (anchor.x - camera.x) / camera.width;
  const ratioY = (anchor.y - camera.y) / camera.height;
  return clampCamera({
    width,
    height,
    x: anchor.x - width * ratioX,
    y: anchor.y - height * ratioY
  });
}

function NodeShape({ node, selected, related, personal, muted, executionStatus, showOverlays, onSelect }: { node: ProcessNode; selected: boolean; related: boolean; personal: boolean; muted: boolean; executionStatus?: string; showOverlays: boolean; onSelect: () => void }) {
  const capabilities = resolveCapabilities(node);
  const actionCount = capabilities.filter(capability => capability.kind === 'action').length;
  const artifactCount = capabilities.filter(capability => capability.kind === 'artifact').length;
  const overlayLabel = [actionCount ? 'ERP' : '', artifactCount ? `${artifactCount} мат.` : ''].filter(Boolean).join(' · ');
  const common = {
    className: `node node--${node.type}${selected ? ' is-selected' : ''}${related ? ' is-related' : ''}${personal ? ' is-personal' : ''}${executionStatus ? ` execution-${executionStatus.toLowerCase()}` : ''}${muted ? ' is-muted' : ''}`,
    onClick: onSelect,
    onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
    role: 'button',
    tabIndex: 0,
    onKeyDown: (event: React.KeyboardEvent) => (event.key === 'Enter' || event.key === ' ') && onSelect()
  };
  const cx = node.x + node.width / 2, cy = node.y + node.height / 2;
  if (node.type === 'startEvent' || node.type === 'endEvent') return <g {...common}><circle cx={cx} cy={cy} r={node.width / 2 - 3}/>{node.type === 'endEvent' && <circle cx={cx} cy={cy} r={node.width / 2 - 7}/>}<title>{node.name}</title></g>;
  if (node.type === 'exclusiveGateway') return <g {...common}><path d={`M ${cx} ${node.y} L ${node.x + node.width} ${cy} L ${cx} ${node.y + node.height} L ${node.x} ${cy} Z`}/><path className="gateway-mark" d={`M ${cx-9} ${cy-9} L ${cx+9} ${cy+9} M ${cx+9} ${cy-9} L ${cx-9} ${cy+9}`}/><title>{node.name}</title></g>;
  return <g {...common}><rect x={node.x} y={node.y} width={node.width} height={node.height} rx="12"/><foreignObject x={node.x + 10} y={node.y + 8} width={node.width - 20} height={node.height - 16}><div className="node-label">{node.name}</div></foreignObject>{showOverlays && overlayLabel && <g className="capability-overlay" transform={`translate(${node.x + node.width - 5} ${node.y - 5})`}><rect x={-72} y={-18} width={72} height={22} rx={11}/><text x={-36} y={-4} textAnchor="middle">{overlayLabel}</text></g>}</g>;
}

export function ProcessCanvas({ process, selectedId, onSelect, zoomCommand, fitCommand, personalMode = false, personalLaneIds = [], stepStatuses = {} }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; camera: Camera; moved: boolean } | undefined>(undefined);
  const suppressClickRef = useRef(false);
  const [camera, setCamera] = useState<Camera>(world);
  const zoom = world.width / camera.width;
  const selectedNode = process.nodes.find(node => node.id === selectedId);
  const activeLane = process.lanes.find(lane => lane.id === selectedNode?.laneId)
    ?? process.lanes.find(lane => camera.y + camera.height / 2 >= lane.y && camera.y + camera.height / 2 < lane.y + lane.height);
  const focusedEdges = new Set(process.edges.filter(edge => edge.sourceId === selectedId || edge.targetId === selectedId).map(edge => edge.id));
  const relatedNodes = new Set<string>([selectedId ?? '']);
  const personalLanes = new Set(personalLaneIds);
  const personalNodes = new Set(process.nodes.filter(node => personalLanes.has(node.laneId)).map(node => node.id));
  process.edges.forEach(edge => {
    if (focusedEdges.has(edge.id)) {
      relatedNodes.add(edge.sourceId);
      relatedNodes.add(edge.targetId);
    }
  });

  useEffect(() => { if (zoomCommand) setCamera(current => zoomAt(current, zoomCommand.factor, { x: current.x + current.width / 2, y: current.y + current.height / 2 })); }, [zoomCommand]);
  useEffect(() => { if (fitCommand !== undefined) setCamera(world); }, [fitCommand]);

  const pointFromClient = (clientX: number, clientY: number): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: camera.x + (clientX - rect.left) / rect.width * camera.width, y: camera.y + (clientY - rect.top) / rect.height * camera.height };
  };

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
    setCamera(current => zoomAt(current, factor, pointFromClient(event.clientX, event.clientY)));
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, camera, moved: false };
    event.currentTarget.classList.add('is-panning');
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 3) drag.moved = true;
    const rect = event.currentTarget.getBoundingClientRect();
    setCamera(clampCamera({ ...drag.camera, x: drag.camera.x - (event.clientX - drag.x) / rect.width * drag.camera.width, y: drag.camera.y - (event.clientY - drag.y) / rect.height * drag.camera.height }));
  };

  const stopPan = (event: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      suppressClickRef.current = dragRef.current.moved;
      dragRef.current = undefined;
    }
    event.currentTarget.classList.remove('is-panning');
  };

  const centerFromMinimap = (event: React.MouseEvent<SVGSVGElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * world.width;
    const y = (event.clientY - rect.top) / rect.height * world.height;
    setCamera(current => clampCamera({ ...current, x: x - current.width / 2, y: y - current.height / 2 }));
  };

  return <div className="canvas-wrap">
    <svg ref={svgRef} className="canvas" viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`} preserveAspectRatio="none" onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stopPan} onPointerCancel={stopPan} onDoubleClick={() => setCamera(world)} onClick={() => { if (suppressClickRef.current) suppressClickRef.current = false; else onSelect(); }} aria-label="Диаграмма процесса">
      <defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#dfe2dc" strokeWidth="1"/></pattern><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#47524b"/></marker><marker id="arrow-focus" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#d4673c"/></marker></defs>
      <rect width={world.width} height={world.height} fill="url(#grid)"/>
      <g className="lanes">{process.lanes.map(lane => <g key={lane.id} className={personalMode ? personalLanes.has(lane.id) ? 'is-personal' : 'is-muted' : ''}><rect className="lane" x="45" y={lane.y} width="1570" height={lane.height}/><foreignObject x="45" y={lane.y} width="55" height={lane.height}><div className="lane-title">{lane.name}</div></foreignObject></g>)}</g>
      <g className="edges">{process.edges.map(edge => { const label = labelPoint(edge); const focused = !!selectedId && focusedEdges.has(edge.id); const personal = personalMode && (personalNodes.has(edge.sourceId) || personalNodes.has(edge.targetId)); const muted = selectedId ? !focused : personalMode && !personal; return <g key={edge.id} className={`${focused ? 'is-focused' : personal ? 'is-personal' : ''}${muted ? ' is-muted' : ''}`}><path d={pathFor(edge)} markerEnd={focused || personal ? 'url(#arrow-focus)' : 'url(#arrow)'}/><text x={label.x} y={label.y} textAnchor="middle">{edge.label}</text></g>; })}</g>
      <g className="nodes" onClick={event => event.stopPropagation()}>{process.nodes.map(node => <NodeShape key={node.id} node={node} selected={node.id === selectedId} related={!!selectedId && relatedNodes.has(node.id) && node.id !== selectedId} personal={personalMode && personalNodes.has(node.id)} muted={selectedId ? !relatedNodes.has(node.id) : personalMode && !personalNodes.has(node.id)} executionStatus={stepStatuses[node.id]} showOverlays={zoom >= 1.25 || node.id === selectedId} onSelect={() => onSelect(node)}/>)}</g>
    </svg>
    <div className="zoom-readout">{Math.round(zoom * 100)}%</div>
    {activeLane && (zoom >= 1.2 || selectedNode) && <div className="lane-badge"><span>{selectedNode ? 'Ответственная дорожка' : 'Текущая дорожка'}</span><strong>{activeLane.name}</strong></div>}
    <svg className="minimap" viewBox={`0 0 ${world.width} ${world.height}`} onClick={centerFromMinimap} aria-label="Мини-карта процесса">
      <rect className="minimap-bg" width={world.width} height={world.height}/>
      {process.lanes.map(lane => <rect key={lane.id} className="minimap-lane" x="45" y={lane.y} width="1570" height={lane.height}/>)}
      {process.edges.map(edge => <path key={edge.id} className="minimap-edge" d={pathFor(edge)}/>)}
      {process.nodes.map(node => <rect key={node.id} className={`minimap-node${node.id === selectedId ? ' is-selected' : ''}`} x={node.x} y={node.y} width={Math.max(node.width, 35)} height={Math.max(node.height, 35)}/>)}
      <rect className="minimap-viewport" x={camera.x} y={camera.y} width={camera.width} height={camera.height}/>
    </svg>
    <div className="canvas-hint">Колесо — масштаб · перетаскивание — обзор · двойной щелчок — весь процесс</div>
  </div>;
}
