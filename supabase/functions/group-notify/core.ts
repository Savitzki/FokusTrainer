import { readLimitedJson } from "../_shared/request-json.ts";

type Dependencies = {
  authorize: () => Promise<string | null>;
  enqueue: (
    workoutId: string,
    groupIds: string[],
  ) => Promise<{ queued: number; already_sent: number; recipients: number }>;
  deliver: (
    userId: string,
  ) => Promise<{ sent: number; retry: number; expired: number }>;
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function notify(
  request: Request,
  deps: Dependencies,
): Promise<Response> {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: cors });
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return reply({ error: "Method not allowed" }, 405);
  }
  try {
    if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
      return reply({ error: "Unauthorized" }, 401);
    }
    const userId = await deps.authorize();
    if (!userId) return reply({ error: "Unauthorized" }, 401);
    let body;
    try {
      body = await readLimitedJson(request, 4000) as {
        workout_id?: unknown;
        group_ids?: unknown;
      } | null;
    } catch {
      return reply({ error: "Invalid request" }, 400);
    }
    if (
      typeof body?.workout_id !== "string" || !uuid.test(body.workout_id) || !Array.isArray(body.group_ids) ||
      body.group_ids.length < 1 || body.group_ids.length > 20 ||
      !body.group_ids.every((id: unknown) =>
        typeof id === "string" && uuid.test(id)
      ) || new Set(body.group_ids).size !== body.group_ids.length
    ) return reply({ error: "Invalid request" }, 400);
    const queued = await deps.enqueue(body.workout_id, body.group_ids);
    try {
      const result = await deps.deliver(userId);
      return reply({ ...queued, ...result });
    } catch {
      return reply(
        { ...queued, sent: 0, retry: queued.queued, delayed: true },
        202,
      );
    }
  } catch (error) {
    if (
      ["PGRST202", "42883", "42P01"].includes(
        (error as { code?: string })?.code ?? "",
      )
    ) {
      return reply({
        error:
          "Os avisos de grupo ainda precisam ser ativados pelo responsável pelo app.",
      }, 503);
    }
    return reply({
      error:
        "Não foi possível preparar o aviso. Confira se o grupo e o treino estão confirmados e tente novamente.",
    }, 400);
  }
}
