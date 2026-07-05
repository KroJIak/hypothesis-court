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
const NODE_CLICK_DRAG_THRESHOLD = 5;
const NODE_RADIUS = 12;
const NODE_ICON_SIZE = 13;
const SAME_ZONE_NODE_DISTANCE = 58;
const CROSS_ZONE_NODE_DISTANCE = 82;
const NODE_REPEL_STEP = 22;
const NODE_DRAG_LIMIT = 520;
const GRAPH_LAYOUT_RELAXATION_STEPS = 5;
const DRAG_RELAXATION_STEPS = 3;
const ZONE_NODE_PADDING = 38;
const ZONE_AVOID_RADIUS = 112;
const ZONE_AVOID_STEP = 78;
const ZONE_MIN_WIDTH = 142;
const ZONE_MIN_HEIGHT = 96;
const ZONE_GAP = 28;
const ZONE_COHESION_RADIUS = 138;
const ZONE_COHESION_FOLLOW = 0.38;
const ZONE_COHESION_PULLBACK = 0.58;
const ZONE_HULL_NODE_RADIUS = 36;
const ZONE_CLUSTER_RADIUS = 70;
const ZONE_CLUSTER_PULL = 0.18;
const ZONE_BOUNDS_PUSH = 18;

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
const ZONE_SEQUENCE = ["brief", "sources", "evidence", "hypotheses", "decision"];

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

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
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

function getConvexHull(points) {
  if (points.length <= 1) {
    return points;
  }

  const sortedPoints = [...points].sort((firstPoint, secondPoint) =>
    firstPoint.x === secondPoint.x
      ? firstPoint.y - secondPoint.y
      : firstPoint.x - secondPoint.x,
  );

  function cross(origin, firstPoint, secondPoint) {
    return (
      (firstPoint.x - origin.x) * (secondPoint.y - origin.y)
      - (firstPoint.y - origin.y) * (secondPoint.x - origin.x)
    );
  }

  const lowerHull = [];
  const upperHull = [];

  sortedPoints.forEach((point) => {
    while (
      lowerHull.length >= 2
      && cross(lowerHull[lowerHull.length - 2], lowerHull[lowerHull.length - 1], point) <= 0
    ) {
      lowerHull.pop();
    }

    lowerHull.push(point);
  });

  [...sortedPoints].reverse().forEach((point) => {
    while (
      upperHull.length >= 2
      && cross(upperHull[upperHull.length - 2], upperHull[upperHull.length - 1], point) <= 0
    ) {
      upperHull.pop();
    }

    upperHull.push(point);
  });

  return lowerHull.slice(0, -1).concat(upperHull.slice(0, -1));
}

function createSmoothHullPath(points) {
  if (points.length === 0) {
    return "";
  }

  if (points.length < 3) {
    const [firstPoint, secondPoint = firstPoint] = points;
    const centerX = (firstPoint.x + secondPoint.x) / 2;
    const centerY = (firstPoint.y + secondPoint.y) / 2;
    const radius = Math.max(
      ZONE_MIN_HEIGHT / 2,
      Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y) / 2 + ZONE_HULL_NODE_RADIUS,
    );

    return [
      `M ${centerX} ${centerY - radius}`,
      `C ${centerX + radius} ${centerY - radius}, ${centerX + radius} ${centerY + radius}, ${centerX} ${centerY + radius}`,
      `C ${centerX - radius} ${centerY + radius}, ${centerX - radius} ${centerY - radius}, ${centerX} ${centerY - radius}`,
      "Z",
    ].join(" ");
  }

  return points.map((point, index) => {
    const previousPoint = points[(index - 1 + points.length) % points.length];
    const nextPoint = points[(index + 1) % points.length];
    const startX = point.x + (previousPoint.x - point.x) * 0.24;
    const startY = point.y + (previousPoint.y - point.y) * 0.24;
    const endX = point.x + (nextPoint.x - point.x) * 0.24;
    const endY = point.y + (nextPoint.y - point.y) * 0.24;

    return index === 0
      ? `M ${startX} ${startY} Q ${point.x} ${point.y} ${endX} ${endY}`
      : `L ${startX} ${startY} Q ${point.x} ${point.y} ${endX} ${endY}`;
  }).join(" ").concat(" Z");
}

function createZoneHullPath(zoneNodes, fallbackBounds) {
  if (zoneNodes.length === 0) {
    return createSmoothZonePath(fallbackBounds);
  }

  const samplePoints = zoneNodes.flatMap((node) =>
    Array.from({ length: 8 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 8;

      return {
        x: node.x + Math.cos(angle) * ZONE_HULL_NODE_RADIUS,
        y: node.y + Math.sin(angle) * ZONE_HULL_NODE_RADIUS,
      };
    }),
  );

  return createSmoothHullPath(getConvexHull(samplePoints));
}

function expandBounds(bounds, amount) {
  return {
    x: bounds.x - amount,
    y: bounds.y - amount,
    width: bounds.width + amount * 2,
    height: bounds.height + amount * 2,
  };
}

