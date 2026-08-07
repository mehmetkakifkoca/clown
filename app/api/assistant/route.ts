/**
 * app/api/assistant/route.ts
 * Uygulama içi Claude asistanı — POST {messages:[...]} alır, claude-sonnet-5
 * ile tool-use döngüsü çalıştırır, sonucu SSE (text/event-stream) olarak
 * client'a stream eder. Tool tanımları lib/assistant/tools.ts'den (MCP ile
 * ortak) beslenir.
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { anthropicToolDefinitions, executeAssistantTool, toolLabel } from "@/lib/assistant/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Sen Clown uygulamasının asistanısın, Mehmet'in mailleri, notları, görevleri ve takvimi üzerinde çalışırsın.
Elindeki tool'ları kullanarak sorulara Türkçe, kısa ve net cevaplar ver.
Bir işlem yaptığında (mail gönderme, görev oluşturma, etkinlik ekleme/silme gibi) sonucu açıkça belirt.
Emin olmadığın veya geri alınamaz bir işlem (mail gönderme, etkinlik/görev silme) söz konusu olduğunda önce kullanıcıya kısaca teyit ettir.
Bilgi eksikse tahmin yürütmek yerine kullanıcıya sor.`;

const MAX_TOOL_ITERATIONS = 8;

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const clientMessages = body?.messages;
  if (!Array.isArray(clientMessages) || clientMessages.length === 0) {
    return NextResponse.json({ error: "messages alanı gerekli." }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY tanımlı değil." }, { status: 500 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        let messages: Anthropic.MessageParam[] = clientMessages.map((m: any) => ({
          role: m.role,
          content: m.content,
        }));

        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
          const anthropicStream = client.messages.stream({
            model: "claude-sonnet-5",
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools: anthropicToolDefinitions as Anthropic.Tool[],
            messages,
          });

          anthropicStream.on("text", (delta) => {
            send({ type: "text", text: delta });
          });

          const finalMessage = await anthropicStream.finalMessage();
          messages.push({ role: "assistant", content: finalMessage.content });

          if (finalMessage.stop_reason !== "tool_use") {
            send({ type: "done" });
            return;
          }

          const toolUseBlocks = finalMessage.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const toolUse of toolUseBlocks) {
            send({ type: "tool_call", name: toolUse.name, label: toolLabel(toolUse.name) });
            try {
              const result = await executeAssistantTool(toolUse.name, toolUse.input);
              toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
            } catch (err: any) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: `Hata: ${err?.message || "Bilinmeyen hata"}`,
                is_error: true,
              });
            }
          }

          messages.push({ role: "user", content: toolResults });
        }

        send({ type: "error", error: "Çok fazla ardışık tool çağrısı yapıldı, durduruldu." });
      } catch (err: any) {
        send({ type: "error", error: err?.message || "Asistan hatası." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
