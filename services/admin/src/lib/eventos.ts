import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { dynamo, llaves, TABLA } from "./dynamo.js";

/**
 * Avisar al panel del taller de que pasó algo.
 *
 * Se manda un aviso corto, no el pedido: el navegador lo recibe y recarga su
 * lista por la API de siempre. Mandar los datos por aquí duplicaría las reglas
 * de qué ve cada taller en un segundo camino, y dos caminos con las mismas
 * reglas es como acaban divergiendo.
 */

const ENDPOINT = process.env.KUSTTO_WS_ENDPOINT ?? "";

/**
 * El cliente se crea una vez por contenedor, pero sólo si hay endpoint: sin
 * él, avisar es una operación que no existe y la Lambda tiene que seguir
 * funcionando igual.
 */
const api = ENDPOINT
  ? new ApiGatewayManagementApiClient({ endpoint: ENDPOINT })
  : null;

export type AvisoAlTaller =
  | { tipo: "pedido-nuevo"; pedidoId: string; folio: string }
  | { tipo: "pedido-movido"; pedidoId: string; estado: string };

/**
 * NUNCA lanza.
 *
 * Esto corre después de que el pedido ya está escrito y cobrado de cara al
 * cliente. Si el aviso falla —no hay endpoint, la conexión murió, API Gateway
 * hipa— el pedido sigue siendo válido y el taller lo verá igual: al entrar al
 * panel, o cuando reconecte. Tumbar la creación de un pedido por una
 * notificación sería cambiar algo que importa por algo que no.
 */
export async function avisarAlTaller(
  proveedorId: string,
  aviso: AvisoAlTaller,
): Promise<void> {
  if (!api) return;

  try {
    const { Items } = await dynamo.send(
      new QueryCommand({
        TableName: TABLA,
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: {
          ":pk": llaves.conexionesDeProveedor(proveedorId, "").gsi1pk,
        },
      }),
    );

    const conexiones = Items ?? [];
    if (conexiones.length === 0) return;

    const cuerpo = Buffer.from(JSON.stringify(aviso));

    // En paralelo y sin cortar: que una conexión muerta no impida avisarle a
    // las demás, que es justo el caso con varias pestañas abiertas.
    await Promise.all(
      conexiones.map(async (conexion) => {
        const connectionId = String(conexion.connectionId ?? "");
        if (!connectionId) return;

        try {
          await api.send(
            new PostToConnectionCommand({
              ConnectionId: connectionId,
              Data: cuerpo,
            }),
          );
        } catch (error) {
          // 410 Gone: el navegador se fue sin que llegara el $disconnect. Es
          // el momento de limpiar el apunte, no dejarlo hasta que expire.
          const status = (error as { $metadata?: { httpStatusCode?: number } })
            ?.$metadata?.httpStatusCode;

          if (status === 410) {
            await dynamo
              .send(
                new DeleteCommand({
                  TableName: TABLA,
                  Key: llaves.conexion(connectionId),
                }),
              )
              .catch(() => {});
          }
        }
      }),
    );
  } catch (error) {
    console.error("No pudimos avisar al taller:", error);
  }
}