function getBoundsCenter(bounds) {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function getDistanceToBounds(point, bounds) {
  const nearestX = clampNumber(point.x, bounds.x, bounds.x + bounds.width);
  const nearestY = clampNumber(point.y, bounds.y, bounds.y + bounds.height);

  return Math.hypot(point.x - nearestX, point.y - nearestY);
}

function doBoundsOverlap(firstBounds, secondBounds, gap = 0) {
  return !(
    firstBounds.x + firstBounds.width + gap < secondBounds.x
    || secondBounds.x + secondBounds.width + gap < firstBounds.x
    || firstBounds.y + firstBounds.height + gap < secondBounds.y
    || secondBounds.y + secondBounds.height + gap < firstBounds.y
  );
}

function addOffsetToBounds(bounds, offset) {
  return {
    ...bounds,
    x: bounds.x + offset.x,
    y: bounds.y + offset.y,
  };
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

function getExplicitNodePosition(node) {
  const position = node.position ?? node.layout;
  const x = isFiniteNumber(node.x) ? node.x : position?.x;
  const y = isFiniteNumber(node.y) ? node.y : position?.y;

  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    return null;
  }

  return { x, y };
}

function getNodeLayoutOrder(node) {
  const order = node.layoutOrder ?? node.order ?? node.layout?.order;

  return isFiniteNumber(order) ? order : null;
}

function getOrderedZoneNodes(graph, nodesByZone, originalOrderById) {
  const orderedNodesByZone = new Map();

  nodesByZone.forEach((zoneNodes, zoneId) => {
    orderedNodesByZone.set(zoneId, [...zoneNodes].sort(
      (firstNode, secondNode) => (originalOrderById.get(firstNode.id) ?? 0) - (originalOrderById.get(secondNode.id) ?? 0),
    ));
  });

  const adjacentIdsByNodeId = new Map();

  graph.edges.forEach((edge) => {
    const fromAdjacent = adjacentIdsByNodeId.get(edge.from) ?? [];
    const toAdjacent = adjacentIdsByNodeId.get(edge.to) ?? [];

    fromAdjacent.push(edge.to);
    toAdjacent.push(edge.from);
    adjacentIdsByNodeId.set(edge.from, fromAdjacent);
    adjacentIdsByNodeId.set(edge.to, toAdjacent);
  });

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const zoneOrder = iteration % 2 === 0 ? ZONE_SEQUENCE : [...ZONE_SEQUENCE].reverse();
    const rankByNodeId = new Map();

    orderedNodesByZone.forEach((zoneNodes) => {
      zoneNodes.forEach((node, index) => {
        rankByNodeId.set(node.id, index);
      });
    });

    zoneOrder.forEach((zoneId) => {
      const zoneNodes = orderedNodesByZone.get(zoneId);

      if (!zoneNodes) {
        return;
      }

      zoneNodes.sort((firstNode, secondNode) => {
        const firstExplicitOrder = getNodeLayoutOrder(firstNode);
        const secondExplicitOrder = getNodeLayoutOrder(secondNode);

        if (firstExplicitOrder !== null || secondExplicitOrder !== null) {
          return (firstExplicitOrder ?? originalOrderById.get(firstNode.id) ?? 0)
            - (secondExplicitOrder ?? originalOrderById.get(secondNode.id) ?? 0);
        }

        const getBarycenter = (node) => {
          const adjacentRanks = (adjacentIdsByNodeId.get(node.id) ?? [])
            .map((id) => rankByNodeId.get(id))
            .filter(isFiniteNumber);

          if (adjacentRanks.length === 0) {
            return originalOrderById.get(node.id) ?? 0;
          }

          return adjacentRanks.reduce((sum, rank) => sum + rank, 0) / adjacentRanks.length;
        };

        const firstScore = getBarycenter(firstNode);
        const secondScore = getBarycenter(secondNode);

        return firstScore === secondScore
          ? (originalOrderById.get(firstNode.id) ?? 0) - (originalOrderById.get(secondNode.id) ?? 0)
          : firstScore - secondScore;
      });
    });
  }

  return orderedNodesByZone;
}

function getMinimumNodeDistance(firstNode, secondNode) {
  return firstNode.zone === secondNode.zone ? SAME_ZONE_NODE_DISTANCE : CROSS_ZONE_NODE_DISTANCE;
}

function getPositionFromMap(node, positions) {
  return positions.get(node.id) ?? { x: node.x, y: node.y };
}

function setPositionInMap(positions, nodeId, position) {
  positions.set(nodeId, {
    x: clampGraphCoordinate(position.x, GRAPH_WIDTH),
    y: clampGraphCoordinate(position.y, GRAPH_HEIGHT),
  });
}

function getZoneCentroid(nodes, positions, zoneId) {
  const zoneNodes = nodes.filter((node) => node.zone === zoneId);

  if (zoneNodes.length === 0) {
    return null;
  }

  const total = zoneNodes.reduce(
    (accumulator, node) => {
      const position = getPositionFromMap(node, positions);

      return {
        x: accumulator.x + position.x,
        y: accumulator.y + position.y,
      };
    },
    { x: 0, y: 0 },
  );

  return {
    x: total.x / zoneNodes.length,
    y: total.y / zoneNodes.length,
  };
}

