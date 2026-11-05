"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { LinkProvider } from "@astryxdesign/core/Link";
import { mayaTheme } from "@/lib/theme/maya";
import { useResolvedMode } from "@/lib/colorMode";
import { LenisProvider } from "@/lib/lenis";
import { GazeProvider } from "@/components/maya/gaze";

export function Providers({ children }: { children: ReactNode }) {
  const mode = useResolvedMode();
  return (
    <Theme theme={mayaTheme} mode={mode}>
      <LinkProvider component={Link}>
        <LenisProvider>
          <GazeProvider>{children}</GazeProvider>
        </LenisProvider>
      </LinkProvider>
    </Theme>
  );
}
