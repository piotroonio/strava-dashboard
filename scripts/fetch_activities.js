const fs = require("fs");

const ATHLETE_ID =
  Number(
    process.env.STRAVA_PERSONAL_ATHLETE_ID
  );

const REFRESH_TOKEN =
  process.env.STRAVA_PERSONAL_REFRESH_TOKEN;

async function getAccessToken() {

  const tokenRes = await fetch(
    "https://www.strava.com/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id:
          process.env.STRAVA_CLIENT_ID,

        client_secret:
          process.env.STRAVA_CLIENT_SECRET,

        refresh_token:
          REFRESH_TOKEN,

        grant_type:
          "refresh_token"
      })
    }
  );

  const tokenData =
    await tokenRes.json();

  if (!tokenData.access_token) {

    console.error(tokenData);

    process.exit(1);
  }

  return tokenData.access_token;
}

async function verifyAthlete(
  accessToken
) {

  const athleteRes =
    await fetch(
      "https://www.strava.com/api/v3/athlete",
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`
        }
      }
    );

  const athlete =
    await athleteRes.json();

  if (
    athlete.id !== ATHLETE_ID
  ) {

    throw new Error(
      `Unexpected athlete: ${athlete.id}`
    );
  }

  console.log(
    `✅ Athlete verified: ${athlete.firstname} ${athlete.lastname}`
  );
}

async function getAllActivities(
  accessToken
) {

  const activities = [];

  let page = 1;

  while (true) {

    console.log(
      `Downloading activities page ${page}...`
    );

    const res =
      await fetch(
        `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`
          }
        }
      );

    const chunk =
      await res.json();

    if (
      !Array.isArray(chunk) ||
      chunk.length === 0
    ) {
      break;
    }

    activities.push(...chunk);

    page++;
  }

  return activities;
}

async function downloadActivity(
  activityId,
  accessToken
) {

  console.log(
    `Activity ${activityId}`
  );

  /*
   * DETAIL
   */

  const detailRes =
    await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`
        }
      }
    );

  const detail =
    await detailRes.json();

  /*
   * PHOTOS
   */

  const photoRes =
    await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/photos?size=2048`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`
        }
      }
    );

  const photos =
    await photoRes.json();

  /*
   * STREAMS
   */

  const streamRes =
    await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=time,latlng&key_by_type=true`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`
        }
      }
    );

  const streams =
    await streamRes.json();

  /*
   * SAVE
   */

  fs.writeFileSync(
    `data/activities/${activityId}-detail.json`,
    JSON.stringify(
      detail,
      null,
      2
    )
  );

  fs.writeFileSync(
    `data/activities/${activityId}-photos.json`,
    JSON.stringify(
      photos,
      null,
      2
    )
  );

  fs.writeFileSync(
    `data/activities/${activityId}-streams.json`,
    JSON.stringify(
      streams,
      null,
      2
    )
  );

  console.log(
    `✅ Saved ${activityId}`
  );

  return {
    id: detail.id,
    name: detail.name,
    start_date: detail.start_date,
    distance: detail.distance,
    moving_time: detail.moving_time,
    total_elevation_gain:
      detail.total_elevation_gain,
    sport_type:
      detail.sport_type
  };
}

async function main() {

  fs.mkdirSync(
    "data",
    { recursive: true }
  );

  fs.mkdirSync(
    "data/activities",
    { recursive: true }
  );

  const accessToken =
    await getAccessToken();

  await verifyAthlete(
    accessToken
  );

  const activities =
    await getAllActivities(
      accessToken
    );

  console.log(
    `Activities found: ${activities.length}`
  );

  const allowedTypes =
    new Set([
      "Ride",
      "GravelRide",
      "VirtualRide",
      "EBikeRide"
    ]);

  const filtered =
    activities.filter(
      a =>
        allowedTypes.has(
          a.sport_type
        )
    );

  console.log(
    `Activities selected: ${filtered.length}`
  );

  const index = [];

  for (
    const activity
    of filtered
  ) {

    try {

      const item =
        await downloadActivity(
          activity.id,
          accessToken
        );

      index.push(item);

    } catch (err) {

      console.error(
        `Failed activity ${activity.id}`,
        err
      );
    }
  }

  index.sort(
    (a, b) =>
      new Date(
        b.start_date
      ) -
      new Date(
        a.start_date
      )
  );

  fs.writeFileSync(
    "data/activities.json",
    JSON.stringify(
      index,
      null,
      2
    )
  );

  console.log(
    `✅ Saved activities.json (${index.length})`
  );
}

main().catch(
  console.error
);