function pullZoneIntoCompactCluster(nodes, positions, zoneId, lockedNodeIds = new Set()) {
  const centroid = getZoneCentroid(nodes, positions, zoneId);

  if (!centroid) {
    return;
  }

  nodes.forEach((node) => {
    if (node.zone !== zoneId || lockedNodeIds.has(node.id)) {
      return;
    }

    const position = getPositionFromMap(node, positions);
    const dx = position.x - centroid.x;
    const dy = position.y - centroid.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= ZONE_CLUSTER_RADIUS) {
      return;
    }

    const excess = distance - ZONE_CLUSTER_RADIUS;
    setPositionInMap(positions, node.id, {
      x: position.x - (dx / distance) * excess * ZONE_CLUSTER_PULL,
      y: position.y - (dy / distance) * excess * ZONE_CLUSTER_PULL,
    });
  });
}

function clampPositionToLayout(position, layout) {
  const padding = NODE_RADIUS + 12;

  return {
    x: clampNumber(position.x, layout.x + padding, layout.x + layout.width - padding),
    y: clampNumber(position.y, layout.y + padding, layout.y + layout.height - padding),
  };
}

function relaxGraphPositions(nodes, edges, initialPositions, options = {}) {
  const {
    lockedNodeIds = new Set(),
    shouldClampToZone = false,
    steps = GRAPH_LAYOUT_RELAXATION_STEPS,
  } = options;
  const positions = new Map(nodes.map((node) => [node.id, initialPositions.get(node.id) ?? { x: node.x, y: node.y }]));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  for (let step = 0; step < steps; step += 1) {
    edges.forEach((edge) => {
      const fromNode = nodeById.get(edge.from);
      const toNode = nodeById.get(edge.to);

      if (!fromNode || !toNode || fromNode.zone === toNode.zone) {
        return;
      }

      const fromPosition = getPositionFromMap(fromNode, positions);
      const toPosition = getPositionFromMap(toNode, positions);
      const averageY = (fromPosition.y + toPosition.y) / 2;
      const pull = 0.05;

      if (!lockedNodeIds.has(fromNode.id)) {
        setPositionInMap(positions, fromNode.id, {
          x: fromPosition.x,
          y: fromPosition.y + (averageY - fromPosition.y) * pull,
        });
      }

      if (!lockedNodeIds.has(toNode.id)) {
        setPositionInMap(positions, toNode.id, {
          x: toPosition.x,
          y: toPosition.y + (averageY - toPosition.y) * pull,
        });
      }
    });

    for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
        const firstNode = nodes[firstIndex];
        const secondNode = nodes[secondIndex];
        const firstPosition = getPositionFromMap(firstNode, positions);
        const secondPosition = getPositionFromMap(secondNode, positions);
        const dx = secondPosition.x - firstPosition.x;
        const dy = secondPosition.y - firstPosition.y;
        const distance = Math.hypot(dx, dy);
        const minimumDistance = getMinimumNodeDistance(firstNode, secondNode);

        if (distance >= minimumDistance) {
          continue;
        }

        const fallbackAngle = getStableAngle(`${firstNode.id}-${secondNode.id}`);
        const directionX = distance > 0.01 ? dx / distance : Math.cos(fallbackAngle);
        const directionY = distance > 0.01 ? dy / distance : Math.sin(fallbackAngle);
        const push = (minimumDistance - distance) / 2;
        const firstLocked = lockedNodeIds.has(firstNode.id);
        const secondLocked = lockedNodeIds.has(secondNode.id);

        if (!firstLocked) {
          setPositionInMap(positions, firstNode.id, {
            x: firstPosition.x - directionX * (secondLocked ? push * 2 : push),
            y: firstPosition.y - directionY * (secondLocked ? push * 2 : push),
          });
        }

        if (!secondLocked) {
          setPositionInMap(positions, secondNode.id, {
            x: secondPosition.x + directionX * (firstLocked ? push * 2 : push),
            y: secondPosition.y + directionY * (firstLocked ? push * 2 : push),
          });
        }
      }
    }

    ZONE_SEQUENCE.forEach((zoneId) => {
      pullZoneIntoCompactCluster(nodes, positions, zoneId, lockedNodeIds);
    });

    if (shouldClampToZone) {
      nodes.forEach((node) => {
        if (lockedNodeIds.has(node.id)) {
          return;
        }

        const layout = ZONE_LAYOUTS[node.zone];

        if (!layout) {
          return;
        }

        setPositionInMap(positions, node.id, clampPositionToLayout(getPositionFromMap(node, positions), layout));
      });
    }
  }

  return positions;
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

function moveZoneNodes(nodes, positions, zoneId, delta, lockedNodeIds = new Set()) {
  nodes.forEach((node) => {
    if (node.zone !== zoneId || lockedNodeIds.has(node.id)) {
      return;
    }

    const position = getPositionFromMap(node, positions);

    setPositionInMap(positions, node.id, {
      x: position.x + delta.x,
      y: position.y + delta.y,
    });
  });
}

function getNodesWithPositions(nodes, positions) {
  return nodes.map((node) => ({
    ...node,
    ...getPositionFromMap(node, positions),
  }));
}

