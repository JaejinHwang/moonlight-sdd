"use client";

import { useState, useCallback, useMemo } from "react";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import { IconButton } from "@qanda/qds4-web/IconButton";
import { Icon } from "@qanda/qds4-web/Icon";
import type { Section } from "@/types";

// functional-spec.yaml#F-004 상태 정의
export type TocState = "collapsed" | "expanded" | "navigating";

interface TocItem {
  id: string;
  title: string;
  level: number;
  pageStart: number;
  pageEnd: number;
}

interface TableOfContentsProps {
  sections: Section[];
  activeSection: string | null;
  onSectionClick: (sectionId: string) => void;
  initialState?: TocState;
}

// SVG Icons
const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
  </svg>
);

// Icon wrapper components for QDS IconButton
const ChevronDownIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
  <Icon {...props}><ChevronDownIcon /></Icon>
);

const ChevronRightIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
  <Icon {...props}><ChevronRightIcon /></Icon>
);

const MenuIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
  <Icon {...props}><MenuIcon /></Icon>
);

const CloseIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
  <Icon {...props}><CloseIcon /></Icon>
);

/**
 * TableOfContents 컴포넌트
 * ui-spec.yaml#SCR-002.components.toc_sidebar
 * functional-spec.yaml#F-004
 */
export function TableOfContents({
  sections,
  activeSection,
  onSectionClick,
  initialState = "expanded",
}: TableOfContentsProps) {
  // 상태 머신: collapsed, expanded, navigating
  const [tocState, setTocState] = useState<TocState>(initialState);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // 섹션을 TocItem으로 변환
  const tocItems: TocItem[] = useMemo(() => {
    return sections.map((section) => ({
      id: section.id,
      title: section.title || `섹션 ${section.order_index + 1}`,
      level: section.level,
      pageStart: section.page_start,
      pageEnd: section.page_end,
    }));
  }, [sections]);

  // 계층 구조로 그룹화 (level 1은 부모, 2,3은 자식)
  const hasChildren = useCallback((item: TocItem, index: number): boolean => {
    const nextItem = tocItems[index + 1];
    return nextItem !== undefined && nextItem.level > item.level;
  }, [tocItems]);

  // 자식 섹션인지 확인 (부모가 접혀있으면 숨김)
  const isChildHidden = useCallback((item: TocItem, index: number): boolean => {
    // 이 아이템의 부모를 찾아서 접혀있는지 확인
    for (let i = index - 1; i >= 0; i--) {
      const potentialParent = tocItems[i];
      if (potentialParent.level < item.level) {
        if (collapsedSections.has(potentialParent.id)) {
          return true;
        }
        // 부모를 찾았고 접혀있지 않음, 더 상위 부모 확인
        if (potentialParent.level === 1) {
          return false;
        }
      }
    }
    return false;
  }, [tocItems, collapsedSections]);

  // 섹션 접기/펼치기 토글
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // 섹션 클릭 핸들러 - 상태 전이: expanded -> navigating -> expanded
  const handleSectionClick = useCallback((sectionId: string) => {
    setTocState("navigating");
    onSectionClick(sectionId);
    // 네비게이션 완료 후 상태 복원
    setTimeout(() => {
      setTocState("expanded");
    }, 300);
  }, [onSectionClick]);

  // 목차 펼치기/접기 토글
  const toggleToc = useCallback(() => {
    setTocState((prev) => (prev === "collapsed" ? "expanded" : "collapsed"));
  }, []);

  // 접힌 상태일 때 토글 버튼만 표시
  if (tocState === "collapsed") {
    return (
      <div
        style={{
          position: "fixed",
          left: "16px",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 100,
        }}
      >
        <IconButton
          Icon={MenuIconComponent}
          onClick={toggleToc}
          style="border"
          iconSize={24}
          aria-label="목차 열기"
        />
      </div>
    );
  }

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        width: "280px",
        height: "100%",
        backgroundColor: COLOR.gray_100,
        borderRight: `1px solid ${COLOR.gray_80}`,
        overflow: "hidden",
      }}
      aria-label="목차"
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px",
          borderBottom: `1px solid ${COLOR.gray_80}`,
        }}
      >
        <span
          className={typography("title_3_strong")}
          style={{ color: COLOR.gray_10 }}
        >
          목차
        </span>
        <IconButton
          Icon={CloseIconComponent}
          onClick={toggleToc}
          style="clear"
          iconSize={20}
          aria-label="목차 닫기"
        />
      </header>

      {/* Table of Contents items */}
      <nav
        style={{
          flex: 1,
          overflow: "auto",
          padding: "8px 0",
        }}
      >
        {tocItems.length === 0 ? (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
            }}
          >
            <span
              className={typography("body_2")}
              style={{ color: COLOR.gray_50 }}
            >
              목차 정보가 없습니다
            </span>
          </div>
        ) : (
          tocItems.map((item, index) => {
            // 부모가 접혀있으면 자식 숨김
            if (isChildHidden(item, index)) {
              return null;
            }

            const isActive = activeSection === item.id;
            const hasChildItems = hasChildren(item, index);
            const isCollapsed = collapsedSections.has(item.id);
            const indent = (item.level - 1) * 16;

            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  padding: `8px 16px 8px ${16 + indent}px`,
                  backgroundColor: isActive ? COLOR.blue_95 : "transparent",
                  borderLeft: isActive
                    ? `3px solid ${COLOR.blue_50}`
                    : "3px solid transparent",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                }}
                onClick={() => handleSectionClick(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSectionClick(item.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-current={isActive ? "location" : undefined}
              >
                {/* 접기/펼치기 토글 (자식이 있는 경우) */}
                {hasChildItems && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSection(item.id);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "20px",
                      height: "20px",
                      marginRight: "4px",
                      padding: 0,
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                    aria-label={isCollapsed ? "하위 항목 펼치기" : "하위 항목 접기"}
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? (
                      <ChevronRightIcon />
                    ) : (
                      <ChevronDownIcon />
                    )}
                  </button>
                )}

                {/* 자식이 없는 경우 들여쓰기 공간 */}
                {!hasChildItems && item.level > 1 && (
                  <div style={{ width: "24px", flexShrink: 0 }} />
                )}

                {/* 섹션 제목 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    className={typography(isActive ? "body_1_strong" : "body_1")}
                    style={{
                      color: isActive ? COLOR.blue_50 : COLOR.gray_20,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      wordBreak: "break-word",
                    }}
                    title={item.title} // 호버 시 전체 제목 표시
                  >
                    {item.title}
                  </span>
                  {/* 페이지 번호 */}
                  <span
                    className={typography("caption_2")}
                    style={{
                      color: COLOR.gray_60,
                      display: "block",
                      marginTop: "2px",
                    }}
                  >
                    p.{item.pageStart}
                    {item.pageEnd > item.pageStart && `-${item.pageEnd}`}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </nav>

      {/* Footer - 현재 위치 표시 */}
      {tocItems.length > 0 && (
        <footer
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${COLOR.gray_80}`,
            backgroundColor: COLOR.gray_95,
          }}
        >
          <span
            className={typography("caption_1")}
            style={{ color: COLOR.gray_50 }}
          >
            총 {tocItems.length}개 섹션
          </span>
        </footer>
      )}
    </aside>
  );
}
