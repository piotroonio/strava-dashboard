const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// <-- WSTAW REFRESH TOKEN ANETY
const REFRESH_TOKEN = "babf41bf358bf1ab81ca066bb7cdd43254a7af21";

async function getAccessToken() {
  const response = await fetch(
    "https://www.strava.com/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    }
  );

const data = await response.json();

console.log("Token response:");
console.log(JSON.stringify(data, null, 2));

if (!response.ok) {
    process.exit(1);
}

if (data.athlete) {
    console.log(
        `Athlete: ${data.athlete.firstname} ${data.athlete.lastname}`
    );
}

  return data.access_token;
}

async function getActivities(token) {
  let page = 1;
  const all = [];

  while (true) {
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const activities = await response.json();

    console.log(
      `strona ${page}: ${activities.length}`
    );

    if (!activities.length) {
      break;
    }

    all.push(...activities);
    page++;
  }

  return all;
}

(async () => {
  const token = await getAccessToken();

  const activities =
    await getActivities(token);

  console.log(
    `\nPobrano ${activities.length} aktywności`
  );

  const monthly = {};
  const byType = {};

  let totalRide = 0;
  let totalAll = 0;

  for (const a of activities) {

    const distance =
      a.distance / 1000;

    totalAll += distance;

    if (a.type === "Ride") {
      totalRide += distance;
    }

    const month =
      a.start_date_local.substring(0, 7);

    if (!monthly[month]) {
      monthly[month] = {
        count: 0,
        distance: 0,
      };
    }

    monthly[month].count++;
    monthly[month].distance += distance;

    if (!byType[a.type]) {
      byType[a.type] = {
        count: 0,
        distance: 0,
      };
    }

    byType[a.type].count++;
    byType[a.type].distance += distance;
  }

  console.log(
    `\nŁączny dystans: ${totalAll.toFixed(1)} km`
  );

  console.log(
    `Ride only:       ${totalRide.toFixed(1)} km`
  );

  console.log("\n=== WG TYPU ===");

  Object.keys(byType)
    .sort()
    .forEach(type => {
      console.log(
        `${type.padEnd(15)} | ${
          byType[type].count
        } | ${
          byType[type].distance.toFixed(1)
        } km`
      );
    });

  console.log("\n=== MIESIĘCZNIE ===");

  Object.keys(monthly)
    .sort()
    .forEach(month => {
      console.log(
        `${month} | ${
          monthly[month].count
        } | ${
          monthly[month].distance.toFixed(1)
        } km`
      );
    });

  console.log("\n=== OSTATNIE 50 AKTYWNOŚCI ===");

  activities
    .slice(0, 50)
    .forEach(a => {
      console.log(
        `${a.start_date_local.substring(0,10)} | ` +
        `${a.type} | ` +
        `${(a.distance / 1000).toFixed(1)} km | ` +
        `${a.name}`
      );
    });
})();