function applyZoneBoundsRepulsion(nodes, positions, lockedNodeIds = new Set()) {
  const positionedNodes = getNodesWithPositions(nodes, positions);
  const zoneBounds = ZONE_SEQUENCE
    .map((zoneId) => ({
      id: zoneId,
      bounds: ZONE_LAYOUTS[zoneId] ? createZoneBounds(zoneId, positionedNodes) : null,
    }))
    .filter((zone) => zone.bounds);

  for (let firstIndex = 0; firstIndex < zoneBounds.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < zoneBounds.length; secondIndex += 1) {
      const firstZone = zoneBounds[firstIndex];
      const secondZone = zoneBounds[secondIndex];

      if (!doBoundsOverlap(firstZone.bounds, secondZone.bounds, ZONE_GAP)) {
        continue;
      }

      const firstCenter = getBoundsCenter(firstZone.bounds);
      const secondCenter = getBoundsCenter(secondZone.bounds);
      const dx = secondCenter.x - firstCenter.x;
      const dy = secondCenter.y - firstCenter.y;
      const distance = Math.hypot(dx, dy) || 1;
      const push = ZONE_BOUNDS_PUSH;
      const firstDelta = {
        x: -(dx / distance) * push,
        y: -(dy / distance) * push,
      };
      const secondDelta = {
        x: (dx / distance) * push,
        y: (dy / distance) * push,
      };

      moveZoneNodes(nodes, positions, firstZone.id, firstDelta, lockedNodeIds);
      moveZoneNodes(nodes, positions, secondZone.id, secondDelta, lockedNodeIds);
    }
  }
}

function applyZoneCohesion(nodes, draggedNodeId, draggedPosition, currentPositions) {
  const draggedNode = nodes.find((node) => node.id === draggedNodeId);
  const positions = new Map(nodes.map((node) => [
    node.id,
    currentPositions[node.id] ?? { x: node.x, y: node.y },
  ]));

  positions.set(draggedNodeId, draggedPosition);

  if (!draggedNode) {
    return positions;
  }

  const sameZoneNodes = nodes.filter((node) => node.zone === draggedNode.zone && node.id !== draggedNodeId);

  if (sameZoneNodes.length === 0) {
    return positions;
  }

  const centroid = sameZoneNodes.reduce(
    (accumulator, node) => {
      const position = getPositionFromMap(node, positions);

      return {
        x: accumulator.x + position.x,
        y: accumulator.y + position.y,
      };
    },
    { x: 0, y: 0 },
  );
  centroid.x /= sameZoneNodes.length;
  centroid.y /= sameZoneNodes.length;

  const dx = draggedPosition.x - centroid.x;
  const dy = draggedPosition.y - centroid.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= ZONE_COHESION_RADIUS) {
    return nextPositions;
  }

  const directionX = dx / distance;
  const directionY = dy / distance;
  const excess = distance - ZONE_COHESION_RADIUS;
  const pullback = excess * ZONE_COHESION_PULLBACK;
  const follow = excess * ZONE_COHESION_FOLLOW;

  setPositionInMap(positions, draggedNodeId, {
    x: clampGraphCoordinate(draggedPosition.x - directionX * pullback, GRAPH_WIDTH),
    y: clampGraphCoordinate(draggedPosition.y - directionY * pullback, GRAPH_HEIGHT),
  });

  sameZoneNodes.forEach((node) => {
    const currentPosition = getPositionFromMap(node, positions);

    setPositionInMap(positions, node.id, {
      x: clampGraphCoordinate(currentPosition.x + directionX * follow, GRAPH_WIDTH),
      y: clampGraphCoordinate(currentPosition.y + directionY * follow, GRAPH_HEIGHT),
    });
  });

  return positions;
}

function repelNearbyNodes(nodes, draggedNodeId, draggedPosition, currentPositions) {
  const positions = applyZoneCohesion(nodes, draggedNodeId, draggedPosition, currentPositions);
  const draggedNode = nodes.find((node) => node.id === draggedNodeId);
  const lockedNodeIds = new Set([draggedNodeId]);

  for (let step = 0; step < DRAG_RELAXATION_STEPS; step += 1) {
    if (draggedNode) {
      pullZoneIntoCompactCluster(nodes, positions, draggedNode.zone, lockedNodeIds);
    }

    for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
        const firstNode = nodes[firstIndex];
        const secondNode = nodes[secondIndex];
        const firstPosition = getPositionFromMap(firstNode, positions);
        const secondPosition = getPositionFromMap(secondNode, positions);
        const dx = secondPosition.x - firstPosition.x;
        const dy = secondPosition.y - firstPosition.y;
        const distance = Math.hypot(dx, dy);
        const minimumDistance = getMinimumNodeDistance(firstNode, secondNode);

        if (distance >= minimumDistance) {
          continue;
        }

        const fallbackAngle = getStableAngle(`${firstNode.id}-${secondNode.id}`);
        const directionX = distance > 0.01 ? dx / distance : Math.cos(fallbackAngle);
        const directionY = distance > 0.01 ? dy / distance : Math.sin(fallbackAngle);
        const push = Math.min(NODE_REPEL_STEP, (minimumDistance - distance) / 2);
        const firstLocked = lockedNodeIds.has(firstNode.id);
        const secondLocked = lockedNodeIds.has(secondNode.id);

        if (!firstLocked) {
          setPositionInMap(positions, firstNode.id, {
            x: firstPosition.x - directionX * (secondLocked ? push * 2 : push),
            y: firstPosition.y - directionY * (secondLocked ? push * 2 : push),
          });
        }

        if (!secondLocked) {
          setPositionInMap(positions, secondNode.id, {
            x: secondPosition.x + directionX * (firstLocked ? push * 2 : push),
            y: secondPosition.y + directionY * (firstLocked ? push * 2 : push),
          });
        }
      }
    }

    applyZoneBoundsRepulsion(nodes, positions, lockedNodeIds);
  }

  return Object.fromEntries(positions);
}

