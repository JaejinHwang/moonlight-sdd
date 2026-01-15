"use client";

import { useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { COLOR } from "@qanda/qds4-web/base.ts";

interface SplitViewLayoutProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  initialRatio?: number; // 0.0 ~ 1.0, 왼쪽 패널 비율
  minWidth?: number; // 각 패널 최소 너비 (px)
}

export function SplitViewLayout({
  leftPanel,
  rightPanel,
  initialRatio = 0.5,
  minWidth = 300,
}: SplitViewLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftRatio, setLeftRatio] = useState<number>(initialRatio);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // 드래그 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // 드래그 중 마우스 이동 처리
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;

      // 최소 너비 제한 적용
      const minRatio = minWidth / containerWidth;
      const maxRatio = 1 - minRatio;

      let newRatio = mouseX / containerWidth;
      newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio));

      setLeftRatio(newRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minWidth]);

  // 더블클릭으로 50:50 리셋
  const handleDoubleClick = useCallback(() => {
    setLeftRatio(0.5);
  }, []);

  // 터치 이벤트 지원
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (!containerRef.current || !e.touches[0]) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const touchX = e.touches[0].clientX - containerRect.left;

      const minRatio = minWidth / containerWidth;
      const maxRatio = 1 - minRatio;

      let newRatio = touchX / containerWidth;
      newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio));

      setLeftRatio(newRatio);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, minWidth]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flex: 1,
        overflow: "hidden",
        position: "relative",
        // 드래그 중 텍스트 선택 방지
        userSelect: isDragging ? "none" : "auto",
      }}
    >
      {/* 왼쪽 패널 (PDF 원본) */}
      <div
        style={{
          width: `${leftRatio * 100}%`,
          height: "100%",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {leftPanel}
      </div>

      {/* 분할선 (드래그 핸들) */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
        role="separator"
        aria-orientation="vertical"
        aria-label="패널 분할선 - 드래그하여 크기 조정"
        aria-valuenow={Math.round(leftRatio * 100)}
        tabIndex={0}
        style={{
          width: "8px",
          height: "100%",
          backgroundColor: isDragging ? COLOR.blue_50 : COLOR.gray_80,
          cursor: "col-resize",
          flexShrink: 0,
          position: "relative",
          transition: isDragging ? "none" : "background-color 0.2s",
          zIndex: 10,
        }}
        onKeyDown={(e) => {
          // 키보드로 분할선 조정
          if (e.key === "ArrowLeft") {
            setLeftRatio((prev) => Math.max(minWidth / (containerRef.current?.offsetWidth || 1000), prev - 0.05));
          } else if (e.key === "ArrowRight") {
            setLeftRatio((prev) => Math.min(1 - minWidth / (containerRef.current?.offsetWidth || 1000), prev + 0.05));
          }
        }}
      >
        {/* 드래그 핸들 시각적 표시 */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "4px",
            height: "40px",
            backgroundColor: isDragging ? COLOR.gray_100 : COLOR.gray_60,
            borderRadius: "2px",
            transition: isDragging ? "none" : "background-color 0.2s",
          }}
        />
      </div>

      {/* 오른쪽 패널 (파싱된 텍스트) */}
      <div
        style={{
          flex: 1,
          height: "100%",
          overflow: "auto",
        }}
      >
        {rightPanel}
      </div>

      {/* 드래그 오버레이 (드래그 중 다른 요소와의 간섭 방지) */}
      {isDragging && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            cursor: "col-resize",
            zIndex: 5,
          }}
        />
      )}
    </div>
  );
}
