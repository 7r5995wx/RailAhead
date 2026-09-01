// Vercel serverless function. Set RAILRADAR_API_KEY in the Vercel project settings.
const API_ROOT = "https://api.railradar.in/v1";

function indiaDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export default async function handler(request, response) {
  const { from, to } = request.query;
  if (!/^[A-Z]{2,5}$/.test(from || "") || !/^[A-Z]{2,5}$/.test(to || "")) {
    return response.status(400).json({ error: "Use valid Indian Railways station codes." });
  }
  if (!process.env.RAILRADAR_API_KEY) {
    return response.status(503).json({ error: "Live-data provider is not configured." });
  }

  try {
    const url = new URL(`${API_ROOT}/trains/between/${from}/${to}`);
    url.searchParams.set("date", indiaDate());
    url.searchParams.set("live", "true");
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.RAILRADAR_API_KEY}` }
    });
    const payload = await upstream.json();
    if (!upstream.ok || !payload.success) {
      return response.status(upstream.status || 502).json({ error: payload?.error?.message || "Could not retrieve live trains." });
    }

    // Keep only trains that have not actually left the selected source station.
    // This is the rule that preserves delayed trains after their timetable time.
    const trains = payload.data.trains
      .filter(item => !["departed", "cancelled", "skipped"].includes(item.live?.type))
      .map(item => ({
        number: item.train.number,
        name: item.train.name,
        expectedDeparture: item.live?.expectedDepartureTime || item.live?.expectedArrivalTime || null,
        scheduledDeparture: item.from.departure,
        scheduledArrival: item.to.arrival,
        platform: item.live?.platform || null,
        delayMinutes: item.live?.delayMinutes ?? null,
        durationMinutes: item.duration,
        liveType: item.live?.type || "scheduled"
      }));
    response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=60");
    return response.status(200).json({ from: payload.data.from, to: payload.data.to, trains, updatedAt: payload.meta?.timestamp });
  } catch {
    return response.status(502).json({ error: "Live-data service is temporarily unavailable." });
  }
}
