import { AppDataSource } from "../config";
import { PlayerConnection } from "../entity/PlayerConnection";

export class PathfindingService {
  async findShortestPath(
    startPlayerId: string,
    endPlayerId: string
  ): Promise<string[]> {
    const connectionRepo = AppDataSource.getRepository(PlayerConnection);
    const queue: Array<{ playerId: string; path: string[] }> = [
      { playerId: startPlayerId, path: [startPlayerId] },
    ];
    const visited = new Set<string>([startPlayerId]);

    while (queue.length > 0) {
      const { playerId, path } = queue.shift()!;
      if (playerId === endPlayerId) {
        return path;
      }
      // Get all connections for current player
      const connections = await connectionRepo.find({
        where: [{ player1_id: playerId }, { player2_id: playerId }],
      });
      for (const connection of connections) {
        const nextPlayerId =
          connection.player1_id === playerId
            ? connection.player2_id
            : connection.player1_id;
        if (!visited.has(nextPlayerId)) {
          visited.add(nextPlayerId);
          queue.push({
            playerId: nextPlayerId,
            path: [...path, nextPlayerId],
          });
        }
      }
    }
    return [];
  }
}
