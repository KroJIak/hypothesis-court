import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpenText,
  CircleDot,
  FileText,
  GitBranch,
  Lightbulb,
  Network,
  RotateCcw,
  Scale,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { buildKnowledgeGraph } from "../model/knowledgeGraphModel";
import { clampNumber } from "../utils/format";

const GRAPH_WIDTH = 1080;
const GRAPH_HEIGHT = 640;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_GAP = 12;
const TOOLTIP_EDGE_OFFSET = 16;
const MIN_CAMERA_SCALE = 0.54;
const MAX_CAMERA_SCALE = 2.6;
const CAMERA_ZOOM_INTENSITY = 0.0012;
const NODE_REPEL_RADIUS = 76;
const NODE_REPEL_STEP = 28;
const NODE_DRAG_LIMIT = 520;
const ZONE_NODE_PADDING = 72;

const INITIAL_CAMERA = {
  x: 0,
  y: 0,
  scale: 1,
};

const ZONE_LAYOUTS = {
  brief: { x: 52, y: 72, width: 230, height: 220 },
  sources: { x: 54, y: 352, width: 244, height: 206 },
  evidence: { x: 370, y: 62, width: 270, height: 504 },
  hypotheses: { x: 732, y: 82, width: 284, height: 250 },
  decision: { x: 720, y: 408, width: 300, height: 170 },
};

const NODE_META = {
  brief: { label: "Вводная", icon: BookOpenText },
  constraint: { label: "Ограничение", icon: Scale },
  evidence: { label: "Факт", icon: CircleDot },
  evaluation: { label: "Оценка", icon: GitBranch },
  hypothesis: { label: "Гипотеза", icon: Lightbulb },
  kpi: { label: "KPI", icon: CircleDot },
  source: { label: "Источник", icon: FileText },
  verdict: { label: "Вердикт", icon: Network },
};

function clampGraphCoordinate(value, axisSize) {
  return clampNumber(value, -NODE_DRAG_LIMIT, axisSize + NODE_DRAG_LIMIT);
}

function createSmoothZonePath(bounds) {
  const left = bounds.x;
  const top = bounds.y;
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const width = bounds.width;
  const height = bounds.height;

  return [
    `M ${left + width * 0.16} ${top + height * 0.04}`,
    `C ${left + width * 0.34} ${top - height * 0.04}, ${left + width * 0.74} ${top - height * 0.02}, ${right - width * 0.08} ${top + height * 0.15}`,
    `C ${right + width * 0.04} ${top + height * 0.36}, ${right + width * 0.02} ${bottom - height * 0.26}, ${right - width * 0.16} ${bottom - height * 0.08}`,
    `C ${right - width * 0.34} ${bottom + height * 0.05}, ${left + width * 0.28} ${bottom + height * 0.04}, ${left + width * 0.08} ${bottom - height * 0.16}`,
    `C ${left - width * 0.04} ${bottom - height * 0.34}, ${left - width * 0.04} ${top + height * 0.28}, ${left + width * 0.16} ${top + height * 0.04}`,
    "Z",
  ].join(" ");
}

function createEdgePath(fromNode, toNode) {
  const dx = Math.max(70, Math.abs(toNode.x - fromNode.x) * 0.52);
  const controlA = fromNode.x + dx;
  const controlB = toNode.x - dx;

  return `M ${fromNode.x} ${fromNode.y} C ${controlA} ${fromNode.y}, ${controlB} ${toNode.y}, ${toNode.x} ${toNode.y}`;
}

function getNodePosition(layout, index, count) {
  const safeCount = Math.max(1, count);
  const columns = safeCount <= 3 ? 1 : 2;
  const rows = Math.ceil(safeCount / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const paddingX = layout.width * 0.2;
  const paddingY = layout.height * 0.23;
  const availableWidth = Math.max(1, layout.width - paddingX * 2);
  const availableHeight = Math.max(1, layout.height - paddingY * 2);
  const x = layout.x + paddingX + (columns === 1 ? availableWidth / 2 : (availableWidth * column) / (columns - 1));
  const y = layout.y + paddingY + (rows === 1 ? availableHeight / 2 : (availableHeight * row) / (rows - 1));

  return { x, y };
}

function getSvgPoint(event, svgElement) {
  const rect = svgElement.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * GRAPH_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * GRAPH_HEIGHT,
  };
}

function getWorldPoint(event, svgElement, camera) {
  const point = getSvgPoint(event, svgElement);

  return {
    x: (point.x - camera.x) / camera.scale,
    y: (point.y - camera.y) / camera.scale,
  };
}

