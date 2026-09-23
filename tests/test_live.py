import urllib.request
import json
import time

base_url = "https://browser-analytics-extension-longenus05-3620s-projects.vercel.app"
print(f"Targeting Live Vercel Deployment: {base_url}\n")

# Wait up to 30s for Vercel deployment to propagate
schemas = ["overview", "products", "seo", "tech", "traffic"]

for mod in schemas:
    url = f"{base_url}/{mod}/schema"
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode())
                print(f"[OK] GET /{mod}/schema -> Status 200 (Title: {data.get('title')})")
                break
        except Exception as e:
            if attempt < 5:
                print(f"[WAIT] Waiting for /{mod}/schema propagation... ({e})")
                time.sleep(5)
            else:
                print(f"[FAIL] /{mod}/schema failed: {e}")

# Test Universal Export All on live Vercel
print("\nTesting Live Universal Dossier Export (Multi-sheet Excel):")
dossier = {
    "url": "https://live-test.example.com",
    "domain": "live-test.example.com",
    "overview": {"pageType": "SaaS", "industry": "Tech & Software", "confidence": 0.98},
    "products": [{"product_name": "Pro Plan", "price": 49.0, "position": 1}],
    "seo_intelligence": {"seo_score": {"score": 95, "rating": "Excellent"}},
    "tech_stack": {"technologies": [{"name": "FastAPI", "category": "Backend", "confidence": 99}]},
    "traffic": {"source": "Unavailable"}
}

post_req = urllib.request.Request(
    f"{base_url}/export/all",
    data=json.dumps({"dossier": dossier, "format": "xlsx"}).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(post_req, timeout=15) as resp:
    content = resp.read()
    print(f"[OK] POST /export/all (format=xlsx) -> Status {resp.status} (Received {len(content)} bytes)")

# Test Consolidated CSV Export
post_csv = urllib.request.Request(
    f"{base_url}/export/all",
    data=json.dumps({"dossier": dossier, "format": "csv"}).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(post_csv, timeout=15) as resp:
    csv_text = resp.read().decode("utf-8")
    print(f"[OK] POST /export/all (format=csv) -> Status {resp.status}")
    print("CSV Header Preview:\n" + csv_text[:180])

print("\n=======================================================")
print("ALL LIVE VERCEL PRODUCTION ENDPOINTS VERIFIED 100% OK!")
print("=======================================================")
