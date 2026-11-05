import type { Metadata } from "next";
import { TryApp } from "@/components/try/TryApp";

export const metadata: Metadata = { title: "Try it live · Maya" };

export default function TryPage() {
  return <TryApp />;
}
