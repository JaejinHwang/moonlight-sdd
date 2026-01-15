"use client";

import { ReactNode, useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { DesignSystemProvider } from "@qanda/qds4-web/DesignSystemProvider";
import { Header } from "@/components/layout";

interface DesignSystemWrapperProps {
  children: ReactNode;
}

export function DesignSystemWrapper({ children }: DesignSystemWrapperProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // 논문 뷰어 페이지에서는 전역 Header 숨김 (자체 헤더 사용)
  const hideGlobalHeader = pathname?.startsWith("/paper/");

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div ref={rootRef} id="qds4-root" className="qds4-root">
      <DesignSystemProvider
        qds4Root={mounted ? rootRef.current : null}
        portalRoot={mounted ? rootRef.current : null}
      >
        {!hideGlobalHeader && <Header />}
        <main>{children}</main>
      </DesignSystemProvider>
      <div id="qds4-portal" />
    </div>
  );
}