function createZoneBounds(zoneId, nodes) {
  const layout = ZONE_LAYOUTS[zoneId];
  const zoneNodes = nodes.filter((node) => node.zone === zoneId);

  if (zoneNodes.length === 0) {
    return {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
    };
  }

  const nodeXs = zoneNodes.map((node) => node.x);
  const nodeYs = zoneNodes.map((node) => node.y);
  const rawMinX = Math.min(...nodeXs) - ZONE_NODE_PADDING;
  const rawMinY = Math.min(...nodeYs) - ZONE_NODE_PADDING;
  const rawMaxX = Math.max(...nodeXs) + ZONE_NODE_PADDING;
  const rawMaxY = Math.max(...nodeYs) + ZONE_NODE_PADDING;
  const rawWidth = rawMaxX - rawMinX;
  const rawHeight = rawMaxY - rawMinY;
  const width = Math.max(rawWidth, ZONE_MIN_WIDTH);
  const height = Math.max(rawHeight, ZONE_MIN_HEIGHT);
  const centerX = (rawMinX + rawMaxX) / 2;
  const centerY = (rawMinY + rawMaxY) / 2;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

function getZoneAvoidanceOffsets(zoneBounds, draggedNode) {
  const offsets = new Map();

  if (!draggedNode) {
    return offsets;
  }

  zoneBounds.forEach((zone) => {
    if (!zone.bounds || zone.id === draggedNode.zone) {
      return;
    }

    const expandedBounds = expandBounds(zone.bounds, ZONE_AVOID_RADIUS);
    const distance = getDistanceToBounds(draggedNode, expandedBounds);

    if (distance > ZONE_AVOID_RADIUS) {
      return;
    }

    const center = getBoundsCenter(zone.bounds);
    const dx = center.x - draggedNode.x;
    const dy = center.y - draggedNode.y;
    const length = Math.hypot(dx, dy) || 1;
    const strength = 1 - distance / ZONE_AVOID_RADIUS;

    offsets.set(zone.id, {
      x: (dx / length) * ZONE_AVOID_STEP * strength,
      y: (dy / length) * ZONE_AVOID_STEP * strength,
    });
  });

  return offsets;
}

function resolveZoneOverlaps(zoneBounds, initialOffsets) {
  const offsets = new Map(initialOffsets);

  zoneBounds.forEach((zone) => {
    if (!offsets.has(zone.id)) {
      offsets.set(zone.id, { x: 0, y: 0 });
    }
  });

  for (let iteration = 0; iteration < 4; iteration += 1) {
    for (let firstIndex = 0; firstIndex < zoneBounds.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < zoneBounds.length; secondIndex += 1) {
        const firstZone = zoneBounds[firstIndex];
        const secondZone = zoneBounds[secondIndex];

        if (!firstZone.bounds || !secondZone.bounds) {
          continue;
        }

        const firstOffset = offsets.get(firstZone.id) ?? { x: 0, y: 0 };
        const secondOffset = offsets.get(secondZone.id) ?? { x: 0, y: 0 };
        const firstBounds = addOffsetToBounds(firstZone.bounds, firstOffset);
        const secondBounds = addOffsetToBounds(secondZone.bounds, secondOffset);

        if (!doBoundsOverlap(firstBounds, secondBounds, ZONE_GAP)) {
          continue;
        }

        const firstCenter = getBoundsCenter(firstBounds);
        const secondCenter = getBoundsCenter(secondBounds);
        const dx = firstCenter.x - secondCenter.x;
        const dy = firstCenter.y - secondCenter.y;
        const length = Math.hypot(dx, dy) || 1;
        const overlapX = Math.min(
          firstBounds.x + firstBounds.width - secondBounds.x,
          secondBounds.x + secondBounds.width - firstBounds.x,
        );
        const overlapY = Math.min(
          firstBounds.y + firstBounds.height - secondBounds.y,
          secondBounds.y + secondBounds.height - firstBounds.y,
        );
        const push = Math.max(14, Math.min(36, Math.min(overlapX, overlapY) / 2 + ZONE_GAP / 2));

        offsets.set(firstZone.id, {
          x: firstOffset.x + (dx / length) * push,
          y: firstOffset.y + (dy / length) * push,
        });
        offsets.set(secondZone.id, {
          x: secondOffset.x - (dx / length) * push,
          y: secondOffset.y - (dy / length) * push,
        });
      }
    }
  }

  return offsets;
}

function SourceQuote({ source, className = "knowledge-graph-source-quote" }) {
  if (!source?.quote) {
    return source?.excerpt ? <p>{source.excerpt}</p> : null;
  }

  return (
    <p className={className}>
      {source.contextBefore ? <span>{source.contextBefore} </span> : null}
      <span className={`${className}__mark`}>{source.quote}</span>
      {source.contextAfter ? <span> {source.contextAfter}</span> : null}
    </p>
  );
}

