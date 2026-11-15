
import json
import os
import sqlite3
import sys
import urllib.request
import urllib.error
from pathlib import Path

API_URL = "http://localhost:8080/api/monitor/events/batch"

DATA_DIR = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "SystemMonitor"
DB_PATH = DATA_DIR / "system_monitor.db"
SYNC_STATE = "monitor_api_last_id"
BATCH_SIZE = 200


def sync_events():
    api_key = os.environ.get("MONITOR_AGENT_API_KEY")

    if not api_key:
        print("ERROR: MONITOR_AGENT_API_KEY environment variable is missing.")
        return

    if not DB_PATH.exists():
        print(f"ERROR: SQLite database not found: {DB_PATH}")
        return

    conn = sqlite3.connect(str(DB_PATH), timeout=30)

    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sync_state (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)

        row = conn.execute(
            "SELECT value FROM sync_state WHERE key = ?",
            (SYNC_STATE,)
        ).fetchone()

        last_id = int(row[0]) if row and row[0] else 0

        total_synced = 0

        while True:
            rows = conn.execute("""
                SELECT id, timestamp, event_category, event_type,
                       source, username, process_id, parent_process_id,
                       file_path, source_ip, destination_ip, domain,
                       severity, details_json, collection_status
                FROM events
                WHERE id > ?
                ORDER BY id
                LIMIT ?
            """, (last_id, BATCH_SIZE)).fetchall()

            if not rows:
                break

            events = []

            for row in rows:
                events.append({
                    "id": row[0],
                    "timestamp": row[1],
                    "event_category": row[2],
                    "event_type": row[3],
                    "source": row[4],
                    "username": row[5],
                    "process_id": row[6],
                    "parent_process_id": row[7],
                    "file_path": row[8],
                    "source_ip": row[9],
                    "destination_ip": row[10],
                    "domain": row[11],
                    "severity": row[12],
                    "details_json": row[13] or "{}",
                    "collection_status": row[14],
                    "collector": None
                })

            payload = json.dumps(events).encode("utf-8")

            request = urllib.request.Request(
                API_URL,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Agent-Key": api_key
                },
                method="POST"
            )

            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    result = json.loads(response.read().decode("utf-8"))

                print(
                    f"Batch successful: "
                    f"inserted={result.get('inserted', 0)}, "
                    f"duplicates={result.get('duplicates', 0)}"
                )

            except urllib.error.HTTPError as error:
                print(f"API ERROR: HTTP {error.code}")
                print(error.read().decode("utf-8", errors="replace"))
                break

            except urllib.error.URLError as error:
                print(f"Connection error: {error.reason}")
                break

            # Save checkpoint only after successful API response
            last_id = rows[-1][0]

            conn.execute("""
                INSERT INTO sync_state(key, value)
                VALUES (?, ?)
                ON CONFLICT(key)
                DO UPDATE SET value = excluded.value
            """, (SYNC_STATE, str(last_id)))

            conn.commit()
            total_synced += len(events)

        print(f"Sync completed. Events sent: {total_synced}")

    finally:
        conn.close()


if __name__ == "__main__":
    sync_events()