function getTooltipStyle(event) {
  const top = clampNumber(
    event.clientY + TOOLTIP_GAP,
    TOOLTIP_EDGE_OFFSET,
    window.innerHeight - TOOLTIP_EDGE_OFFSET - 220,
  );
  const left = clampNumber(
    event.clientX + TOOLTIP_GAP,
    TOOLTIP_EDGE_OFFSET,
    window.innerWidth - TOOLTIP_EDGE_OFFSET - TOOLTIP_WIDTH,
  );

  return {
    top: `${top}px`,
    left: `${left}px`,
    width: `${TOOLTIP_WIDTH}px`,
  };
}

function getConnectedIds(graph, activeItem) {
  if (!activeItem) {
    return { nodeIds: new Set(), edgeIds: new Set() };
  }

  if (activeItem.kind === "edge") {
    return {
      nodeIds: new Set([activeItem.item.from, activeItem.item.to]),
      edgeIds: new Set([activeItem.item.id]),
    };
  }

  const edgeIds = new Set();
  const nodeIds = new Set([activeItem.item.id]);

  graph.edges.forEach((edge) => {
    if (edge.from === activeItem.item.id || edge.to === activeItem.item.id) {
      edgeIds.add(edge.id);
      nodeIds.add(edge.from);
      nodeIds.add(edge.to);
    }
  });

  return { nodeIds, edgeIds };
}

function getStableAngle(id) {
  const hash = [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0);

  return (hash % 360) * (Math.PI / 180);
}

function repelNearbyNodes(nodes, draggedNodeId, draggedPosition, currentPositions) {
  const nextPositions = {
    ...currentPositions,
    [draggedNodeId]: draggedPosition,
  };

  nodes.forEach((node) => {
    if (node.id === draggedNodeId) {
      return;
    }

    const currentPosition = nextPositions[node.id] ?? { x: node.x, y: node.y };
    const dx = currentPosition.x - draggedPosition.x;
    const dy = currentPosition.y - draggedPosition.y;
    const distance = Math.hypot(dx, dy);

    if (distance >= NODE_REPEL_RADIUS) {
      return;
    }

    const fallbackAngle = getStableAngle(node.id);
    const directionX = distance > 0.01 ? dx / distance : Math.cos(fallbackAngle);
    const directionY = distance > 0.01 ? dy / distance : Math.sin(fallbackAngle);
    const push = ((NODE_REPEL_RADIUS - distance) / NODE_REPEL_RADIUS) * NODE_REPEL_STEP;

    nextPositions[node.id] = {
      x: clampGraphCoordinate(currentPosition.x + directionX * push, GRAPH_WIDTH),
      y: clampGraphCoordinate(currentPosition.y + directionY * push, GRAPH_HEIGHT),
    };
  });

  return nextPositions;
}