function ItemDetailsPanel({ item, nodesCount, edgesCount, scale }) {
  if (!item) {
    return (
      <>
        <h3>Как читать граф</h3>
        <p>
          Колесо мыши меняет масштаб, пустое поле двигает камеру, а узлы можно переносить внутри своей смысловой зоны.
          Нажмите на любой кружок или связь, чтобы открыть источник, цитату и подробности здесь, справа.
        </p>
        <div className="knowledge-graph-inspector__stats">
          <span>{nodesCount} узлов</span>
          <span>{edgesCount} связей</span>
          <span>{Math.round(scale * 100)}%</span>
        </div>
      </>
    );
  }

  const itemType = item.kind === "node" ? NODE_META[item.item.type]?.label : "Связь";
  const details = Array.isArray(item.item.details)
    ? item.item.details
    : item.item.details
      ? [item.item.details]
      : [];
  const source = item.item.source;

  return (
    <>
      <span className="knowledge-graph-inspector__type">{itemType}</span>
      <h3>{item.item.label}</h3>
      {item.item.summary ? <p>{item.item.summary}</p> : null}
      {source ? (
        <section className="knowledge-graph-inspector__source" aria-label="Фрагмент источника">
          <span>Источник</span>
          <strong>{source.title ?? item.item.label}</strong>
          <SourceQuote source={source} />
        </section>
      ) : null}
      {details.length > 0 ? (
        <ul className="knowledge-graph-inspector__details">
          {details.slice(0, 5).map((detail, index) => (
            <li key={`${item.item.id}-inspector-detail-${index}`}>{detail}</li>
          ))}
        </ul>
      ) : null}
      {item.kind === "edge" ? (
        <p className="knowledge-graph-inspector__hint">Эта связь показывает, почему один узел влияет на другой.</p>
      ) : null}
    </>
  );
}

