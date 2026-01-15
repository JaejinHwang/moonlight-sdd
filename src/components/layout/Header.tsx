"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopAppBar } from "@qanda/qds4-web/TopAppBar";
import { Button } from "@qanda/qds4-web/Button";
import { IconButton } from "@qanda/qds4-web/IconButton";
import { Icon } from "@qanda/qds4-web/Icon";
import { BottomSheet } from "@qanda/qds4-web/BottomSheet";
import { Divider } from "@qanda/qds4-web/Divider";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import { useAuthStore } from "@/stores/auth-store";
import { AuthModal } from "@/components/auth";

// SVG Icons as components for use with Icon wrapper
const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
  </svg>
);

export function Header() {
  const router = useRouter();
  const { user, authState, signOut, initialize } = useAuthStore();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleSignOut = async () => {
    await signOut();
    setIsMenuOpen(false);
  };

  const handleMyPapers = () => {
    setIsMenuOpen(false);
    router.push("/papers");
  };

  const isAuthenticated = authState === "authenticated";

  // Custom Icon component for IconButton
  const PersonIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
    <Icon {...props}>
      <PersonIcon />
    </Icon>
  );

  return (
    <>
      <TopAppBar
        elevation="on-scroll"
        position="sticky"
        size="m"
        main={
          <span
            className={typography("title_2_strong")}
            style={{ color: COLOR.gray_10 }}
          >
            Moonlight
          </span>
        }
        trailing={
          isAuthenticated ? (
            <IconButton
              iconSize={24}
              style="clear"
              Icon={PersonIconComponent}
              onClick={() => setIsMenuOpen(true)}
              aria-label="사용자 메뉴"
            />
          ) : (
            <Button
              variant="outlined"
              size="s"
              onClick={() => setIsAuthModalOpen(true)}
            >
              로그인
            </Button>
          )
        }
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <BottomSheet
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        title="내 계정"
        description={user?.email}
        footer={
          <Button
            variant="danger"
            size="m"
            onClick={handleSignOut}
          >
            로그아웃
          </Button>
        }
      >
        <div className="py-2">
          <div
            className={`px-4 py-3 ${typography("body_1")}`}
            style={{ color: COLOR.gray_30 }}
          >
            {user?.email}
          </div>
          <Divider />
          <button
            onClick={handleMyPapers}
            className={`w-full px-4 py-3 text-left ${typography("body_1")}`}
            style={{
              color: COLOR.gray_10,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            내 논문 목록
          </button>
          <Divider />
        </div>
      </BottomSheet>
    </>
  );
}
