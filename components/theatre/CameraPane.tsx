"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Run, Sighting } from "@/lib/contract";
import type { Player } from "@/lib/player";
import { getGsap } from "@/lib/gsap";
import { maskOutline } from "@/lib/maskContour";
import { prefersReducedMotion } from "@/lib/reducedMotion";
import { homeClock } from "@/lib/homeTime";
import { samObjectId, type TheatreState } from "./model";

export function CameraPane({ run, state, player }: { run: Run; state: TheatreState["camera"]; player: Player }) {
  const video = useRef<HTMLVideoElement>(null);
  const outline = useRef<SVGPathElement>(null);
  const chip = useRef<HTMLSpanElement>(null);
  const [d, setD] = useState("");
  const [clock, setClock] = useState("");
  const locked = state.locked;
  const zone = locked ? run.zones.find((z) => z.id === (state.zoneLit ?? locked.zoneId)) : undefined;

  // clip start as wall-clock seconds in the home's own time zone (sighting.t is UTC ISO)
  const clipStartMs = useMemo(() => {
    for (const e of run.events)
      if (e.type === "perception.done")
        for (const s of e.sightings)
          if (s.clipId === state.clipId) {
            const [h, m, sec] = homeClock(s.t, true).split(":").map(Number);
            return ((h * 60 + m) * 60 + sec + (Date.parse(s.t) % 1000) / 1000) * 1000 - (s.frame / state.fps) * 1000;
          }
    return null;
  }, [run, state.clipId, state.fps]);

  // video follows the player: plays from the clip event, scrubs back to the sighting on find_object
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const sync = (t: number) => {
      if (!state.videoUrl) return;
      const want = state.seekFrame !== undefined ? state.seekFrame / state.fps : Math.max(0, (t - state.clipAt) / 1000);
      const target = Math.min(want, (v.duration || 10) - 0.05);
      if (Math.abs(v.currentTime - target) > (state.seekFrame !== undefined ? 0.02 : 0.3)) v.currentTime = target;
      const playingClip = player.isPlaying && state.seekFrame === undefined && want < (v.duration || 10);
      if (playingClip && v.paused) void v.play().catch(() => {});
      if (!playingClip && !v.paused) v.pause();
    };
    sync(player.time);
    return player.onTick(sync);
  }, [player, state.videoUrl, state.clipAt, state.seekFrame, state.fps]);

  // burned-in timestamp, frame-exact with requestVideoFrameCallback where available (Safari: timeupdate)
  useEffect(() => {
    const v = video.current;
    if (!v || clipStartMs === null) return setClock("");
    let handle = 0;
    const update = (mediaTime: number) => {
      const t = Math.floor((clipStartMs + mediaTime * 1000) / 1000);
      const hh = Math.floor(t / 3600) % 24, mm = Math.floor(t / 60) % 60, ss = t % 60;
      setClock([hh, mm, ss].map((n) => String(n).padStart(2, "0")).join(":"));
    };
    if (typeof HTMLVideoElement !== "undefined" && "requestVideoFrameCallback" in HTMLVideoElement.prototype) {
      const cb = (_: number, m: VideoFrameCallbackMetadata) => {
        update(m.mediaTime);
        handle = v.requestVideoFrameCallback(cb);
      };
      handle = v.requestVideoFrameCallback(cb);
      update(v.currentTime);
      return () => v.cancelVideoFrameCallback(handle);
    }
    const onT = () => update(v.currentTime);
    v.addEventListener("timeupdate", onT);
    onT();
    return () => v.removeEventListener("timeupdate", onT);
  }, [clipStartMs, state.videoUrl]);

  // mask outline: DrawSVG 300ms → 25% fill 180ms → ID chip springs in
  useEffect(() => {
    if (!locked) return setD("");
    let alive = true;
    maskOutline(locked.maskUrl, run.frame).then((p) => alive && setD(p)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [locked, run.frame]);
  useEffect(() => {
    if (!d || !outline.current) return;
    const { gsap } = getGsap();
    if (prefersReducedMotion()) return;
    const tl = gsap.timeline();
    tl.fromTo(outline.current, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.3, ease: "power2.out" })
      .fromTo(chip.current, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2)" }, 0.48);
    return () => void tl.kill();
  }, [d]);

  const box = (s: Sighting) => ({
    left: `${(s.box[0] / run.frame.w) * 100}%`,
    top: `${(s.box[1] / run.frame.h) * 100}%`,
  });
  const items = run.items.map((i) => i.name).join(" · ");
  const objId = locked ? samObjectId(run, locked) : undefined;
  const flicker = state.searching && state.stream;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative overflow-hidden rounded-[24px] bg-black" style={{ aspectRatio: `${run.frame.w} / ${run.frame.h}` }}>
        {state.videoUrl ? (
          <video
            ref={video} src={state.videoUrl} poster={state.clipId ? `/posters/${state.clipId}.jpg` : undefined} muted playsInline preload="metadata"
            className="absolute inset-0 h-full w-full object-cover" aria-label="Home camera clip"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center t-caption" style={{ background: "var(--surface)" }}>Nothing seen yet. Show Maya something.</div>
        )}
        <svg viewBox={`0 0 ${run.frame.w} ${run.frame.h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          {zone && (
            <polygon points={zone.polygon.map((p) => p.join(",")).join(" ")} fill="color-mix(in srgb, var(--maya-blue) 6%, transparent)" stroke="#fff" strokeOpacity="0.9" strokeDasharray="12 9" strokeWidth="3" />
          )}
          {flicker && state.stream && (
            <g className="candidate-flicker">
              {[0, 1, 2].map((i) => {
                const b = run.events.find((e) => e.type === "perception.done" && e.clipId === state.stream!.clipId);
                const s = b && b.type === "perception.done" ? b.sightings[0] : undefined;
                if (!s) return null;
                const o = (i - 1) * 18;
                return <rect key={i} x={s.box[0] + o} y={s.box[1] - o / 2} width={s.box[2] - s.box[0]} height={s.box[3] - s.box[1]} rx="10" fill="none" stroke="var(--maya-blue)" strokeOpacity="0.6" strokeWidth="2.5" style={{ animationDelay: `${i * 90}ms` }} />;
              })}
            </g>
          )}
          {d && (
            <>
              <path d={d} fill="var(--maya-blue)" className="mask-fill" />
              <path ref={outline} d={d} fill="none" stroke="var(--maya-blue)" strokeWidth="4" strokeLinejoin="round" />
            </>
          )}
        </svg>
        {clock && (
          <span className="t-mono tnum absolute left-3 top-3 rounded-md px-2 py-0.5 text-[13px] font-semibold text-white" style={{ background: "rgb(0 0 0 / 0.45)" }}>
            {clock}
          </span>
        )}
        {!(locked && d) && <span className="chip absolute right-3 top-3 !h-7 !text-[12px]" style={{ background: "var(--glass)" }}>Watching for: {items}</span>}
        {flicker && <span className={`chip chip-blue absolute bottom-3 ${locked && (locked.box[0] + locked.box[2]) / 2 > run.frame.w / 2 ? "right-3" : "left-3"}`}>Searching memory…</span>}
        {locked && d && (
          <span ref={chip} className={`chip chip-blue absolute tnum ${locked.box[1] / run.frame.h < 0.3 ? "" : "-translate-y-[130%]"}`} style={locked.box[1] / run.frame.h < 0.3 ? { left: box(locked).left, top: `${(locked.box[3] / run.frame.h) * 100 + 2}%` } : box(locked)}>
            {[run.items.find((i) => i.id === locked.itemId)?.name ?? locked.itemId, objId !== undefined && `#${objId}`, locked.conf.toFixed(2)].filter(Boolean).join(" · ")}
          </span>
        )}
        {locked && d && <ZoomInset video={video} sighting={locked} d={d} frame={run.frame} fps={state.fps} />}
        {zone && state.zoneLit && (
          <span className="chip absolute" style={{ left: `${(zone.polygon[0][0] / run.frame.w) * 100}%`, top: `${(zone.polygon[2][1] / run.frame.h) * 100}%`, transform: "translateY(6px)" }}>
            {zone.name}
          </span>
        )}
        {state.showTime && locked && (
          <span className="time-drop t-mono tnum absolute rounded-full px-3 py-1 text-[15px] font-semibold" style={{ ...box(locked), transform: "translate(0, -260%)", background: "var(--canvas)", color: "var(--ink)" }}>
            {homeClock(locked.t)}
          </span>
        )}
      </div>
      <div>
        <p className="t-caption mb-2">Today&apos;s sightings</p>
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {state.sightings.length === 0 && <li className="t-caption">Nothing seen yet.</li>}
          {state.sightings.map((s) => {
            const item = run.items.find((i) => i.id === s.itemId);
            return (
              <li key={s.id} className={`flex shrink-0 items-center gap-2 rounded-[12px] border p-1.5 pr-3 ${locked?.id === s.id ? "border-[var(--maya-blue)]" : ""}`} style={{ borderColor: locked?.id === s.id ? "var(--maya-blue)" : "var(--hairline)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {item && <img src={item.enrolCropUrl} alt="" width={48} height={28} className="h-7 w-12 rounded-md object-cover" />}
                <span className="t-caption tnum !text-[12px]">{item?.name} · {homeClock(s.t)}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <MemoryPanel run={run} state={state} />
    </div>
  );
}

const STATE_LABEL: Record<string, string> = { SEEN: "seen", ON_PERSON: "on person", PICKED_UP: "picked up", LAST_SEEN: "last seen", MOVED: "moved" };

/** What Maya's memory holds right now: one row per item, straight from memory.state and perception.done. */
function MemoryPanel({ run, state }: { run: Run; state: TheatreState["camera"] }) {
  const rows = run.items.flatMap((item) => {
    const m = state.memory[item.id];
    const s = m && (state.sightings.find((x) => x.id === m.sightingId) ?? findIn(run, m.sightingId));
    return m && s ? [{ item, m, s }] : [];
  });
  return (
    <div className="rounded-[16px] border p-3" style={{ borderColor: "var(--hairline)", background: "var(--canvas)" }}>
      <p className="t-caption mb-2">Memory · <span className="t-mono !text-[11px]">memory.state</span></p>
      {rows.length === 0 ? (
        <p className="t-caption">Empty until SAM reports a sighting.</p>
      ) : (
        <table className="w-full text-left text-[13px] tnum">
          <thead className="t-caption !text-[11px]">
            <tr><th className="pb-1 font-medium">Item</th><th className="pb-1 font-medium">State</th><th className="pb-1 font-medium">Where</th><th className="pb-1 font-medium">Time</th><th className="pb-1 text-right font-medium">Conf</th></tr>
          </thead>
          <tbody>
            {rows.map(({ item, m, s }) => (
              <tr key={item.id} className="border-t" style={{ borderColor: "var(--hairline)", color: "var(--ink)" }}>
                <td className="py-1.5 font-medium">{item.name}</td>
                <td className="py-1.5">{STATE_LABEL[m.state] ?? m.state}{s.overlapsPerson ? " · near person" : ""}</td>
                <td className="py-1.5">{run.zones.find((z) => z.id === s.zoneId)?.name ?? "outside a zone"}</td>
                <td className="t-mono py-1.5">{homeClock(s.t)}</td>
                <td className="t-mono py-1.5 text-right">{s.conf.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {state.sam && (
        <p className="t-caption mt-2 !text-[12px] tnum">
          Last SAM 3.1 pass: {state.sam.sightings} sightings · {(state.sam.ms / 1000).toFixed(1)} s · ${state.sam.usd.toFixed(3)}
        </p>
      )}
    </div>
  );
}

function findIn(run: Run, id: string): Sighting | undefined {
  for (const e of run.events) if (e.type === "perception.done") for (const s of e.sightings) if (s.id === id) return s;
  return undefined;
}

const INSET = 0.34;

/** Live crop of the camera around a sighting with its real SAM mask outline: small objects are a few dozen pixels in 1080p. */
function ZoomInset({ video, sighting, d, frame, fps }: { video: React.RefObject<HTMLVideoElement | null>; sighting: Sighting; d: string; frame: Run["frame"]; fps: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const W = 320, H = 240;
  const [x1, y1, x2, y2] = sighting.box;
  const side = Math.max(160, (x2 - x1) * 2.6, ((y2 - y1) * 2.6 * W) / H);
  const cw = Math.min(side, frame.w), ch = (cw * H) / W;
  const cx = Math.min(Math.max((x1 + x2) / 2 - cw / 2, 0), frame.w - cw);
  const cy = Math.min(Math.max((y1 + y2) / 2 - ch / 2, 0), frame.h - ch);
  const zoom = W / cw;
  const left = (x1 + x2) / 2 > frame.w / 2; // sit on the far side from the object
  const mag = (INSET * frame.w) / cw; // relative to the main view
  useEffect(() => {
    const v = video.current, c = canvas.current;
    const g = c?.getContext("2d");
    if (!v || !c || !g) return;
    const path = new Path2D(d);
    const blue = getComputedStyle(c).getPropertyValue("--maya-blue").trim() || "#0064e0";
    const draw = () => {
      if (v.readyState < 2) return;
      const sx = v.videoWidth / frame.w;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(v, cx * sx, cy * sx, cw * sx, ch * sx, 0, 0, W, H);
      g.setTransform(zoom, 0, 0, zoom, -cx * zoom, -cy * zoom);
      g.globalAlpha = 0.22;
      g.fillStyle = blue;
      g.fill(path);
      g.globalAlpha = 1;
      g.lineWidth = 2.5 / zoom;
      g.strokeStyle = blue;
      g.lineJoin = "round";
      g.stroke(path);
    };
    let handle = 0;
    const rvfc = "requestVideoFrameCallback" in HTMLVideoElement.prototype;
    const loop = () => {
      draw();
      handle = v.requestVideoFrameCallback(loop);
    };
    if (rvfc) handle = v.requestVideoFrameCallback(loop);
    v.addEventListener("seeked", draw);
    v.addEventListener("loadeddata", draw);
    draw();
    return () => {
      if (rvfc) v.cancelVideoFrameCallback(handle);
      v.removeEventListener("seeked", draw);
      v.removeEventListener("loadeddata", draw);
    };
  }, [video, d, frame, cx, cy, cw, ch, zoom]);
  return (
    <figure className={`absolute bottom-3 m-0 overflow-hidden rounded-[12px] border-2 ${left ? "left-3" : "right-3"}`} style={{ width: `${INSET * 100}%`, borderColor: "var(--maya-blue)", background: "#000" }}>
      <canvas ref={canvas} width={W} height={H} className="block h-auto w-full" aria-label={`Zoomed view of the SAM 3.1 mask at frame ${sighting.frame}`} />
      <figcaption className="t-mono tnum absolute bottom-1 left-1.5 rounded px-1 text-[10px] text-white" style={{ background: "rgb(0 0 0 / 0.55)" }}>
        ×{mag.toFixed(0)} · f{sighting.frame} · {(sighting.frame / fps).toFixed(1)}s
      </figcaption>
    </figure>
  );
}
