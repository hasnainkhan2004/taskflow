const POSITION_GAP = 1024;
const MIN_POSITION_GAP = 0.000001;

const calculatePosition = (items, beforeId, afterId, idField = '_id') => {
  const beforeIndex = beforeId
    ? items.findIndex((item) => String(item[idField]) === String(beforeId))
    : -1;
  const afterIndex = afterId
    ? items.findIndex((item) => String(item[idField]) === String(afterId))
    : -1;

  if ((beforeId && beforeIndex === -1) || (afterId && afterIndex === -1)) {
    return { error: 'Reorder anchor was not found' };
  }
  if (beforeIndex !== -1 && afterIndex !== -1 && afterIndex + 1 !== beforeIndex) {
    return { error: 'Reorder anchors must be adjacent and ordered' };
  }

  const insertionIndex = beforeIndex !== -1
    ? beforeIndex
    : afterIndex !== -1
      ? afterIndex + 1
      : items.length;
  const previous = items[insertionIndex - 1];
  const next = items[insertionIndex];
  const previousPosition = previous ? previous.position : 0;
  const nextPosition = next ? next.position : previousPosition + POSITION_GAP * 2;
  let position = (previousPosition + nextPosition) / 2;

  if (next && nextPosition - previousPosition < MIN_POSITION_GAP) {
    const rebalance = items.map((item, index) => ({
      id: item[idField],
      position: (index + (index >= insertionIndex ? 1 : 0) + 1) * POSITION_GAP,
    }));
    const previousRebalancedPosition = insertionIndex * POSITION_GAP;
    const nextRebalancedPosition = (insertionIndex + 1) * POSITION_GAP;
    position = (previousRebalancedPosition + nextRebalancedPosition) / 2;
    return {
      position,
      rebalance,
      insertionIndex,
    };
  }

  return { position, insertionIndex };
};

module.exports = { POSITION_GAP, calculatePosition };
