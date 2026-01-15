"use client";

import { useState, useEffect, useCallback, useRef, RefObject } from "react";

interface UseActiveSectionTrackerOptions {
  /**
   * 스크롤 컨테이너 ref
   */
  containerRef: RefObject<HTMLElement>;
  /**
   * 추적할 섹션 ID 목록
   */
  sectionIds: string[];
  /**
   * root margin 설정 (Intersection Observer)
   * 기본값: 상단 20%에서 감지
   */
  rootMargin?: string;
  /**
   * threshold 설정
   */
  threshold?: number | number[];
}

interface UseActiveSectionTrackerReturn {
  /**
   * 현재 활성 섹션 ID
   */
  activeSectionId: string | null;
  /**
   * 특정 섹션으로 스크롤
   * @param sectionId 스크롤할 섹션 ID
   * @param behavior 스크롤 동작 (smooth | auto)
   */
  scrollToSection: (sectionId: string, behavior?: ScrollBehavior) => void;
  /**
   * 현재 스크롤 중인지 여부 (프로그래매틱 스크롤)
   */
  isScrolling: boolean;
}

/**
 * 현재 보이는 섹션을 추적하고 섹션으로 스크롤하는 기능을 제공하는 훅
 * functional-spec.yaml#F-004 - 목차 네비게이션
 */
export function useActiveSectionTracker({
  containerRef,
  sectionIds,
  rootMargin = "-20% 0px -70% 0px",
  threshold = 0,
}: UseActiveSectionTrackerOptions): UseActiveSectionTrackerReturn {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Intersection Observer로 현재 보이는 섹션 추적
  useEffect(() => {
    const container = containerRef.current;
    if (!container || sectionIds.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 프로그래매틱 스크롤 중에는 무시
        if (isScrolling) return;

        // 가장 많이 보이는 섹션 찾기
        let maxRatio = 0;
        let mostVisibleSectionId: string | null = null;

        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const sectionId = entry.target.getAttribute("data-section-id");
            if (sectionId) {
              mostVisibleSectionId = sectionId;
            }
          }
        }

        // 보이는 섹션이 없으면 첫 번째로 교차하는 섹션 사용
        if (!mostVisibleSectionId) {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const sectionId = entry.target.getAttribute("data-section-id");
              if (sectionId) {
                mostVisibleSectionId = sectionId;
                break;
              }
            }
          }
        }

        if (mostVisibleSectionId) {
          setActiveSectionId(mostVisibleSectionId);
        }
      },
      {
        root: container,
        rootMargin,
        threshold: Array.isArray(threshold) ? threshold : [threshold, 0.25, 0.5, 0.75, 1],
      }
    );

    // 모든 섹션 요소 관찰
    const sectionElements = container.querySelectorAll("[data-section-id]");
    sectionElements.forEach((el) => observer.observe(el));

    // 초기 활성 섹션 설정
    if (sectionIds.length > 0 && !activeSectionId) {
      setActiveSectionId(sectionIds[0]);
    }

    return () => observer.disconnect();
  }, [containerRef, sectionIds, rootMargin, threshold, isScrolling, activeSectionId]);

  // 특정 섹션으로 스크롤
  const scrollToSection = useCallback(
    (sectionId: string, behavior: ScrollBehavior = "smooth") => {
      const container = containerRef.current;
      if (!container) return;

      const sectionElement = container.querySelector(
        `[data-section-id="${sectionId}"]`
      );

      if (!sectionElement) {
        console.warn(`Section with id "${sectionId}" not found`);
        return;
      }

      // 프로그래매틱 스크롤 시작
      setIsScrolling(true);
      setActiveSectionId(sectionId);

      // 이전 타임아웃 클리어
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // 섹션으로 스크롤
      sectionElement.scrollIntoView({
        behavior,
        block: "start",
      });

      // 스크롤 완료 후 isScrolling 해제
      // smooth 스크롤은 최대 300ms, auto는 즉시
      const scrollDuration = behavior === "smooth" ? 350 : 50;
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, scrollDuration);
    },
    [containerRef]
  );

  // 클린업
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    activeSectionId,
    scrollToSection,
    isScrolling,
  };
}
