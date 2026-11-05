"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function PairQR({ url, code }: { url: string; code: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#0a1317", light: "#ffffff" } }).then(setSvg).catch(() => {});
  }, [url]);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row-reverse sm:items-center">
      <div className="order-2 h-40 w-40 rounded-[16px] border bg-white p-2 sm:order-none" style={{ borderColor: "var(--hairline)" }} role="img" aria-label="QR code to open the Yuki view" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="order-1 text-center sm:text-left">
        <p className="t-caption">Pair code</p>
        <p className="display tnum text-[40px] font-semibold tracking-[0.12em]" style={{ color: "var(--ink)" }}>{code.slice(0, 3)} {code.slice(3)}</p>
      </div>
    </div>
  );
}
