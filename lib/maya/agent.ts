// Agent turn (System tab §E): policy gate → Muse Spark 1.3 (standard tier) with tools → tool results from our
// code → Spark words the reply from those facts. No tool writes reminders. Runs in Node (record, eval) and Workers.
import { CLASSIFIER_PROMPT, decide, type PolicyVerdict } from "./policy.ts";

export const SPARK_MODEL = "muse-spark-1.3"; // never the -contributor tier for home data
const BASE = "https://api.meta.ai/v1";
export const SPARK_USD = { in: 1.25e-6, out: 4.25e-6 };

export type ToolName = "find_object" | "get_day" | "propose_note" | "ask_caregiver" | "play_messages" | "check_in_reply";

const fn = (name: ToolName, description: string, properties: Record<string, unknown>, required: string[] = []) => ({
  type: "function", name, description, strict: true,
  parameters: { type: "object", properties, required, additionalProperties: false },
});

export const TOOLS = [
  fn("find_object", "Where an enrolled object was last seen by the home camera.", { item: { type: "string" } }, ["item"]),
  fn("get_day", "Today's appointments and visits, as entered by the caregiver.", {}),
  fn("propose_note", "Save something Mum said as an UNCONFIRMED note for the caregiver to review. It never becomes a reminder by itself.",
    { item: { type: "string" }, text: { type: "string" } }, ["item", "text"]),
  fn("ask_caregiver", "Send Mum's question to the caregiver. Use for anything about health, medicine or doses.",
    { question: { type: "string" }, about: { type: "string" } }, ["question", "about"]),
  fn("play_messages", "Play the caregiver's voice messages.", {}),
  fn("check_in_reply", "Ask Mum a gentle check-in question and wait for a reply.", { prompt: { type: "string" } }, ["prompt"]),
];

export const SYSTEM = [
  "You are Maya, a calm companion for an older woman living alone. Short, warm, plain sentences. No exclamation marks.",
  "Use tools for every fact. Say only what the tool results say: 'last seen at 7:41', never 'it is there now'.",
  "Never give medical advice. For anything about medicine, pills, doses or symptoms, use propose_note or ask_caregiver and say you will check with Yuki.",
  "Answer repeated questions with the same patience and warmth as the first time. Never point out that she has asked before or that you have already answered.",
  "Reply in at most two sentences.",
].join(" ");

export interface Usage { input_tokens?: number; output_tokens?: number }
export interface TurnLog {
  policy: PolicyVerdict;
  tools: { name: ToolName; args: unknown; result: unknown }[];
  reply: string;
  model: string;
  ms: number;
  usd: number;
  requests: { requestHash: string; ms: number; usd: number }[];
}

async function hash(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function call(key: string, body: Record<string, unknown>, log: TurnLog["requests"]) {
  const t0 = performance.now();
  const s = JSON.stringify({ model: SPARK_MODEL, ...body });
  const r = await fetch(`${BASE}/responses`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: s });
  const j = await r.json();
  if (!r.ok) throw new Error(`spark ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const u: Usage = j.usage || {};
  const usd = (u.input_tokens || 0) * SPARK_USD.in + (u.output_tokens || 0) * SPARK_USD.out;
  log.push({ requestHash: await hash(s), ms: Math.round(performance.now() - t0), usd: +usd.toFixed(6) });
  return j;
}

const textOf = (j: { output?: { type: string; content?: { type: string; text?: string }[] }[]; output_text?: string }) =>
  j.output_text ?? (j.output || []).filter((o) => o.type === "message").flatMap((o) => o.content || []).map((c) => c.text || "").join("").trim();

export async function classify(key: string, text: string, log: TurnLog["requests"] = []): Promise<{ health_related: boolean }> {
  const j = await call(key, {
    input: [{ role: "system", content: CLASSIFIER_PROMPT }, { role: "user", content: text }],
    text: { format: { type: "json_schema", name: "policy", strict: true,
      schema: { type: "object", properties: { health_related: { type: "boolean" } }, required: ["health_related"], additionalProperties: false } } },
  }, log);
  try { return { health_related: !!JSON.parse(textOf(j)).health_related }; } catch { return { health_related: true }; } // fail closed
}

export async function turn(
  key: string, utterance: string,
  runTool: (name: ToolName, args: Record<string, unknown>) => Promise<unknown> | unknown,
): Promise<TurnLog> {
  const t0 = performance.now();
  const requests: TurnLog["requests"] = [];
  const policy = decide(utterance, await classify(key, utterance, requests));
  const tools: TurnLog["tools"] = [];
  const input: unknown[] = [{ role: "system", content: SYSTEM }, { role: "user", content: utterance }];
  // Health routes may only use the two caregiver tools; the gate decides, not the model.
  const allowed = policy.route === "ask_caregiver" ? TOOLS.filter((t) => t.name === "propose_note" || t.name === "ask_caregiver") : TOOLS;
  let reply = "";
  for (let step = 0; step < 3; step++) {
    const j = await call(key, { input, tools: allowed, tool_choice: "auto" }, requests);
    const calls = (j.output || []).filter((o: { type: string }) => o.type === "function_call");
    if (!calls.length) { reply = textOf(j); break; }
    for (const c of calls) {
      const name = c.name as ToolName;
      const args = JSON.parse(c.arguments || "{}");
      const result = allowed.some((t) => t.name === name) ? await runTool(name, args) : { error: "tool not allowed by policy" };
      tools.push({ name, args, result });
      input.push(c, { type: "function_call_output", call_id: c.call_id, output: JSON.stringify(result) });
    }
  }
  // The gate, not the model, guarantees the caregiver route: if Spark used no caregiver tool, code sends it.
  if (policy.route === "ask_caregiver" && !tools.some((t) => t.name === "ask_caregiver" || t.name === "propose_note")) {
    const args = { question: utterance, about: "health" };
    tools.push({ name: "ask_caregiver", args, result: await runTool("ask_caregiver", args) });
    reply = "I'll ask Yuki.";
  }
  const usd = requests.reduce((s, r) => s + r.usd, 0);
  return { policy, tools, reply, model: SPARK_MODEL, ms: Math.round(performance.now() - t0), usd: +usd.toFixed(6), requests };
}
