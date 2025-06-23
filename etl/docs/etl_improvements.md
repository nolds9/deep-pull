# ETL Future Improvements

This document outlines potential improvements for the ETL pipeline to enhance data accuracy and functionality.

## 1. Accurate Team Leader Stats for Mid-Season Trades

### The Issue

The current ETL pipeline uses `nfl.import_seasonal_data()` to calculate team leaders. This function aggregates a player's stats for an entire season and assigns them to their most recent team (`recent_team`). This causes inaccuracies when a player is traded mid-season.

**Example:**
If a player starts the season with the Carolina Panthers and is traded to the San Francisco 49ers, all of their statistics for that season (including those from their time with the Panthers) are attributed to the 49ers. This inflates the 49ers' team stats and incorrectly leaves the Panthers with a data gap for that player.

### The Solution

The `nfl-data-py` library provides a more granular function, `nfl.import_weekly_data()`, which is the ideal solution. This function returns player stats on a per-week basis, correctly associating each performance with the team the player was on during that specific week.

### Implementation Steps

To resolve this, the following changes should be made to `etl/mvp_pipeline.py`:

1.  **Switch to Weekly Data Fetching**:

    - In the `run_mvp_etl` method, replace the call to `nfl.import_seasonal_data()` with `nfl.import_weekly_data()`. This should be done for all years in the pipeline's scope.

2.  **Aggregate Stats for Team Leaders**:

    - Create a new DataFrame specifically for team leader calculations by grouping the weekly data by `player_id`, `season`, and `team`.
    - Sum the statistics for each group. This will produce an accurate seasonal stats table where player performance is correctly attributed to each team they played for within a season.
    - Pass this new, accurate DataFrame to the `_calculate_and_load_team_season_leaders` function.

3.  **Aggregate Stats for Overall Player Performance**:
    - For the `player_seasonal_stats` table, which tracks a player's total performance for a season regardless of team, the weekly data should be grouped by just `player_id` and `season` before being summed.
    - This aggregated data should then be passed to the `extract_and_load_seasonal_stats` function.

By implementing these changes, the ETL pipeline will provide a much more accurate and reliable dataset for all future game modes.
