import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpenText,
  CircleDot,
  FileText,
  GitBranch,
  Lightbulb,
  Network,
  Scale,
  X,
} from "lucide-react";

import { buildKnowledgeGraph } from "../model/knowledgeGraphModel";
import { clampNumber } from "../utils/format";

const GRAPH_WIDTH = 1080;
const GRAPH_HEIGHT = 640;
const TOOLTIP_WIDTH = 300;
const TOOLTIP_GAP = 12;
const TOOLTIP_EDGE_OFFSET = 16;

const ZONE_LAYOUTS = {
  brief: {
    x: 52,
    y: 72,
    width: 230,
    height: 220,
    polygon: [[0, 18], [34, 0], [100, 8], [100, 84], [88, 100], [12, 94]],
  },
  sources: {
    x: 54,
    y: 352,
    width: 244,
    height: 206,
    polygon: [[4, 12], [72, 0], [100, 18], [94, 92], [58, 100], [0, 86]],
  },
  evidence: {
    x: 370,
    y: 62,
    width: 270,
    height: 504,
    polygon: [[8, 4], [92, 0], [100, 30], [94, 96], [34, 100], [0, 84], [4, 22]],
  },
  hypotheses: {
    x: 732,
    y: 82,
    width: 284,
    height: 250,
    polygon: [[0, 16], [28, 0], [100, 8], [96, 88], [72, 100], [8, 92]],
  },
  decision: {
    x: 720,
    y: 408,
    width: 300,
    height: 170,
    polygon: [[6, 10], [50, 0], [98, 14], [100, 82], [78, 100], [0, 92]],
  },
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

function createZonePath(layout) {
  return layout.polygon
    .map(([xPercent, yPercent], index) => {
      const x = layout.x + (layout.width * xPercent) / 100;
      const y = layout.y + (layout.height * yPercent) / 100;

      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ")
    .concat(" Z");
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

function getTooltipStyle(event) {
  const top = clampNumber(
    event.clientY + TOOLTIP_GAP,
    TOOLTIP_EDGE_OFFSET,
    window.innerHeight - TOOLTIP_EDGE_OFFSET - 180,
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

  return createPortal(
    <aside className="knowledge-graph-tooltip" style={item.style} role="tooltip">
      <span className="knowledge-graph-tooltip__type">{nodeType}</span>
      <strong>{item.item.label}</strong>
      {item.item.summary ? <p>{item.item.summary}</p> : null}
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
  const [activeItem, setActiveItem] = useState(null);
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
      const position = getNodePosition(ZONE_LAYOUTS[zoneId], index, zoneNodes.length);

      return {
        ...node,
        zone: zoneId,
        x: position.x,
        y: position.y,
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

    return {
      ...graph,
      nodes,
      edges,
      nodeById,
    };
  }, [graph]);
  const connectedIds = useMemo(
    () => getConnectedIds(positionedGraph, activeItem),
    [activeItem, positionedGraph],
  );

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
    setActiveItem({
      kind: "node",
      item: node,
      style: getTooltipStyle(event),
    });
  }, []);

  const showEdgeTooltip = useCallback((event, edge) => {
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
          <svg
            className="knowledge-graph"
            viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
            role="img"
            aria-label="Граф доказательств и гипотез"
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

            {graph.zones.map((zone) => {
              const layout = ZONE_LAYOUTS[zone.id];

              if (!layout) {
                return null;
              }

              return (
                <g key={zone.id} className={`knowledge-graph-zone knowledge-graph-zone--${zone.tone}`}>
                  <path d={createZonePath(layout)} />
                  <text x={layout.x + 18} y={layout.y + 28} className="knowledge-graph-zone__label">
                    {zone.label}
                  </text>
                  <text x={layout.x + 18} y={layout.y + 45} className="knowledge-graph-zone__description">
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
                const isFocused = focusNodeId === node.id;
                const isActive = connectedIds.nodeIds.has(node.id);
                const isDimmed = activeItem && !isActive;

                return (
                  <g
                    key={node.id}
                    className={[
                      "knowledge-graph-node",
                      `knowledge-graph-node--${node.type}`,
                      isFocused ? "knowledge-graph-node--focused" : "",
                      isActive ? "knowledge-graph-node--active" : "",
                      isDimmed ? "knowledge-graph-node--dimmed" : "",
                    ].filter(Boolean).join(" ")}
                    transform={`translate(${node.x} ${node.y})`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${meta.label}: ${node.label}`}
                    onMouseEnter={(event) => showNodeTooltip(event, node)}
                    onMouseMove={(event) => showNodeTooltip(event, node)}
                    onMouseLeave={hideTooltip}
                    onFocus={(event) => showNodeTooltip(event, node)}
                    onBlur={hideTooltip}
                  >
                    <circle r="18" />
                    <text className="knowledge-graph-node__glyph" y="5">
                      {meta.label.slice(0, 1)}
                    </text>
                    <text className="knowledge-graph-node__label" y="35">
                      {node.label.length > 20 ? `${node.label.slice(0, 18)}…` : node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          <aside className="knowledge-graph-inspector">
            <div className="knowledge-graph-inspector__icon">
              <Network aria-hidden="true" strokeWidth={1.8} />
            </div>
            <h3>Как читать граф</h3>
            <p>
              Наведи на узел или связь: сверху появятся детали источника, факта,
              гипотезы или причины связи. Клик по ссылке из истории агентов
              открывает этот же граф с фокусом на источнике.
            </p>
            <div className="knowledge-graph-inspector__stats">
              <span>{positionedGraph.nodes.length} узлов</span>
              <span>{positionedGraph.edges.length} связей</span>
            </div>
          </aside>
        </div>

        <GraphTooltip item={activeItem} />
      </section>
    </div>,
    document.body,
  );
}
