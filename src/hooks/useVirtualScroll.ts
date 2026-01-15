"use client";

import { useState, useCallback, useMemo, RefObject, useEffect } from "react";

interface UseVirtualScrollOptions {
  itemCount: number;
  itemHeights: number[];
  containerRef: RefObject<HTMLElement | null>;
  overscan?: number; // Extra items to render above/below viewport
}

interface VirtualScrollResult {
  visibleRange: { start: number; end: number };
  totalHeight: number;
  offsetY: number;
  handleScroll: () => void;
}

/**
 * Virtual scroll hook for rendering large lists efficiently
 * Implements edge_case from functional-spec.yaml#F-003: "100페이지 이상의 긴 논문"
 * Performance target: 60fps scroll from ui-spec.yaml#SCR-002
 */
export function useVirtualScroll({
  itemCount,
  itemHeights,
  containerRef,
  overscan = 3,
}: UseVirtualScrollOptions): VirtualScrollResult {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Calculate total height of all items
  const totalHeight = useMemo(() => {
    return itemHeights.reduce((sum, height) => sum + height, 0);
  }, [itemHeights]);

  // Calculate cumulative heights for binary search
  const cumulativeHeights = useMemo(() => {
    const heights: number[] = [];
    let cumulative = 0;
    for (const height of itemHeights) {
      heights.push(cumulative);
      cumulative += height;
    }
    return heights;
  }, [itemHeights]);

  // Binary search to find the first visible item
  const findStartIndex = useCallback(
    (scrollTop: number): number => {
      if (cumulativeHeights.length === 0) return 0;

      let low = 0;
      let high = cumulativeHeights.length - 1;

      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (cumulativeHeights[mid] < scrollTop) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }

      return Math.max(0, low - 1);
    },
    [cumulativeHeights]
  );

  // Find the last visible item
  const findEndIndex = useCallback(
    (scrollTop: number, containerHeight: number): number => {
      const targetBottom = scrollTop + containerHeight;

      if (cumulativeHeights.length === 0) return 0;

      let low = 0;
      let high = cumulativeHeights.length - 1;

      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const itemBottom = cumulativeHeights[mid] + itemHeights[mid];

        if (itemBottom < targetBottom) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }

      return Math.min(itemCount - 1, low);
    },
    [cumulativeHeights, itemHeights, itemCount]
  );

  // Calculate visible range with overscan
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, findStartIndex(scrollTop) - overscan);
    const endIndex = Math.min(
      itemCount - 1,
      findEndIndex(scrollTop, containerHeight) + overscan
    );

    return { start: startIndex, end: endIndex };
  }, [scrollTop, containerHeight, findStartIndex, findEndIndex, overscan, itemCount]);

  // Calculate offset for positioning visible items
  const offsetY = useMemo(() => {
    if (visibleRange.start === 0 || cumulativeHeights.length === 0) {
      return 0;
    }
    return cumulativeHeights[visibleRange.start];
  }, [visibleRange.start, cumulativeHeights]);

  // Handle scroll event with RAF for 60fps
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    // Use requestAnimationFrame for smooth 60fps updates
    requestAnimationFrame(() => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop);
      }
    });
  }, [containerRef]);

  // Initialize and track container height
  useEffect(() => {
    if (!containerRef.current) return;

    const updateContainerHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateContainerHeight();

    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(updateContainerHeight);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [containerRef]);

  return {
    visibleRange,
    totalHeight,
    offsetY,
    handleScroll,
  };
}