function createZoneBounds(zoneId, nodes) {
  const layout = ZONE_LAYOUTS[zoneId];
  const zoneNodes = nodes.filter((node) => node.zone === zoneId);
  const nodeXs = zoneNodes.map((node) => node.x);
  const nodeYs = zoneNodes.map((node) => node.y);
  const minX = Math.min(layout.x, ...nodeXs) - ZONE_NODE_PADDING;
  const minY = Math.min(layout.y, ...nodeYs) - ZONE_NODE_PADDING;
  const maxX = Math.max(layout.x + layout.width, ...nodeXs) + ZONE_NODE_PADDING;
  const maxY = Math.max(layout.y + layout.height, ...nodeYs) + ZONE_NODE_PADDING;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function SourceQuote({ source }) {
  if (!source?.quote) {
    return source?.excerpt ? <p>{source.excerpt}</p> : null;
  }

  return (
    <p className="knowledge-graph-tooltip__quote">
      {source.contextBefore ? <span>{source.contextBefore} </span> : null}
      <strong>{source.quote}</strong>
      {source.contextAfter ? <span> {source.contextAfter}</span> : null}
    </p>
  );
}

function GraphTooltip({ item }) {
  if (!item) {
    return null;
  }

  const nodeType = item.kind === "node" ? NODE_META[item.item.type]?.label : "Связь";
  const details = Array.isArray(item.item.details)
    ? item.item.details
    : item.item.details
      ? [item.item.details]
      : [];
  const source = item.item.source;

  return createPortal(
    <aside className="knowledge-graph-tooltip" style={item.style} role="tooltip">
      <span className="knowledge-graph-tooltip__type">{nodeType}</span>
      <strong>{item.item.label}</strong>
      {source ? <SourceQuote source={source} /> : item.item.summary ? <p>{item.item.summary}</p> : null}
      {details.length > 0 ? (
        <ul>
          {details.slice(0, 3).map((detail, index) => (
            <li key={`${item.item.id}-detail-${index}`}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </aside>,
    document.body,
  );
}

export function KnowledgeGraphModal({
  session,
  focusNodeId = null,
  onClose,
}) {
  const svgRef = useRef(null);
  const dragStateRef = useRef(null);
  const [activeItem, setActiveItem] = useState(null);
  const [camera, setCamera] = useState(INITIAL_CAMERA);
  const [nodePositions, setNodePositions] = useState({});
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [isCameraDragging, setIsCameraDragging] = useState(false);
  const graph = useMemo(() => buildKnowledgeGraph(session), [session]);
  const positionedGraph = useMemo(() => {
    const nodesByZone = new Map();

    graph.nodes.forEach((node) => {
      const zoneId = ZONE_LAYOUTS[node.zone] ? node.zone : "evidence";
      const zoneNodes = nodesByZone.get(zoneId) ?? [];
      zoneNodes.push(node);
      nodesByZone.set(zoneId, zoneNodes);
    });

    const nodes = graph.nodes.map((node) => {
      const zoneId = ZONE_LAYOUTS[node.zone] ? node.zone : "evidence";
      const zoneNodes = nodesByZone.get(zoneId) ?? [];
      const index = Math.max(0, zoneNodes.findIndex((zoneNode) => zoneNode.id === node.id));
      const basePosition = getNodePosition(ZONE_LAYOUTS[zoneId], index, zoneNodes.length);
      const savedPosition = nodePositions[node.id];

      return {
        ...node,
        zone: zoneId,
        x: savedPosition?.x ?? basePosition.x,
        y: savedPosition?.y ?? basePosition.y,
      };
    });
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edges = graph.edges
      .map((edge) => {
        const fromNode = nodeById.get(edge.from);
        const toNode = nodeById.get(edge.to);

        if (!fromNode || !toNode) {
          return null;
        }

        return {
          ...edge,
          d: createEdgePath(fromNode, toNode),
        };
      })
      .filter(Boolean);
    const zoneBounds = graph.zones.map((zone) => ({
      ...zone,
      bounds: ZONE_LAYOUTS[zone.id] ? createZoneBounds(zone.id, nodes) : null,
    }));

    return {
      ...graph,
      nodes,
      edges,
      nodeById,
      zoneBounds,
    };
  }, [graph, nodePositions]);
  const connectedIds = useMemo(
    () => getConnectedIds(positionedGraph, activeItem),
    [activeItem, positionedGraph],
  );

  useEffect(() => {
    setCamera(INITIAL_CAMERA);
    setNodePositions({});
    setDraggedNodeId(null);
    setActiveItem(null);
  }, [session.id]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const showNodeTooltip = useCallback((event, node) => {
    if (dragStateRef.current) {
      return;
    }

    setActiveItem({
      kind: "node",
      item: node,
      style: getTooltipStyle(event),
    });
  }, []);

  const showEdgeTooltip = useCallback((event, edge) => {
    if (dragStateRef.current) {
      return;
    }

    setActiveItem({
      kind: "edge",
      item: edge,
      style: getTooltipStyle(event),
    });
  }, []);

  const hideTooltip = useCallback(() => {
    setActiveItem(null);
  }, []);

  useEffect(() => {
    if (!activeItem) {
      return undefined;
    }

    window.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);

    return () => {
      window.removeEventListener("scroll", hideTooltip, true);
      window.removeEventListener("resize", hideTooltip);
    };
  }, [activeItem, hideTooltip]);

  const zoomCameraAt = useCallback((event, nextScale) => {
    const svgElement = svgRef.current;

    if (!svgElement) {
      return;
    }

    const svgPoint = getSvgPoint(event, svgElement);

    setCamera((currentCamera) => {
      const scale = clampNumber(nextScale, MIN_CAMERA_SCALE, MAX_CAMERA_SCALE);
      const worldX = (svgPoint.x - currentCamera.x) / currentCamera.scale;
      const worldY = (svgPoint.y - currentCamera.y) / currentCamera.scale;

      return {
        scale,
        x: svgPoint.x - worldX * scale,
        y: svgPoint.y - worldY * scale,
      };
    });
  }, []);

  const handleGraphWheel = useCallback((event) => {
    event.preventDefault();
    const nextScale = camera.scale * Math.exp(-event.deltaY * CAMERA_ZOOM_INTENSITY);

    zoomCameraAt(event, nextScale);
  }, [camera.scale, zoomCameraAt]);

  const handleGraphPointerDown = useCallback((event) => {
    if (event.button !== 0 || !svgRef.current) {
      return;
    }

    const svgPoint = getSvgPoint(event, svgRef.current);

    dragStateRef.current = {
      type: "camera",
      pointerId: event.pointerId,
      startX: svgPoint.x,
      startY: svgPoint.y,
      camera,
    };
    setIsCameraDragging(true);
    setActiveItem(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [camera]);

  const handleNodePointerDown = useCallback((event, node) => {
    if (event.button !== 0 || !svgRef.current) {
      return;
    }

    event.stopPropagation();
    const worldPoint = getWorldPoint(event, svgRef.current, camera);

    dragStateRef.current = {
      type: "node",
      pointerId: event.pointerId,
      nodeId: node.id,
      offsetX: node.x - worldPoint.x,
      offsetY: node.y - worldPoint.y,
    };
    setDraggedNodeId(node.id);
    setActiveItem(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [camera]);

  const handleGraphPointerMove = useCallback((event) => {
    const dragState = dragStateRef.current;
    const svgElement = svgRef.current;

    if (!dragState || !svgElement) {
      return;
    }

    if (dragState.type === "camera") {
      const svgPoint = getSvgPoint(event, svgElement);

      setCamera({
        ...dragState.camera,
        x: dragState.camera.x + svgPoint.x - dragState.startX,
        y: dragState.camera.y + svgPoint.y - dragState.startY,
      });
      return;
    }

    const worldPoint = getWorldPoint(event, svgElement, camera);
    const draggedPosition = {
      x: clampGraphCoordinate(worldPoint.x + dragState.offsetX, GRAPH_WIDTH),
      y: clampGraphCoordinate(worldPoint.y + dragState.offsetY, GRAPH_HEIGHT),
    };

    setNodePositions((currentPositions) =>
      repelNearbyNodes(positionedGraph.nodes, dragState.nodeId, draggedPosition, currentPositions),
    );
  }, [camera, positionedGraph.nodes]);

  const handleGraphPointerUp = useCallback((event) => {
    const dragState = dragStateRef.current;

    if (dragState?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      setDraggedNodeId(null);
      setIsCameraDragging(false);
    }
  }, []);

  const handleControlZoom = useCallback((scaleMultiplier) => {
    setCamera((currentCamera) => {
      const nextScale = clampNumber(currentCamera.scale * scaleMultiplier, MIN_CAMERA_SCALE, MAX_CAMERA_SCALE);
      const center = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
      const worldX = (center.x - currentCamera.x) / currentCamera.scale;
      const worldY = (center.y - currentCamera.y) / currentCamera.scale;

      return {
        scale: nextScale,
        x: center.x - worldX * nextScale,
        y: center.y - worldY * nextScale,
      };
    });
  }, []);

  const handleResetView = useCallback(() => {
    setCamera(INITIAL_CAMERA);
  }, []);

  return createPortal(
    <div className="knowledge-graph-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="knowledge-graph-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Граф доказательств"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="knowledge-graph-modal__close"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <X strokeWidth={2} />
        </button>

        <header className="knowledge-graph-modal__header">
          <span className="knowledge-graph-modal__eyebrow">Evidence / Knowledge Graph</span>
          <h2 className="knowledge-graph-modal__title">Карта доказательств</h2>
          <p className="knowledge-graph-modal__subtitle">
            Связи между вводными, источниками, фактами, гипотезами и итоговой оценкой.
          </p>
        </header>

        <div className="knowledge-graph-modal__body">
          <div className="knowledge-graph-shell">
            <svg
              ref={svgRef}
              className={[
                "knowledge-graph",
                isCameraDragging ? "knowledge-graph--panning" : "",
                draggedNodeId ? "knowledge-graph--dragging-node" : "",
              ].filter(Boolean).join(" ")}
              viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
              role="img"
              aria-label="Граф доказательств и гипотез"
              onWheel={handleGraphWheel}
              onPointerDown={handleGraphPointerDown}
              onPointerMove={handleGraphPointerMove}
              onPointerUp={handleGraphPointerUp}
              onPointerCancel={handleGraphPointerUp}
            >
              <defs>
                <marker
                  id="knowledge-graph-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" />
                </marker>
              </defs>

              <g
                className="knowledge-graph__viewport"
                transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}
              >
                {positionedGraph.zoneBounds.map((zone) => {
                  if (!zone.bounds) {
                    return null;
                  }

                  return (
                    <g key={zone.id} className={`knowledge-graph-zone knowledge-graph-zone--${zone.tone}`}>
                      <path d={createSmoothZonePath(zone.bounds)} />
                      <text x={zone.bounds.x + 24} y={zone.bounds.y + 34} className="knowledge-graph-zone__label">
                        {zone.label}
                      </text>
                      <text x={zone.bounds.x + 24} y={zone.bounds.y + 51} className="knowledge-graph-zone__description">
                        {zone.description}
                      </text>
                    </g>
                  );
                })}

                <g className="knowledge-graph__edges">
                  {positionedGraph.edges.map((edge) => {
                    const isActive = connectedIds.edgeIds.has(edge.id);
                    const isDimmed = activeItem && !isActive;

                    return (
                      <g key={edge.id}>
                        <path
                          className={[
                            "knowledge-graph-edge",
                            isActive ? "knowledge-graph-edge--active" : "",
                            isDimmed ? "knowledge-graph-edge--dimmed" : "",
                          ].filter(Boolean).join(" ")}
                          d={edge.d}
                          markerEnd="url(#knowledge-graph-arrow)"
                        />
                        <path
                          className="knowledge-graph-edge__hitbox"
                          d={edge.d}
                          onMouseEnter={(event) => showEdgeTooltip(event, edge)}
                          onMouseMove={(event) => showEdgeTooltip(event, edge)}
                          onMouseLeave={hideTooltip}
                        />
                      </g>
                    );
                  })}
                </g>

                <g className="knowledge-graph__nodes">
                  {positionedGraph.nodes.map((node) => {
                    const meta = NODE_META[node.type] ?? NODE_META.evidence;
                    const Icon = meta.icon;
                    const isFocused = focusNodeId === node.id;
                    const isActive = connectedIds.nodeIds.has(node.id);
                    const isDimmed = activeItem && !isActive;
                    const isDragging = draggedNodeId === node.id;

                    return (
                      <g
                        key={node.id}
                        className={[
                          "knowledge-graph-node",
                          `knowledge-graph-node--${node.type}`,
                          isFocused ? "knowledge-graph-node--focused" : "",
                          isActive ? "knowledge-graph-node--active" : "",
                          isDimmed ? "knowledge-graph-node--dimmed" : "",
                          isDragging ? "knowledge-graph-node--dragging" : "",
                        ].filter(Boolean).join(" ")}
                        style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                        tabIndex={0}
                        role="button"
                        aria-label={`${meta.label}: ${node.label}`}
                        onPointerDown={(event) => handleNodePointerDown(event, node)}
                        onMouseEnter={(event) => showNodeTooltip(event, node)}
                        onMouseMove={(event) => showNodeTooltip(event, node)}
                        onMouseLeave={hideTooltip}
                        onFocus={(event) => showNodeTooltip(event, node)}
                        onBlur={hideTooltip}
                      >
                        <circle r="18" />
                        <g className="knowledge-graph-node__icon" transform="translate(-9 -9)">
                          <Icon aria-hidden="true" strokeWidth={1.9} />
                        </g>
                        <text className="knowledge-graph-node__label" y="35">
                          {node.label.length > 20 ? `${node.label.slice(0, 18)}...` : node.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </g>
            </svg>

            <div className="knowledge-graph-controls" aria-label="Управление графом">
              <button type="button" aria-label="Увеличить" onClick={() => handleControlZoom(1.18)}>
                <ZoomIn aria-hidden="true" strokeWidth={2} />
              </button>
              <button type="button" aria-label="Уменьшить" onClick={() => handleControlZoom(0.84)}>
                <ZoomOut aria-hidden="true" strokeWidth={2} />
              </button>
              <button type="button" aria-label="Вернуть вид" onClick={handleResetView}>
                <RotateCcw aria-hidden="true" strokeWidth={2} />
              </button>
            </div>
          </div>

          <aside className="knowledge-graph-inspector">
            <h3>Как читать граф</h3>
            <p>
              Колесо мыши меняет масштаб, пустое поле двигает камеру, а сами узлы можно перетаскивать.
              При наведении видны источник, цитата, факт, гипотеза или причина связи.
            </p>
            <div className="knowledge-graph-inspector__stats">
              <span>{positionedGraph.nodes.length} узлов</span>
              <span>{positionedGraph.edges.length} связей</span>
              <span>{Math.round(camera.scale * 100)}%</span>
            </div>
          </aside>
        </div>

        <GraphTooltip item={activeItem} />
      </section>
    </div>,
    document.body,
  );
}
