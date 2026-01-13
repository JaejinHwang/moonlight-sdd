"use client";

import { ReactNode, useState, useEffect, useRef } from "react";
import { DesignSystemProvider } from "@qanda/qds4-web/DesignSystemProvider";
import { Header } from "@/components/layout";

interface DesignSystemWrapperProps {
  children: ReactNode;
}

export function DesignSystemWrapper({ children }: DesignSystemWrapperProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div ref={rootRef} id="qds4-root" className="qds4-root">
      <DesignSystemProvider
        qds4Root={mounted ? rootRef.current : null}
        portalRoot={mounted ? rootRef.current : null}
      >
        <Header />
        <main>{children}</main>
      </DesignSystemProvider>
      <div id="qds4-portal" />
    </div>
  );
}
