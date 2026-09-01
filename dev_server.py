"""Local RailAhead server. Run: RAILRADAR_API_KEY=... python3 dev_server.py"""
import json
import os
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

API_URL = "https://api.railradar.in/v1/trains/between/{from_code}/{to_code}"

def load_local_env():
    """Load simple KEY=value pairs for local development without extra packages."""
    try:
        with open(".env", encoding="utf-8") as file:
            for line in file:
                key, separator, value = line.strip().partition("=")
                if separator and key and not line.lstrip().startswith("#"):
                    os.environ.setdefault(key, value)
    except FileNotFoundError:
        pass

class RailAheadHandler(SimpleHTTPRequestHandler):
    def send_json(self, status, body):
        raw = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/trains":
            return super().do_GET()
        query = parse_qs(parsed.query)
        from_code = query.get("from", [""])[0].upper()
        to_code = query.get("to", [""])[0].upper()
        if not (from_code.isalpha() and to_code.isalpha() and 2 <= len(from_code) <= 5 and 2 <= len(to_code) <= 5):
            return self.send_json(400, {"error": "Use valid Indian Railways station codes."})
        key = os.environ.get("RAILRADAR_API_KEY")
        if not key:
            return self.send_json(503, {"error": "Set RAILRADAR_API_KEY to enable live data."})
        params = urlencode({"date": datetime.now().strftime("%Y-%m-%d"), "live": "true"})
        request = Request(API_URL.format(from_code=from_code, to_code=to_code) + "?" + params, headers={"Authorization": "Bearer " + key})
        try:
            with urlopen(request, timeout=20) as upstream:
                payload = json.load(upstream)
        except HTTPError as error:
            return self.send_json(error.code, {"error": "Live-data provider rejected the request."})
        except (URLError, TimeoutError):
            return self.send_json(502, {"error": "Live-data provider is unavailable."})
        if not payload.get("success"):
            return self.send_json(502, {"error": payload.get("error", {}).get("message", "Could not retrieve trains.")})
        trains = []
        for item in payload["data"]["trains"]:
            live = item.get("live") or {}
            if live.get("type") in {"departed", "cancelled", "skipped"}:
                continue
            trains.append({
                "number": item["train"]["number"], "name": item["train"]["name"],
                "expectedDeparture": live.get("expectedDepartureTime") or live.get("expectedArrivalTime"),
                "scheduledDeparture": item["from"]["departure"], "scheduledArrival": item["to"]["arrival"],
                "platform": live.get("platform"), "delayMinutes": live.get("delayMinutes"),
                "durationMinutes": item.get("duration"), "liveType": live.get("type", "scheduled")
            })
        self.send_json(200, {"from": payload["data"]["from"], "to": payload["data"]["to"], "trains": trains, "updatedAt": payload.get("meta", {}).get("timestamp")})

if __name__ == "__main__":
    load_local_env()
    print("RailAhead is running at http://localhost:4173")
    ThreadingHTTPServer(("127.0.0.1", 4173), RailAheadHandler).serve_forever()
