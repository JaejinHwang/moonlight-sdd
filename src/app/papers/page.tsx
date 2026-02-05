"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TopAppBar } from "@qanda/qds4-web/TopAppBar";
import { Button } from "@qanda/qds4-web/Button";
import { IconButton } from "@qanda/qds4-web/IconButton";
import { Icon } from "@qanda/qds4-web/Icon";
import { LoadingAnimation } from "@qanda/qds4-web/LoadingAnimation";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import { PaperCard } from "@/components/papers";
import { useAuthStore } from "@/stores/auth-store";
import type { Paper } from "@/types";

// SVG Icons
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
  </svg>
);

const AddIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
  </svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
  </svg>
);

const ClearIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

type LoadingState = "idle" | "loading" | "success" | "error";

export default function PapersPage() {
  const router = useRouter();
  const { authState, initialize } = useAuthStore();

  const [papers, setPapers] = useState<Paper[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Redirect if not authenticated
  useEffect(() => {
    if (authState === "unauthenticated") {
      router.push("/");
    }
  }, [authState, router]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch papers
  const fetchPapers = useCallback(async () => {
    setLoadingState("loading");
    setError(null);

    try {
      const params = new URLSearchParams();
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const response = await fetch(`/api/papers?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "논문 목록을 불러오는데 실패했습니다.");
      }

      setPapers(data.papers);
      setLoadingState("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      setLoadingState("error");
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (authState === "authenticated") {
      fetchPapers();
    }
  }, [authState, fetchPapers]);

  // Delete paper
  const handleDelete = async () => {
    if (!deleteTargetId) return;

    setIsDeleting(deleteTargetId);
    setDeleteTargetId(null);

    try {
      const response = await fetch(`/api/papers/${deleteTargetId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "논문 삭제에 실패했습니다.");
      }

      // Remove from local state
      setPapers((prev) => prev.filter((p) => p.id !== deleteTargetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(null);
    }
  };

  const BackIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
    <Icon {...props}>
      <BackIcon />
    </Icon>
  );

  const AddIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
    <Icon {...props}>
      <AddIcon />
    </Icon>
  );

  const ClearIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
    <Icon {...props}>
      <ClearIcon />
    </Icon>
  );

  // Loading state
  if (authState === "loading" || loadingState === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLOR.gray_95,
        }}
      >
        <LoadingAnimation size={48} />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: COLOR.gray_95,
      }}
    >
      {/* Header */}
      <TopAppBar
        elevation="on-scroll"
        position="sticky"
        size="m"
        leading={
          <IconButton
            iconSize={24}
            style="clear"
            Icon={BackIconComponent}
            onClick={() => router.push("/")}
            aria-label="홈으로"
          />
        }
        main={
          <span
            className={typography("title_1")}
            style={{ color: COLOR.gray_10 }}
          >
            내 논문
          </span>
        }
      />

      {/* Content */}
      <main
        id="main-content"
        style={{
          padding: "16px",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginBottom: "24px",
            flexWrap: "wrap",
          }}
        >
          {/* Search input */}
          <div
            style={{
              flex: 1,
              minWidth: "200px",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "20px",
                height: "20px",
                color: COLOR.gray_50,
              }}
            >
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="논문 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={typography("body_1")}
              style={{
                width: "100%",
                padding: "12px 40px 12px 40px",
                borderRadius: "8px",
                border: `1px solid ${COLOR.gray_80}`,
                backgroundColor: COLOR.gray_100,
                color: COLOR.gray_10,
                outline: "none",
              }}
              aria-label="논문 검색"
            />
            {searchQuery && (
              <div
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                <IconButton
                  iconSize={20}
                  style="clear"
                  Icon={ClearIconComponent}
                  onClick={() => setSearchQuery("")}
                  aria-label="검색어 지우기"
                />
              </div>
            )}
          </div>

          {/* Upload button (tablet+) - ui-spec.yaml#SCR-003.components.upload_button */}
          <div className="tablet-up">
            <Button
              variant="accent"
              size="m"
              onClick={() => router.push("/")}
            >
              새 논문 업로드
            </Button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: COLOR.red_95,
              borderRadius: "8px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              className={typography("body_2")}
              style={{ color: COLOR.red_50 }}
            >
              {error}
            </span>
            <Button
              variant="outlined"
              size="xs"
              onClick={fetchPapers}
            >
              다시 시도
            </Button>
          </div>
        )}

        {/* Papers grid or empty state */}
        {papers.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "64px 16px",
              textAlign: "center",
            }}
          >
            <span
              className={typography("title_2")}
              style={{ color: COLOR.gray_30, marginBottom: "8px" }}
            >
              {debouncedSearch ? "검색 결과가 없습니다" : "아직 업로드한 논문이 없습니다"}
            </span>
            <span
              className={typography("body_1")}
              style={{ color: COLOR.gray_50, marginBottom: "24px" }}
            >
              {debouncedSearch
                ? "다른 검색어를 시도해보세요"
                : "PDF 파일을 업로드하여 시작하세요"}
            </span>
            {!debouncedSearch && (
              <Button variant="accent" size="m" onClick={() => router.push("/")}>
                논문 업로드하기
              </Button>
            )}
          </div>
        ) : (
          <div className="papers-grid">
            {papers.map((paper) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                onDelete={(id) => setDeleteTargetId(id)}
                isDeleting={isDeleting === paper.id}
              />
            ))}
          </div>
        )}
      </main>

      {/* FAB for mobile - ui-spec.yaml#SCR-003.components.upload_fab */}
      <div
        className="fab-container mobile-only"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            backgroundColor: COLOR.blue_50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 12px color-mix(in srgb, ${COLOR.gray_10} 20%, transparent)`,
          }}
        >
          <IconButton
            iconSize={24}
            style="clear"
            Icon={AddIconComponent}
            onClick={() => router.push("/")}
            aria-label="새 논문 업로드"
          />
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteTargetId && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: `color-mix(in srgb, ${COLOR.gray_10} 50%, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setDeleteTargetId(null)}
        >
          <div
            style={{
              backgroundColor: COLOR.gray_100,
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "400px",
              width: "calc(100% - 32px)",
              boxShadow: `0 8px 32px color-mix(in srgb, ${COLOR.gray_10} 20%, transparent)`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className={typography("title_2_strong")}
              style={{ color: COLOR.gray_10, marginBottom: "8px" }}
            >
              논문 삭제
            </h2>
            <p
              className={typography("body_1")}
              style={{ color: COLOR.gray_40, marginBottom: "24px" }}
            >
              이 논문을 삭제하시겠습니까? 삭제된 논문은 복구할 수 없습니다.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <Button
                variant="outlined"
                size="m"
                onClick={() => setDeleteTargetId(null)}
              >
                취소
              </Button>
              <Button
                variant="danger"
                size="m"
                onClick={handleDelete}
              >
                삭제
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
