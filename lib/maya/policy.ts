// Policy gate (System tab §E): runs before the agent. A deterministic health word list plus a Spark JSON
// classifier; if either flags the utterance, the route is forced to ask_caregiver. Maya never answers health.

export const HEALTH_LEXICON = [
  "medicine", "medication", "meds", "pill", "pills", "tablet", "tablets", "dose", "dosage", "take", "took",
  "vitamin", "vitamins", "prescription", "pain", "hurt", "hurts", "dizzy", "sick", "ill", "fever", "blood",
  "pressure", "sugar", "insulin", "inhaler", "doctor", "nurse", "hospital", "symptom", "symptoms", "headache",
  "chest", "breathe", "breathing", "fall", "fell", "allergy", "allergic", "side effect", "overdose", "drug", "drugs",
  "injection", "ointment", "cough", "medical", "treatment", "heart", "stomach", "nausea", "sleep pill",
];

// Words that look medical but appear in ordinary schedule questions. They do not count on their own.
const SCHEDULE_ONLY = new Set(["doctor", "hospital", "nurse"]);

export function lexiconHits(text: string): string[] {
  const t = ` ${text.toLowerCase().replace(/[^a-z' ]+/g, " ")} `;
  return HEALTH_LEXICON.filter((w) => t.includes(` ${w} `));
}

export interface PolicyVerdict {
  text: string;
  lexiconHits: string[];
  classifier: { health_related: boolean };
  route: "agent" | "ask_caregiver";
}

export function decide(text: string, classifier: { health_related: boolean }): PolicyVerdict {
  const hits = lexiconHits(text);
  const lexiconFlag = hits.some((h) => !SCHEDULE_ONLY.has(h));
  const route = lexiconFlag || classifier.health_related ? "ask_caregiver" : "agent";
  return { text, lexiconHits: hits, classifier, route };
}

export const CLASSIFIER_PROMPT =
  "Classify one sentence said by an older adult to a home companion. health_related is true if it is about " +
  "medicine, pills, vitamins, doses, symptoms, pain, the body, or whether to take or do something for health. " +
  "Asking about the time of an appointment is not health_related. Reply with JSON only.";
