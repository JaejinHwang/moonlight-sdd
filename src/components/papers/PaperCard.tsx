"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "@qanda/qds4-web/Tag";
import { IconButton } from "@qanda/qds4-web/IconButton";
import { Icon } from "@qanda/qds4-web/Icon";
import { Spinner } from "@qanda/qds4-web/Spinner";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import type { Paper } from "@/types";

// SVG Icons
const DeleteIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

const MoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
);

interface PaperCardProps {
  paper: Paper;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

export function PaperCard({ paper, onDelete, isDeleting }: PaperCardProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (paper.status === "ready") {
      router.push(`/paper/${paper.id}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusTag = () => {
    switch (paper.status) {
      case "processing":
        return (
          <Tag color="blue" style="tonal">
            분석 중
          </Tag>
        );
      case "error":
        return (
          <Tag color="red" style="tonal">
            오류
          </Tag>
        );
      case "ready":
        return (
          <Tag color="green" style="tonal">
            완료
          </Tag>
        );
      default:
        return null;
    }
  };

  const DeleteIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
    <Icon {...props}>
      <DeleteIcon />
    </Icon>
  );

  const MoreIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
    <Icon {...props}>
      <MoreIcon />
    </Icon>
  );

  const isClickable = paper.status === "ready";

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: COLOR.gray_100,
        borderRadius: "12px",
        padding: "16px",
        cursor: isClickable ? "pointer" : "default",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
        position: "relative",
        boxShadow: isHovered
          ? `0 4px 12px color-mix(in srgb, ${COLOR.gray_10} 15%, transparent)`
          : `0 2px 4px color-mix(in srgb, ${COLOR.gray_10} 10%, transparent)`,
        ...(isHovered && isClickable ? { transform: "translateY(-2px)" } : {}),
      }}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          handleClick();
        }
      }}
      aria-label={`${paper.title} - ${paper.status === "ready" ? "클릭하여 열기" : paper.status}`}
    >
      {/* Processing overlay */}
      {paper.status === "processing" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: `color-mix(in srgb, ${COLOR.gray_100} 70%, transparent)`,
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          <Spinner size={24} />
        </div>
      )}

      {/* Deleting overlay */}
      {isDeleting && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: `color-mix(in srgb, ${COLOR.gray_100} 80%, transparent)`,
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <Spinner size={24} />
        </div>
      )}

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {/* Header: Title + Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3
            className={typography("title_3")}
            style={{
              color: COLOR.gray_10,
              margin: 0,
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              lineHeight: "1.4",
            }}
          >
            {paper.title}
          </h3>

          {/* Action buttons - shown on hover */}
          {isHovered && !isDeleting && (
            <div
              style={{
                display: "flex",
                gap: "4px",
                marginLeft: "8px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <IconButton
                iconSize={20}
                style="clear"
                Icon={DeleteIconComponent}
                onClick={() => onDelete?.(paper.id)}
                aria-label="논문 삭제"
              />
            </div>
          )}
        </div>

        {/* Meta info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {getStatusTag()}
          <span
            className={typography("caption_1")}
            style={{ color: COLOR.gray_50 }}
          >
            {paper.page_count}페이지
          </span>
          <span
            className={typography("caption_1")}
            style={{ color: COLOR.gray_50 }}
          >
            •
          </span>
          <span
            className={typography("caption_1")}
            style={{ color: COLOR.gray_50 }}
          >
            {formatDate(paper.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}
