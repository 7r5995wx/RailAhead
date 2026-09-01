const demoTrains = [
  { no: "12424", name: "Dibrugarh Rajdhani", departure: "18:05", arrival: "23:35", scheduled: "Scheduled 18:05", duration: "5h 30m · Direct", platform: "Platform 3", status: "On time", kind: "on-time" },
  { no: "12310", name: "Rajendra Nagar Rajdhani", departure: "18:42", arrival: "00:12", scheduled: "Scheduled 18:15", duration: "5h 30m · Direct", platform: "Platform 4", status: "27 min late", kind: "late" },
  { no: "12033", name: "Kanpur Shatabdi", departure: "19:10", arrival: "23:50", scheduled: "Scheduled 19:10", duration: "4h 40m · Direct", platform: "Platform 1", status: "On time", kind: "on-time" },
  { no: "22436", name: "Vande Bharat Express", departure: "20:00", arrival: "23:55", scheduled: "Scheduled 20:00", duration: "3h 55m · Direct", platform: "Platform TBA", status: "On time", kind: "on-time" }
];
const stations = [
  { name: "New Delhi", code: "NDLS", lat: 28.6431, lng: 77.2197 }, { name: "Patna Junction", code: "PNBE", lat: 25.6093, lng: 85.1376 }, { name: "Kanpur Central", code: "CNB", lat: 26.4520, lng: 80.3319 },
  { name: "Prayagraj Junction", code: "PRYJ", lat: 25.4358, lng: 81.8463 }, { name: "Lucknow", code: "LKO", lat: 26.8380, lng: 80.9231 },
  { name: "Howrah Junction", code: "HWH", lat: 22.5849, lng: 88.3426 }, { name: "Mumbai Central", code: "MMCT", lat: 18.9690, lng: 72.8195 },
  { name: "Chennai Central", code: "MAS", lat: 13.0825, lng: 80.2757 }, { name: "KSR Bengaluru", code: "SBC", lat: 12.9767, lng: 77.5713 }
];
const list = document.querySelector("#train-list");
function render(data = demoTrains) {
  list.innerHTML = "";
  data.forEach(train => {
    const node = document.querySelector("#train-template").content.cloneNode(true);
    node.querySelector(".number").textContent = train.no;
    node.querySelector("h3").textContent = train.name;
    const badge = node.querySelector(".badge"); badge.textContent = train.status; badge.classList.add(train.kind);
    node.querySelector(".departure").textContent = train.departure;
    node.querySelector(".scheduled").textContent = train.scheduled;
    node.querySelector(".arrival").textContent = train.arrival;
    node.querySelector(".duration").textContent = train.duration;
    node.querySelector(".platform").textContent = train.platform;
    node.querySelector(".status").textContent = train.kind === "late" ? "Still approaching your station" : "Confirmed service";
    list.append(node);
  });
  document.querySelector("#count").textContent = data.length;
}
function stationName(value) { return value.replace(/\s*\([A-Z]+\)/, "").trim() || "Selected station"; }
function stationCode(value) {
  const explicit = value.match(/\(([A-Z]{2,5})\)/)?.[1];
  if (explicit) return explicit;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  const match = stations.find(station => station.name.toLowerCase() === normalized || station.name.toLowerCase().replace(" junction", "") === normalized);
  return match?.code || value.trim().toUpperCase();
}
function kmBetween(a, b) { const r = n => n * Math.PI / 180, dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng); const v = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v)); }
function locationMessage(message, error = false) { const element = document.querySelector("#location-feedback"); element.textContent = message; element.hidden = false; element.classList.toggle("error", error); }
function locateStation() {
  if (!navigator.geolocation) return locationMessage("Location is unavailable in this browser. Select your station manually.", true);
  const button = document.querySelector("#locate"); button.disabled = true; button.textContent = "Finding nearest station…";
  navigator.geolocation.getCurrentPosition(position => {
    const here = { lat: position.coords.latitude, lng: position.coords.longitude };
    const nearest = stations.map(station => ({ station, distance: kmBetween(here, station) })).sort((a, b) => a.distance - b.distance)[0];
    button.disabled = false; button.textContent = "⌖ Use my current station";
    if (nearest.distance > 8) return locationMessage("No nearby station in the starter directory. Please choose your station manually.", true);
    document.querySelector("#from").value = `${nearest.station.name} (${nearest.station.code})`;
    locationMessage(`Nearest station: ${nearest.station.name} (${Math.round(nearest.distance * 10) / 10} km away).`);
  }, () => { button.disabled = false; button.textContent = "⌖ Use my current station"; locationMessage("Location permission was not granted. Select your station manually.", true); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}
function indianTime(value) {
  if (!value) return "TBA";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
function duration(minutes) { return minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m · Direct` : "Direct"; }
function normalize(live) {
  return live.map(item => ({
    no: item.number, name: item.name,
    departure: item.expectedDeparture ? indianTime(item.expectedDeparture) : item.scheduledDeparture,
    arrival: item.scheduledArrival, scheduled: `Scheduled ${item.scheduledDeparture}`,
    duration: duration(item.durationMinutes), platform: item.platform ? `Platform ${item.platform}` : "Platform TBA",
    status: item.delayMinutes > 0 ? `${item.delayMinutes} min late` : "On time",
    kind: item.delayMinutes > 0 ? "late" : "on-time"
  }));
}
async function search() {
  const from = stationName(document.querySelector("#from").value);
  const to = stationName(document.querySelector("#to").value);
  document.querySelector("#route-title").innerHTML = `${from} <span>→</span> ${to}`;
  const button = document.querySelector("#search");
  button.disabled = true; button.textContent = "Finding live trains…";
  try {
    const result = await fetch(`/api/trains?from=${encodeURIComponent(stationCode(document.querySelector("#from").value))}&to=${encodeURIComponent(stationCode(document.querySelector("#to").value))}`);
    if (!result.ok) throw new Error();
    const data = await result.json();
    render(normalize(data.trains));
    document.querySelector("#updated").textContent = `Updated ${indianTime(data.updatedAt)} IST`;
  } catch {
    render(demoTrains);
    document.querySelector("#updated").textContent = "Demo data · add provider key for live status";
  } finally { button.disabled = false; button.innerHTML = "Show trains <span>→</span>"; }
  document.querySelector("#results").scrollIntoView({ behavior: "smooth", block: "start" });
}
document.querySelector("#search").addEventListener("click", search);
document.querySelector("#refresh").addEventListener("click", search);
document.querySelector("#swap").addEventListener("click", () => { const a = document.querySelector("#from"), b = document.querySelector("#to"); [a.value, b.value] = [b.value, a.value]; });
document.querySelector("#locate").addEventListener("click", locateStation);
render();
