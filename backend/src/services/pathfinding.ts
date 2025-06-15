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
      WITH RECURSIVE search_graph(end_node, path, depth) AS (
        -- Anchor: The starting player
        SELECT
            $1::varchar as end_node,
            ARRAY[$1::varchar] as path,
            0 as depth
        
        UNION ALL

        -- Recursive step: find next connections
        SELECT
            CASE
                WHEN sg.end_node = c.player1_id THEN c.player2_id
                ELSE c.player1_id
            END,
            sg.path || CASE
                WHEN sg.end_node = c.player1_id THEN c.player2_id
                ELSE c.player1_id
            END,
            sg.depth + 1
        FROM search_graph sg
        JOIN player_connections c ON sg.end_node = c.player1_id OR sg.end_node = c.player2_id
        WHERE NOT (CASE WHEN sg.end_node = c.player1_id THEN c.player2_id ELSE c.player1_id END) = ANY(sg.path) -- Avoid cycles
          AND sg.depth < 5 -- Limit depth
      )
      SELECT path FROM search_graph
      WHERE end_node = $2 AND depth > 0 -- Find paths that reached the end node
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
