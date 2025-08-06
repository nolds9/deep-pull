/**
 * Simple test script for the leaderboard API
 * Run with: node test-leaderboard.js
 */

const BASE_URL = process.env.BACKEND_URL || "http://localhost:3001";

async function testLeaderboardAPI() {
  console.log("🧪 Testing Leaderboard API...\n");

  try {
    // Test 1: Basic leaderboard query
    console.log("1. Testing basic leaderboard query...");
    const response1 = await fetch(`${BASE_URL}/api/leaderboard`);
    const data1 = await response1.json();
    console.log(`   Status: ${response1.status}`);
    console.log(`   Results: ${data1.leaderboard?.length || 0} entries`);
    console.log(`   Query:`, data1.query);

    // Test 2: Filtered query
    console.log("\n2. Testing filtered leaderboard query...");
    const response2 = await fetch(
      `${BASE_URL}/api/leaderboard?difficulty=easy&limit=5`
    );
    const data2 = await response2.json();
    console.log(`   Status: ${response2.status}`);
    console.log(`   Results: ${data2.leaderboard?.length || 0} entries`);
    console.log(`   Query:`, data2.query);

    // Test 3: User-specific stats (if we have a user ID)
    console.log("\n3. Testing user-specific stats...");
    const testUserId = "test-user-123"; // This would be a real user ID in practice
    const response3 = await fetch(
      `${BASE_URL}/api/leaderboard/user/${testUserId}`
    );
    const data3 = await response3.json();
    console.log(`   Status: ${response3.status}`);
    if (response3.status === 200) {
      console.log(`   User Stats:`, {
        totalGames: data3.totalGames,
        wins: data3.wins,
        winRate: data3.winRate?.toFixed(2) + "%",
        averageDuration: Math.round(data3.averageDuration) + "ms",
      });
    } else {
      console.log(`   Error: ${data3.error}`);
    }

    // Test 4: Invalid parameters
    console.log("\n4. Testing invalid parameters...");
    const response4 = await fetch(
      `${BASE_URL}/api/leaderboard?difficulty=invalid`
    );
    const data4 = await response4.json();
    console.log(`   Status: ${response4.status}`);
    console.log(`   Error: ${data4.error}`);

    console.log("\n✅ Leaderboard API tests completed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the test
testLeaderboardAPI();
