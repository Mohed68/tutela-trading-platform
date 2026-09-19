import type OpenAI from "openai";
import { getOpenAIClient } from "../services/openaiClient.js";
import type { IntelligenceProvider } from "./foundation.js";

type ChatClient=Pick<OpenAI,"chat">;
export function createOpenAiIntelligenceProvider(client:ChatClient=getOpenAIClient()):IntelligenceProvider{return Object.freeze({providerId:"openai",async generate(input:Parameters<IntelligenceProvider["generate"]>[0]){const response=await client.chat.completions.create({model:input.model,messages:[{role:"system",content:input.systemPrompt},{role:"user",content:input.input}],response_format:{type:"json_object"},temperature:0});const content=response.choices[0]?.message?.content;if(!content)throw new Error("EMPTY_AI_OUTPUT");return {output:JSON.parse(content),usage:{inputTokens:response.usage?.prompt_tokens,outputTokens:response.usage?.completion_tokens}}}})}
