import axios from "axios";

function formatDate(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

export async function fetchGroundwaterData(
  { district, state = "Rajasthan", start, end }, // Added state parameter with default
  retries = 3,
  delay = 1000
) {
  const formattedStart = formatDate(start);
  const formattedEnd = formatDate(end);
  if (!formattedStart || !formattedEnd) {
    throw new Error("Invalid start or end date for WRIS fetch");
  }

  const url = `https://indiawris.gov.in/Dataset/Ground%20Water%20Level?stateName=${encodeURIComponent(
    state
  )}&districtName=${encodeURIComponent(
    district
  )}&agencyName=CGWB&startdate=${formattedStart}&enddate=${formattedEnd}&download=false&page=0&size=1000`;

  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (r.status === 429) {
        await new Promise((resolve) =>
          setTimeout(resolve, delay * Math.pow(2, i))
        );
        continue;
      }
      if (!r.ok) throw new Error(`WRIS API failed (${r.status})`);
      const data = await r.json();
      return data;
    } catch (err) {
      if (i === retries - 1) throw err;
    }
  }
  throw new Error("WRIS API rate limit exceeded after retries");
}

export async function fetchLocalWaterLevel(
  { district, lat, lon, start, end },
  retries = 3,
  delay = 1000
) {
  try {
    // Use environment variable or default to localhost in development
    const baseUrl = process.env.BASE_URL || 
      (process.env.NODE_ENV === 'production' 
        ? 'https://your-production-url.com' 
        : 'http://localhost:3000');
    const url = `${baseUrl}/api/water-levels`;
    for (let i = 0; i < retries; i++) {
      try {
        const resp = await axios.post(
          url,
          {
            district,
            lat,
            lon,
            start: formatDate(start),
            end: formatDate(end),
          },
          { timeout: 10_000 }
        );
        return resp.data;
      } catch (err) {
        if (err.response?.status === 429) {
          await new Promise((resolve) =>
            setTimeout(resolve, delay * Math.pow(2, i))
          );
          continue;
        }
        throw err;
      }
    }
    throw new Error("Local API rate limit exceeded after retries");
  } catch (err) {
    console.error("Local water-level fetch error:", err.message || err);
    throw err;
  }
}
