import { getBackendClient } from "./backend";
export type GroupNotifyResult = {
  queued: number;
  already_sent: number;
  recipients: number;
  sent: number;
  retry?: number;
  delayed?: boolean;
};
export async function sendGroupWorkoutNotice(
  workoutId: string,
  groupIds: string[],
): Promise<GroupNotifyResult> {
  const client = await getBackendClient();
  if (!client) throw new Error("Entre na sua conta para avisar o grupo.");
  const { data, error } = await client.functions.invoke("group-notify", {
    body: { workout_id: workoutId, group_ids: groupIds },
    signal: AbortSignal.timeout(20000),
  });
  if (error) {
    const response = error.context instanceof Response ? error.context : null;
    if (response?.status === 404 || response?.status === 503)
      throw new Error(
        "Os avisos de grupo ainda precisam ser ativados pelo responsável pelo app. Seu treino continua salvo.",
      );
    if (response?.status === 401)
      throw new Error(
        "Entre novamente na conta para avisar o grupo. Seu treino continua salvo.",
      );
    if (response?.status === 400)
      throw new Error(
        "Confira se o treino já confirmou online e se os grupos continuam ativos. Atualize Juntos e tente novamente. Seu treino continua salvo.",
      );
    throw new Error(
      "Não foi possível enviar agora. Confira a conexão e tente novamente. Seu treino continua salvo.",
    );
  }
  if (
    !data ||
    ![data.queued, data.already_sent, data.recipients, data.sent].every(
      (n) => Number.isInteger(n) && n >= 0,
    )
  )
    throw new Error(
      "Não foi possível confirmar o envio. Tente novamente; o mesmo aviso não será duplicado.",
    );
  return data as GroupNotifyResult;
}
