import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { assertAiBudget, recordAiUsage, type AiFeature, type TokenUsage } from "@/lib/ai/usage";

let client: Anthropic | null = null;
const getClient = () => client ??= new Anthropic({ maxRetries: 2, timeout: 60_000 });

export class AiRefusalError extends Error {}

type StructuredCall<T extends z.ZodType> = {
  /** null for shared work that is not attributable to one user (job fact extraction). */
  userId: string | null;
  feature: AiFeature;
  model: string;
  system: string;
  /** Stable per-user context placed after `system` and marked cacheable, so repeated calls for one user hit the prompt cache. */
  cachedSystem?: string;
  /** Untrusted text (CVs, job descriptions) belongs in `data`; it is wrapped so it cannot be mistaken for instructions. */
  instruction?: string;
  data?: Record<string, unknown>;
  /** Pre-built user message for prompts that structure their own input blocks; the caller must keep untrusted text inside delimiters. */
  content?: string;
  schema: T;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
};

/**
 * One metered, schema-validated model call. Thinking is left at the model default (Sonnet 5.5 cannot disable it)
 * and sampling parameters are never sent (Haiku 5.5 / Sonnet 5.5 reject non-default values).
 */
export async function runStructuredWithUsage<T extends z.ZodType>(call: StructuredCall<T>): Promise<{ output: z.infer<T>; usage: Required<TokenUsage>; costMicroUsd: number }> {
  await assertAiBudget(call.userId, call.feature);
  const content = call.content ?? `${call.instruction ?? ""}\n\n<data>\n${JSON.stringify(call.data ?? {})}\n</data>`;
  const response = await getClient().messages.parse({
    model: call.model,
    max_tokens: call.maxTokens ?? 8000,
    system: call.cachedSystem
      ? [{ type: "text" as const, text: call.system }, { type: "text" as const, text: call.cachedSystem, cache_control: { type: "ephemeral" as const } }]
      : call.system,
    messages: [{ role: "user", content }],
    output_config: { effort: call.effort ?? "medium", format: zodOutputFormat(call.schema) },
  });
  const usage = {
    inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0, cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
  };
  const costMicroUsd = await recordAiUsage(call.userId, call.feature, call.model, usage);
  if (response.stop_reason === "refusal") throw new AiRefusalError("The model declined this request");
  if (!response.parsed_output) throw new Error(`AI response did not match the expected schema (stop_reason: ${response.stop_reason})`);
  return { output: response.parsed_output, usage, costMicroUsd };
}

export async function runStructured<T extends z.ZodType>(call: StructuredCall<T>): Promise<z.infer<T>> {
  return (await runStructuredWithUsage(call)).output;
}
