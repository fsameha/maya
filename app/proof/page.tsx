import type { Metadata } from "next";
import { ProofPage } from "@/components/proof/ProofPage";

export const metadata: Metadata = { title: "Proof · Maya" };

export default function Page() {
  return <ProofPage />;
}
