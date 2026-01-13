"use client";

import { useState } from "react";
import { Button } from "@qanda/qds4-web/Button";
import { Spinner } from "@qanda/qds4-web/Spinner";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import { useAuthStore } from "@/stores/auth-store";

type AuthMode = "signin" | "signup";

interface AuthFormProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onSuccess?: () => void;
}

export function AuthForm({ mode, onModeChange, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { signIn, signUp, isLoading, error, clearError } = useAuthStore();

  const validateForm = (): boolean => {
    setValidationError(null);

    if (!email.trim()) {
      setValidationError("이메일을 입력해주세요.");
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setValidationError("올바른 이메일 형식을 입력해주세요.");
      return false;
    }

    if (!password) {
      setValidationError("비밀번호를 입력해주세요.");
      return false;
    }

    if (password.length < 6) {
      setValidationError("비밀번호는 6자 이상이어야 합니다.");
      return false;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setValidationError("비밀번호가 일치하지 않습니다.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) {
      return;
    }

    let result;
    if (mode === "signin") {
      result = await signIn(email, password);
    } else {
      result = await signUp(email, password);
    }

    if (result.success) {
      onSuccess?.();
    }
  };

  const displayError = validationError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className={`block mb-1.5 ${typography("body_2_strong")}`}
          style={{ color: COLOR.gray_10 }}
        >
          이메일
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@email.com"
          className="w-full px-3 py-2.5 rounded-lg border outline-none transition-colors"
          style={{
            borderColor: COLOR.gray_70,
            backgroundColor: COLOR.gray_100,
            color: COLOR.gray_10,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = COLOR.blue_50;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = COLOR.gray_70;
          }}
          disabled={isLoading}
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className={`block mb-1.5 ${typography("body_2_strong")}`}
          style={{ color: COLOR.gray_10 }}
        >
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="6자 이상 입력"
          className="w-full px-3 py-2.5 rounded-lg border outline-none transition-colors"
          style={{
            borderColor: COLOR.gray_70,
            backgroundColor: COLOR.gray_100,
            color: COLOR.gray_10,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = COLOR.blue_50;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = COLOR.gray_70;
          }}
          disabled={isLoading}
        />
      </div>

      {mode === "signup" && (
        <div>
          <label
            htmlFor="confirmPassword"
            className={`block mb-1.5 ${typography("body_2_strong")}`}
            style={{ color: COLOR.gray_10 }}
          >
            비밀번호 확인
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="비밀번호 재입력"
            className="w-full px-3 py-2.5 rounded-lg border outline-none transition-colors"
            style={{
              borderColor: COLOR.gray_70,
              backgroundColor: COLOR.gray_100,
              color: COLOR.gray_10,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = COLOR.blue_50;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = COLOR.gray_70;
            }}
            disabled={isLoading}
          />
        </div>
      )}

      {displayError && (
        <div
          className={`p-3 rounded-lg ${typography("body_2")}`}
          style={{ backgroundColor: COLOR.red_95, color: COLOR.red_50 }}
        >
          {displayError}
        </div>
      )}

      <Button
        variant="accent"
        size="l"
        type="submit"
        disabled={isLoading}
        loading={isLoading}
      >
        {mode === "signin" ? "로그인" : "회원가입"}
      </Button>

      <div
        className={`text-center ${typography("body_2")}`}
        style={{ color: COLOR.gray_50 }}
      >
        {mode === "signin" ? (
          <>
            계정이 없으신가요?{" "}
            <button
              type="button"
              onClick={() => {
                onModeChange("signup");
                clearError();
                setValidationError(null);
              }}
              className="underline"
              style={{ color: COLOR.blue_50 }}
            >
              회원가입
            </button>
          </>
        ) : (
          <>
            이미 계정이 있으신가요?{" "}
            <button
              type="button"
              onClick={() => {
                onModeChange("signin");
                clearError();
                setValidationError(null);
              }}
              className="underline"
              style={{ color: COLOR.blue_50 }}
            >
              로그인
            </button>
          </>
        )}
      </div>
    </form>
  );
}
