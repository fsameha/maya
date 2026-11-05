import type { MayaSource } from "../contract";

export class NotWiredYet extends Error {
  constructor(what: string) {
    super(`${what} is not wired yet: the backend agent implements the live source.`);
    this.name = "NotWiredYet";
  }
}

/** Live source stub. The backend agent replaces this with the Durable Object WebSocket (System tab §H). */
export function createLiveSource(): MayaSource {
  return {
    async loadRun() { throw new NotWiredYet("Live loadRun"); },
    subscribe() { throw new NotWiredYet("Live subscribe"); },
    async teach() { throw new NotWiredYet("Live teach"); },
    async ask() { throw new NotWiredYet("Live ask"); },
  };
}
