import type { Metadata } from "next";
import { YukiView } from "@/components/try/YukiView";

export const metadata: Metadata = { title: "Be Yuki · Maya" };

export default function YukiPage() {
  return <YukiView />;
}
