"use client";

import { useState } from "react";
import { StandardDialog } from "@qanda/qds4-web/StandardDialog";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import { AuthForm } from "./AuthForm";

type AuthMode = "signin" | "signup";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
}

export function AuthModal({
  isOpen,
  onClose,
  initialMode = "signin",
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const handleSuccess = () => {
    onClose();
    setMode("signin");
  };

  return (
    <StandardDialog
      isOpen={isOpen}
      onClose={onClose}
      size="s"
      title={mode === "signin" ? "로그인" : "회원가입"}
    >
      <div className="p-4">
        <AuthForm
          mode={mode}
          onModeChange={setMode}
          onSuccess={handleSuccess}
        />
      </div>
    </StandardDialog>
  );
}
