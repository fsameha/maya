import type { Metadata } from "next";
import { PlayerProvider } from "@/lib/PlayerProvider";
import { Theatre } from "@/components/theatre/Theatre";
import { HowItWorks } from "@/components/how/HowItWorks";

export const metadata: Metadata = { title: "Watch · Maya" };

export default function DemoPage() {
  return (
    <PlayerProvider runId="run-001">
      <Theatre />
      <HowItWorks />
    </PlayerProvider>
  );
}
