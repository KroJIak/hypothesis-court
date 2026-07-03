export function getElementCenter(element, rootRect) {
  const targetElement = element.querySelector?.(".agent-avatar__plate") ?? element;
  const elementRect = targetElement.getBoundingClientRect();

  return {
    x: elementRect.left + elementRect.width / 2 - rootRect.left,
    y: elementRect.top + elementRect.height / 2 - rootRect.top,
  };
}

export function createPathFromPoints(points) {
  const [start, ...restPoints] = points;

  return [
    `M${start.x.toFixed(1)} ${start.y.toFixed(1)}`,
    ...restPoints.map((point) => `L${point.x.toFixed(1)} ${point.y.toFixed(1)}`),
  ].join("");
}

export function createStraightPath(start, end) {
  return createPathFromPoints([start, end]);
}
