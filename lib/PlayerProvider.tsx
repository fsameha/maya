"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { MayaEvent, Run } from "./contract";
import { Player } from "./player";
import { getSource } from "./source";
import { runUsesPlaceholders } from "./source/fixture";

interface PlayerCtx { player: Player | null; run: Run | null; error: Error | null; placeholder: boolean }
const Ctx = createContext<PlayerCtx>({ player: null, run: null, error: null, placeholder: false });

/** One React context per page that plays a run (PRD §14). */
export function PlayerProvider({ runId, children }: { runId: string; children: ReactNode }) {
  const [state, setState] = useState<PlayerCtx>({ player: null, run: null, error: null, placeholder: false });
  useEffect(() => {
    let p: Player | null = null;
    let alive = true;
    getSource("fixture")
      .loadRun(runId)
      .then((run) => {
        if (!alive) return;
        p = new Player(run);
        setState({ player: p, run, error: null, placeholder: runUsesPlaceholders(run) });
      })
      .catch((error: Error) => alive && setState((s) => ({ ...s, error })));
    return () => {
      alive = false;
      p?.destroy();
    };
  }, [runId]);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const usePlayerCtx = () => useContext(Ctx);

/** Re-render on play/pause/speed/seek. */
export function usePlayerState(player: Player | null) {
  return useSyncExternalStore(
    (cb) => (player ? player.onState(cb) : () => {}),
    () => (player ? `${player.isPlaying}|${player.speed}|${player.chapterAt()?.n}` : ""),
    () => "",
  );
}

/**
 * Fold the player's events into pane state. A backward seek resets to `init` and
 * the engine replays from t=0, so the state is always identical for a given time.
 */
export function useEventState<S>(player: Player | null, init: () => S, step: (s: S, e: MayaEvent, replay: boolean) => S): S {
  const [s, setS] = useState<S>(init);
  useEffect(() => {
    if (!player) return;
    let cur = init();
    let pending = false;
    const commit = () => {
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        setS(cur);
      });
    };
    const offReset = player.onReset(() => {
      cur = init();
      commit();
    });
    const off = player.on((e, { replay }) => {
      cur = step(cur, e, replay);
      commit();
    });
    // catch up if the player already advanced
    for (const e of player.events) {
      if (e.at > player.time) break;
      cur = step(cur, e, true);
    }
    commit();
    return () => {
      off();
      offReset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);
  return s;
}
