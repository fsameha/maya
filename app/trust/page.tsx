import type { Metadata } from "next";
import { Check, X } from "lucide-react";

export const metadata: Metadata = { title: "Trust · Maya" };

const SEE: [string, boolean, string][] = [
  ["Object answers (“glasses: table, right, 10:42”)", true, ""],
  ["Daily rhythm", true, ""],
  ["Blurred thumbnails", true, "if allowed"],
  ["Raw video", false, "never"],
  ["Live feed", false, "never"],
];

export default function TrustPage() {
  return (
    <article className="mx-auto max-w-[680px] px-4 py-16 text-[18px] leading-[1.6] md:py-24">
      <p className="t-eyebrow">Trust</p>
      <h1 className="t-h2 mt-2">Watching over, without watching.</h1>
      <p className="mt-4" style={{ color: "var(--steel)" }}>How Maya handles a home, a family and the data in between.</p>
      <p className="mt-6 rounded-[16px] px-5 py-4" style={{ background: "var(--surface)" }}>This is a recorded prototype, not a live care service. The media are creator-recorded demo assets. Caregiver delivery and permissions below describe the intended product; the replay uses scripted events.</p>

      <h2 className="t-h3 mt-14">What Maya never does</h2>
      <ul className="mt-4 list-disc space-y-1.5 pl-6">
        <li>Give a diagnosis or a health opinion.</li>
        <li>Advise on medicine.</li>
        <li>Call emergency services.</li>
        <li>Stream video to anyone.</li>
        <li>Claim to prevent harm.</li>
      </ul>

      <h2 className="t-h3 mt-14">Who decides</h2>
      <p className="mt-4">The caregiver writes every reminder. Any health question goes to them. Maya has no tool that can create a reminder or answer a health question.</p>

      <h2 className="t-h3 mt-14">What Yuki can see</h2>
      <table className="mt-4 w-full text-[17px]">
        <thead className="t-caption"><tr><th className="py-2 text-left font-medium">Information</th><th className="py-2 text-right font-medium">Visible to Yuki</th></tr></thead>
        <tbody>
          {SEE.map(([l, ok, note]) => (
            <tr key={l} className="border-t" style={{ borderColor: "var(--hairline)" }}>
              <td className="py-3 pr-4">{l}</td>
              <td className="py-3 text-right">
                {ok ? <Check size={20} strokeWidth={2} className="inline" style={{ color: "var(--success)" }} aria-label="Yes" /> : <X size={20} strokeWidth={2} className="inline" style={{ color: "var(--critical)" }} aria-label="No" />}
                {note && <span className="t-caption ml-2">{note}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="t-h3 mt-14">Data lifetime</h2>
      <p className="mt-4">The published demo assets remain available with the website. SAM person masks demonstrate how selected imagery can be blurred; they do not guarantee anonymization of every demo asset. A 24-hour deletion service and wake-word filtering are planned, not implemented. In Try, camera capture stays in the browser and is discarded; the replay does not analyze it.</p>

      <h2 className="t-h3 mt-14">Experimental</h2>
      <p className="mt-4">The quiet-morning escalation is simulated. A floor check was not built. Maya is not a medical device and does not detect emergencies.</p>

      <h2 className="t-h3 mt-14">Models</h2>
      <ul className="mt-4 space-y-3">
        <li><strong style={{ color: "var(--ink)" }}>SAM 3.1</strong>: finds and outlines objects and people in each clip. Hosted by Meta.</li>
        <li><strong style={{ color: "var(--ink)" }}>Muse Spark</strong>: understands requests, proposes zone names once at setup, compares lookalikes and words answers. Hosted by Meta, on the standard tier, not Contributor (Contributor-tier data trains Meta products, and these are images of a home).</li>
        <li><strong style={{ color: "var(--ink)" }}>Muse Voice Transcribe</strong>: turns speech into text. Hosted by Meta.</li>
        <li><strong style={{ color: "var(--ink)" }}>Demo voice</strong>: ElevenLabs, pre-rendered when the site was built. It is not a Meta model. A live voice is optional, off by default, and uses the visitor&apos;s own key.</li>
      </ul>

      <p className="mt-14 rounded-[16px] px-5 py-4 font-semibold" style={{ background: "var(--surface)", color: "var(--ink)" }}>Not a medical device.</p>
    </article>
  );
}
