//Główny pipeline

const fs = require("fs");
//const fetch = require("node-fetch");

const TOKENS = JSON.parse(process.env.TOKENS_JSON);

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

async function refreshAccessToken(refreshToken) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  const data = await res.json();
  return data.access_token;
}

//Pobieranie aktywności

async function getActivities(user) {
  try {
    const accessToken = await refreshAccessToken(user.refresh_token);

    const res = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=100", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const activities = await res.json();

    console.log(`📊 ${user.name}: ${activities.length} activities`);

    return activities.map(a => ({
      id: a.id,
      name: user.name,
      athleteId: user.athleteId,
      distance: a.distance,
      date: a.start_date,
      location:
        a.start_city ||
        a.start_town ||
        a.start_latlng?.join(",") ||
        null
    }));

  } catch (err) {
    console.error(`❌ ${user.name} ERROR`, err);
    return [];
  }
}

//Główne wykonanie

(async () => {
  try {
    let allActivities = [];

    for (const user of TOKENS) {
      const activities = await getActivities(user);

      allActivities = allActivities.concat(activities);

      // 🔥 throttle (ważne!)
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`✅ TOTAL ACTIVITIES: ${allActivities.length}`);
	
const seen = new Map();
    const duplicates = [];

    allActivities.forEach(a => {
      const key = `${a.athleteId}-${a.distance}-${a.date}`;

      if (seen.has(key)) {
        duplicates.push(a);
      } else {
        seen.set(key, true);
      }
    });

    console.log(`⚠️ DUPLICATES: ${duplicates.length}`);
	
	const outside = allActivities.filter(a => {
      return a.location && !a.location.includes("Wrocław");
    });

    console.log(`✅ OUTSIDE: ${outside.length}`);
	
	fs.writeFileSync("data.json", JSON.stringify(allActivities, null, 2));
    fs.writeFileSync("duplicates.json", JSON.stringify(duplicates, null, 2));
    fs.writeFileSync("outside.json", JSON.stringify(outside, null, 2));

    console.log("✅ data.json + duplicates.json + outside.json updated");

  } catch (err) {
    console.error("❌ GLOBAL ERROR:", err);
  }
})();