function GraphTooltip({ item }) {
  if (!item) {
    return null;
  }

  const nodeType = item.kind === "node" ? NODE_META[item.item.type]?.label : "Связь";

  return createPortal(
    <aside className="knowledge-graph-tooltip" style={item.style} role="tooltip">
      <span className="knowledge-graph-tooltip__type">{nodeType}</span>
      <strong>{item.item.label}</strong>
      {item.item.summary ? <p>{item.item.summary}</p> : null}
      <span className="knowledge-graph-tooltip__hint">Нажмите, чтобы открыть подробности справа</span>
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
  const cameraRef = useRef(INITIAL_CAMERA);
  const cameraFrameRef = useRef(null);
  const pendingCameraRef = useRef(null);
  const nodePositionsFrameRef = useRef(null);
  const pendingNodePositionsRef = useRef(null);
  const suppressNextNodeClickRef = useRef(null);
  const [activeItem, setActiveItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [camera, setCamera] = useState(INITIAL_CAMERA);
  const [nodePositions, setNodePositions] = useState({});
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [isCameraDragging, setIsCameraDragging] = useState(false);
  const graph = useMemo(() => buildKnowledgeGraph(session), [session]);
  const positionedGraph = useMemo(() => {
    const nodesByZone = new Map();
    const originalOrderById = new Map();

    graph.nodes.forEach((node, index) => {
      originalOrderById.set(node.id, index);
    });

    graph.nodes.forEach((node) => {
      const zoneId = ZONE_LAYOUTS[node.zone] ? node.zone : "evidence";
      const zoneNodes = nodesByZone.get(zoneId) ?? [];
      zoneNodes.push(node);
      nodesByZone.set(zoneId, zoneNodes);
    });

    const orderedNodesByZone = getOrderedZoneNodes(graph, nodesByZone, originalOrderById);
    const explicitPositionNodeIds = new Set();
    const baseNodes = graph.nodes.map((node) => {
      const zoneId = ZONE_LAYOUTS[node.zone] ? node.zone : "evidence";
      const zoneNodes = orderedNodesByZone.get(zoneId) ?? [];
      const index = Math.max(0, zoneNodes.findIndex((zoneNode) => zoneNode.id === node.id));
      const explicitPosition = getExplicitNodePosition(node);
      const basePosition = explicitPosition ?? getNodePosition(ZONE_LAYOUTS[zoneId], index, zoneNodes.length);

      if (explicitPosition) {
        explicitPositionNodeIds.add(node.id);
      }

      return {
        ...node,
        zone: zoneId,
        x: basePosition.x,
        y: basePosition.y,
      };
    });
    const basePositionByNodeId = relaxGraphPositions(
      baseNodes,
      graph.edges,
      new Map(baseNodes.map((node) => [node.id, { x: node.x, y: node.y }])),
      {
        lockedNodeIds: explicitPositionNodeIds,
        shouldClampToZone: true,
        steps: GRAPH_LAYOUT_RELAXATION_STEPS,
      },
    );
    const nodes = baseNodes.map((node) => {
      const basePosition = basePositionByNodeId.get(node.id) ?? { x: node.x, y: node.y };
      const savedPosition = nodePositions[node.id];

      return {
        ...node,
        x: savedPosition?.x ?? basePosition.x,
        y: savedPosition?.y ?? basePosition.y,
      };
    });
    const initialZoneBounds = graph.zones.map((zone) => ({
      ...zone,
      bounds: ZONE_LAYOUTS[zone.id] ? createZoneBounds(zone.id, nodes) : null,
    }));
    const draggedNode = draggedNodeId ? nodes.find((node) => node.id === draggedNodeId) : null;
    const zoneOffsets = resolveZoneOverlaps(
      initialZoneBounds,
      getZoneAvoidanceOffsets(initialZoneBounds, draggedNode),
    );
    const visualNodes = nodes.map((node) => {
      if (node.id === draggedNodeId) {
        return node;
      }

      const offset = zoneOffsets.get(node.zone) ?? { x: 0, y: 0 };

      return {
        ...node,
        x: node.x + offset.x,
        y: node.y + offset.y,
      };
    });
    const nodeById = new Map(visualNodes.map((node) => [node.id, node]));
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
    const zoneBounds = initialZoneBounds.map((zone) => ({
      ...zone,
      bounds: zone.bounds
        ? addOffsetToBounds(zone.bounds, zoneOffsets.get(zone.id) ?? { x: 0, y: 0 })
        : null,
      path: zone.bounds
        ? createZoneHullPath(
            visualNodes.filter((node) => node.zone === zone.id),
            addOffsetToBounds(zone.bounds, zoneOffsets.get(zone.id) ?? { x: 0, y: 0 }),
          )
        : null,
    }));

    return {
      ...graph,
      nodes: visualNodes,
      actualNodes: nodes,
      edges,
      nodeById,
      zoneBounds,
    };
  }, [draggedNodeId, graph, nodePositions]);
  const visibleDetailsItem = selectedItem;
  const connectedIds = useMemo(
    () => getConnectedIds(positionedGraph, visibleDetailsItem),
    [positionedGraph, visibleDetailsItem],
  );

  useEffect(() => {
    cameraRef.current = INITIAL_CAMERA;
    setCamera(INITIAL_CAMERA);
    setNodePositions({});
    setDraggedNodeId(null);
    setActiveItem(null);
    setSelectedItem(null);
    suppressNextNodeClickRef.current = null;
  }, [session.id]);

  useEffect(() => {
    if (!focusNodeId) {
      return;
    }

    const focusedNode = positionedGraph.nodes.find((node) => node.id === focusNodeId);

    if (focusedNode) {
      setSelectedItem({ kind: "node", item: focusedNode });
    }
  }, [focusNodeId, positionedGraph.nodes]);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => () => {
    if (cameraFrameRef.current) {
      window.cancelAnimationFrame(cameraFrameRef.current);
    }

    if (nodePositionsFrameRef.current) {
      window.cancelAnimationFrame(nodePositionsFrameRef.current);
    }
  }, []);

  const scheduleCameraUpdate = useCallback((nextCamera) => {
    pendingCameraRef.current = nextCamera;

    if (cameraFrameRef.current) {
      return;
    }

    cameraFrameRef.current = window.requestAnimationFrame(() => {
      cameraFrameRef.current = null;
      const pendingCamera = pendingCameraRef.current;
      pendingCameraRef.current = null;

      if (!pendingCamera) {
        return;
      }

      cameraRef.current = pendingCamera;
      setCamera(pendingCamera);
    });
  }, []);

  const scheduleNodePositionsUpdate = useCallback((nextPositions) => {
    pendingNodePositionsRef.current = nextPositions;

    if (nodePositionsFrameRef.current) {
      return;
    }

    nodePositionsFrameRef.current = window.requestAnimationFrame(() => {
      nodePositionsFrameRef.current = null;
      const pendingPositions = pendingNodePositionsRef.current;
      pendingNodePositionsRef.current = null;

      if (pendingPositions) {
        setNodePositions(pendingPositions);
      }
    });
  }, []);

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

  const selectGraphItem = useCallback((item) => {
    setSelectedItem(item);
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

    const currentCamera = cameraRef.current;
    const scale = clampNumber(nextScale, MIN_CAMERA_SCALE, MAX_CAMERA_SCALE);
    const worldX = (svgPoint.x - currentCamera.x) / currentCamera.scale;
    const worldY = (svgPoint.y - currentCamera.y) / currentCamera.scale;

    scheduleCameraUpdate({
      scale,
      x: svgPoint.x - worldX * scale,
      y: svgPoint.y - worldY * scale,
    });
  }, [scheduleCameraUpdate]);

  const handleGraphWheel = useCallback((event) => {
    event.preventDefault();
    const nextScale = cameraRef.current.scale * Math.exp(-event.deltaY * CAMERA_ZOOM_INTENSITY);

    zoomCameraAt(event, nextScale);
  }, [zoomCameraAt]);

  const handleGraphPointerDown = useCallback((event) => {
    if (event.button !== 0 || !svgRef.current) {
      return;
    }

    const svgPoint = getSvgPoint(event, svgRef.current);

    setActiveItem(null);
    setSelectedItem(null);
    dragStateRef.current = {
      type: "camera",
      pointerId: event.pointerId,
      startX: svgPoint.x,
      startY: svgPoint.y,
      camera: cameraRef.current,
    };
    setIsCameraDragging(true);
    setActiveItem(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handleNodePointerDown = useCallback((event, node) => {
    if (event.button !== 0 || !svgRef.current) {
      return;
    }

    event.stopPropagation();
    const worldPoint = getWorldPoint(event, svgRef.current, cameraRef.current);
    const svgPoint = getSvgPoint(event, svgRef.current);

    dragStateRef.current = {
      type: "node",
      pointerId: event.pointerId,
      nodeId: node.id,
      startX: svgPoint.x,
      startY: svgPoint.y,
      offsetX: node.x - worldPoint.x,
      offsetY: node.y - worldPoint.y,
      didMove: false,
    };
    setDraggedNodeId(node.id);
    setActiveItem(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handleGraphPointerMove = useCallback((event) => {
    const dragState = dragStateRef.current;
    const svgElement = svgRef.current;

    if (!dragState || !svgElement) {
      return;
    }

    if (dragState.type === "camera") {
      const svgPoint = getSvgPoint(event, svgElement);

      if (Math.hypot(svgPoint.x - dragState.startX, svgPoint.y - dragState.startY) > NODE_CLICK_DRAG_THRESHOLD) {
        dragState.didMove = true;
      }

      const nextCamera = {
        ...dragState.camera,
        x: dragState.camera.x + svgPoint.x - dragState.startX,
        y: dragState.camera.y + svgPoint.y - dragState.startY,
      };

      scheduleCameraUpdate(nextCamera);
      return;
    }

    const svgPoint = getSvgPoint(event, svgElement);
    if (Math.hypot(svgPoint.x - dragState.startX, svgPoint.y - dragState.startY) > NODE_CLICK_DRAG_THRESHOLD) {
      dragState.didMove = true;
    }

    const worldPoint = getWorldPoint(event, svgElement, cameraRef.current);
    const draggedPosition = {
      x: clampGraphCoordinate(worldPoint.x + dragState.offsetX, GRAPH_WIDTH),
      y: clampGraphCoordinate(worldPoint.y + dragState.offsetY, GRAPH_HEIGHT),
    };

    const currentPositions = pendingNodePositionsRef.current ?? nodePositions;
    const nextPositions = repelNearbyNodes(
      positionedGraph.actualNodes ?? positionedGraph.nodes,
      dragState.nodeId,
      draggedPosition,
      currentPositions,
    );

    scheduleNodePositionsUpdate(nextPositions);
  }, [nodePositions, positionedGraph.actualNodes, positionedGraph.nodes, scheduleCameraUpdate, scheduleNodePositionsUpdate]);

  const handleGraphPointerUp = useCallback((event) => {
    const dragState = dragStateRef.current;

    if (dragState?.pointerId === event.pointerId) {
      if (dragState.type === "node" && dragState.didMove) {
        suppressNextNodeClickRef.current = dragState.nodeId;
        window.setTimeout(() => {
          if (suppressNextNodeClickRef.current === dragState.nodeId) {
            suppressNextNodeClickRef.current = null;
          }
        }, 0);
      }

      dragStateRef.current = null;
      setDraggedNodeId(null);
      setIsCameraDragging(false);
    }
  }, []);

  const handleControlZoom = useCallback((scaleMultiplier) => {
    const currentCamera = cameraRef.current;
    const nextScale = clampNumber(currentCamera.scale * scaleMultiplier, MIN_CAMERA_SCALE, MAX_CAMERA_SCALE);
    const center = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
    const worldX = (center.x - currentCamera.x) / currentCamera.scale;
    const worldY = (center.y - currentCamera.y) / currentCamera.scale;

    scheduleCameraUpdate({
      scale: nextScale,
      x: center.x - worldX * nextScale,
      y: center.y - worldY * nextScale,
    });
  }, [scheduleCameraUpdate]);

  const handleResetView = useCallback(() => {
    cameraRef.current = INITIAL_CAMERA;
    setCamera(INITIAL_CAMERA);
  }, []);

  return createPortal(
    <div className="knowledge-graph-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="knowledge-graph-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Граф знаний"
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
          <h2 className="knowledge-graph-modal__title">Граф знаний</h2>
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
              aria-label="Граф знаний"
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
                      <path d={zone.path ?? createSmoothZonePath(zone.bounds)} />
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
                    const isDimmed = visibleDetailsItem && !isActive;

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
                          onClick={(event) => {
                            event.stopPropagation();
                            selectGraphItem({ kind: "edge", item: edge });
                          }}
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
                    const isDimmed = visibleDetailsItem && !isActive;
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
                        onClick={(event) => {
                          event.stopPropagation();
                          if (suppressNextNodeClickRef.current === node.id) {
                            suppressNextNodeClickRef.current = null;
                            return;
                          }

                          selectGraphItem({ kind: "node", item: node });
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectGraphItem({ kind: "node", item: node });
                          }
                        }}
                      >
                        <circle r={NODE_RADIUS} />
                        <Icon
                          className="knowledge-graph-node__icon"
                          aria-hidden="true"
                          x={-NODE_ICON_SIZE / 2}
                          y={-NODE_ICON_SIZE / 2}
                          width={NODE_ICON_SIZE}
                          height={NODE_ICON_SIZE}
                          strokeWidth={1.9}
                        />
                        <text className="knowledge-graph-node__label" y="27">
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
            <ItemDetailsPanel
              item={selectedItem}
              nodesCount={positionedGraph.nodes.length}
              edgesCount={positionedGraph.edges.length}
              scale={camera.scale}
            />
          </aside>
        </div>

        <GraphTooltip item={activeItem} />
      </section>
    </div>,
    document.body,
  );
}
