import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { assertAiBudget, recordAiUsage, type AiFeature } from "@/lib/ai/usage";

let client: Anthropic | null = null;
const getClient = () => client ??= new Anthropic({ maxRetries: 2, timeout: 60_000 });

export class AiRefusalError extends Error {}

type StructuredCall<T extends z.ZodType> = {
  /** null for shared work that is not attributable to one user (job fact extraction). */
  userId: string | null;
  feature: AiFeature;
  model: string;
  system: string;
  /** Untrusted text (CVs, job descriptions) belongs in `data`; it is wrapped so it cannot be mistaken for instructions. */
  instruction: string;
  data: Record<string, unknown>;
  schema: T;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
};

/**
 * One metered, schema-validated model call. Thinking is left at the model default (Sonnet 5.5 cannot disable it)
 * and sampling parameters are never sent (Haiku 5.5 / Sonnet 5.5 reject non-default values).
 */
export async function runStructured<T extends z.ZodType>(call: StructuredCall<T>): Promise<z.infer<T>> {
  await assertAiBudget(call.userId, call.feature);
  const response = await getClient().messages.parse({
    model: call.model,
    max_tokens: call.maxTokens ?? 8000,
    system: call.system,
    messages: [{ role: "user", content: `${call.instruction}\n\n<data>\n${JSON.stringify(call.data)}\n</data>` }],
    output_config: { effort: call.effort ?? "medium", format: zodOutputFormat(call.schema) },
  });
  await recordAiUsage(call.userId, call.feature, call.model, {
    inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0, cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
  });
  if (response.stop_reason === "refusal") throw new AiRefusalError("The model declined this request");
  if (!response.parsed_output) throw new Error(`AI response did not match the expected schema (stop_reason: ${response.stop_reason})`);
  return response.parsed_output;
}
