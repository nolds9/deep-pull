import { AppDataSource } from "../config";
import { PlayerConnection } from "../entity/PlayerConnection";
import { In } from "typeorm";
import { Player } from "../entity/Player";

export class PathfindingService {
  async findShortestPath(
    startPlayerId: string,
    endPlayerId: string
  ): Promise<string[]> {
    const results = await this.findShortestPaths(startPlayerId, endPlayerId, 1);
    return results[0] || [];
  }

  async findShortestPaths(
    startPlayerId: string,
    endPlayerId: string,
    limit: number
  ): Promise<string[][]> {
    const query = `
      WITH RECURSIVE search_graph(start_node, end_node, path, depth) AS (
          -- Anchor: direct connections from the start player
          SELECT
              player1_id,
              player2_id,
              ARRAY[player1_id, player2_id],
              1
          FROM player_connections
          WHERE player1_id = $1
        UNION
          SELECT
              player2_id,
              player1_id,
              ARRAY[player2_id, player1_id],
              1
          FROM player_connections
          WHERE player2_id = $1

        UNION ALL

          -- Recursive step: join with next connections
          SELECT
              sg.start_node,
              c.player2_id,
              sg.path || c.player2_id,
              sg.depth + 1
          FROM search_graph sg
          JOIN player_connections c ON sg.end_node = c.player1_id
          WHERE NOT c.player2_id = ANY(sg.path) AND sg.depth < 5 -- Avoid cycles and limit depth
        UNION ALL
          SELECT
              sg.start_node,
              c.player1_id,
              sg.path || c.player1_id,
              sg.depth + 1
          FROM search_graph sg
          JOIN player_connections c ON sg.end_node = c.player2_id
          WHERE NOT c.player1_id = ANY(sg.path) AND sg.depth < 5 -- Avoid cycles and limit depth
      )
      SELECT path FROM search_graph
      WHERE end_node = $2
      LIMIT $3;
    `;

    const results = await AppDataSource.query(query, [
      startPlayerId,
      endPlayerId,
      limit,
    ]);
    return results.map((row: { path: string[] }) => row.path);
  }

  async validatePath(
    path: string[],
    startId: string,
    endId: string
  ): Promise<boolean> {
    if (path.length < 2) return false;
    if (path[0] !== startId || path[path.length - 1] !== endId) return false;

    const connectionRepo = AppDataSource.getRepository(PlayerConnection);
    const connectionChecks = [];

    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      connectionChecks.push(
        connectionRepo.findOne({
          where: [
            { player1_id: p1, player2_id: p2 },
            { player1_id: p2, player2_id: p1 },
          ],
        })
      );
    }

    const results = await Promise.all(connectionChecks);
    return results.every((connection) => connection !== null);
  }

  async convertIdsToNames(paths: string[][]): Promise<string[][]> {
    if (!paths || paths.length === 0) {
      return [];
    }
    const playerRepo = AppDataSource.getRepository(Player);
    const allIds = [...new Set(paths.flat())];
    const players = await playerRepo.findBy({ id: In(allIds) });
    const idToNameMap = new Map(players.map((p) => [p.id, p.name]));
    return paths.map((path) => path.map((id) => idToNameMap.get(id) || id));
  }
}
