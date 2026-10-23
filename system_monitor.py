
"""
system_monitor.py
Defensive Windows system monitoring with SQLite event storage.

Optional dependencies:
    pip install psutil watchdog

Run:
    python system_monitor.py

Optional environment variables:
    SYSTEM_MONITOR_DIR       Application/database directory
    SYSTEM_MONITOR_WATCH    Semicolon-separated directories to watch
    SYSTEM_MONITOR_INTERVAL Poll interval in seconds (default 5)
    SYSTEM_MONITOR_RETENTION_DAYS  Database retention (default 90;
                                   set 0 to disable retention)
    SYSTEM_MONITOR_PUBLIC_IP  Set to 1 to enable public-IP lookup
"""

from __future__ import annotations

import ctypes
import hashlib
import ipaddress
import json
import os
import queue
import re
import socket
import sqlite3
import subprocess
import sys
import threading
import time
import traceback
import urllib.request
import uuid

from datetime import datetime, timezone
from pathlib import Path

try:
    import psutil
except ImportError:
    psutil = None

try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer
except ImportError:
    FileSystemEventHandler = None
    Observer = None


APP_DIR = Path(os.environ.get(
    "SYSTEM_MONITOR_DIR",
    str(Path.home() / "SystemMonitor")
)).expanduser().resolve()

DB_PATH = APP_DIR / "system_monitor.db"
LOCK_PATH = APP_DIR / "system_monitor.lock"

POLL_INTERVAL = max(
    2, int(os.environ.get("SYSTEM_MONITOR_INTERVAL", "5"))
)
RETENTION_DAYS = max(
    0, int(os.environ.get("SYSTEM_MONITOR_RETENTION_DAYS", "90"))
)

QUEUE_SIZE = 10000
STOP = threading.Event()
EVENT_QUEUE = queue.Queue(maxsize=QUEUE_SIZE)
INSTANCE_ID = str(uuid.uuid4())

# Windows Event Log channels. Availability and access depend on
# Windows configuration, installed components, and permissions.
CHANNELS = {
    "System": "system",
    "Security": "login",
    "Microsoft-Windows-Sysmon/Operational": "process",
    "Microsoft-Windows-DNS-Client/Operational": "dns",
}

# Event IDs are interpreted conservatively. Not every ID is enabled
# on every Windows installation.
SECURITY_IDS = {
    1100, 1102, 4616, 4719, 4720, 4722, 4723, 4724,
    4725, 4726, 4728, 4729, 4732, 4733, 4738, 4740,
    4756, 4757, 4767, 4771, 4776, 4964, 5025, 5038,
    5061, 7040,
}

LOGIN_IDS = {
    4624, 4625, 4634, 4647, 4648, 4672, 4778, 4779,
}

PROCESS_IDS = {1, 5, 4688, 4689}
DNS_IDS = {3008}

# Never recursively monitor the whole drive by default.
DEFAULT_WATCH_DIRS = [
    Path.home() / "Downloads",
    Path.home() / "Desktop",
]

WATCH_DIRS = [
    Path(p.strip()).expanduser()
    for p in os.environ.get(
        "SYSTEM_MONITOR_WATCH",
        ";".join(str(p) for p in DEFAULT_WATCH_DIRS),
    ).split(";")
    if p.strip()
]

EXECUTABLE_EXTENSIONS = {
    ".exe", ".dll", ".sys", ".scr", ".com",
    ".bat", ".cmd", ".ps1", ".vbs", ".js",
    ".jse", ".wsf", ".hta", ".msi", ".msp",
    ".reg",
}


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def json_text(value):
    return json.dumps(value, ensure_ascii=False, default=str)


def severity(value):
    value = str(value or "unknown").lower()
    return value if value in {
        "informational", "low", "medium", "high", "unknown"
    } else "unknown"


def is_windows():
    return os.name == "nt"


def is_admin():
    if not is_windows():
        return False
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def username():
    return os.environ.get("USERDOMAIN", "") + "\\" + os.environ.get(
        "USERNAME", ""
    )


def file_metadata(path):
    result = {}
    try:
        p = Path(path)
        st = p.stat()
        result.update({
            "size_bytes": st.st_size,
            "modified_time_utc": datetime.fromtimestamp(
                st.st_mtime, timezone.utc
            ).isoformat(),
            "created_time_utc": datetime.fromtimestamp(
                st.st_ctime, timezone.utc
            ).isoformat(),
            "is_directory": p.is_dir(),
        })
    except (OSError, ValueError):
        result["metadata_status"] = "unavailable"
    return result


def sha256_file(path, max_bytes=100 * 1024 * 1024):
    """Hash regular files up to 100 MiB; do not read huge files."""
    try:
        p = Path(path)
        if not p.is_file() or p.stat().st_size > max_bytes:
            return None
        h = hashlib.sha256()
        with p.open("rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                h.update(chunk)
        return h.hexdigest()
    except (OSError, PermissionError):
        return None


def emit_event(category, event_type, source, **kwargs):
    """Queue an event without blocking the monitoring collector."""
    event = {
        "timestamp": utc_now(),
        "event_category": category,
        "event_type": event_type,
        "source": source,
        "username": kwargs.get("username"),
        "process_id": kwargs.get("process_id"),
        "parent_process_id": kwargs.get("parent_process_id"),
        "file_path": kwargs.get("file_path"),
        "source_ip": kwargs.get("source_ip"),
        "destination_ip": kwargs.get("destination_ip"),
        "domain": kwargs.get("domain"),
        "severity": severity(kwargs.get("severity")),
        "details_json": json_text(kwargs.get("details", {})),
        "collection_status": kwargs.get("collection_status", "collected"),
    }

    try:
        EVENT_QUEUE.put_nowait(event)
    except queue.Full:
        # Never block collectors indefinitely. The writer records
        # dropped queue entries when it next gets capacity.
        DROPPED["count"] += 1


DROPPED = {"count": 0}
DROPPED_LOCK = threading.Lock()


def record_status(conn, collector, status, message=None):
    now = utc_now()
    conn.execute("""
        INSERT INTO collector_status
            (collector, started_at, last_success_at, last_error_at,
             status, last_error, collection_gaps, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
        ON CONFLICT(collector) DO UPDATE SET
            last_success_at = CASE
                WHEN excluded.status = 'ok'
                THEN excluded.last_success_at
                ELSE collector_status.last_success_at END,
            last_error_at = CASE
                WHEN excluded.status = 'error'
                THEN excluded.last_error_at
                ELSE collector_status.last_error_at END,
            status = excluded.status,
            last_error = excluded.last_error,
            updated_at = excluded.updated_at
    """, (
        collector, now,
        now if status == "ok" else None,
        now if status == "error" else None,
        status, (message or "")[:2000] or None, now,
    ))


def open_database():
    APP_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA busy_timeout=10000")

    conn.executescript("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            event_category TEXT NOT NULL,
            event_type TEXT NOT NULL,
            source TEXT NOT NULL,
            username TEXT,
            process_id INTEGER,
            parent_process_id INTEGER,
            file_path TEXT,
            source_ip TEXT,
            destination_ip TEXT,
            domain TEXT,
            severity TEXT NOT NULL DEFAULT 'unknown',
            details_json TEXT NOT NULL DEFAULT '{}',
            collection_status TEXT NOT NULL DEFAULT 'collected'
        );

        CREATE TABLE IF NOT EXISTS collector_status (
            collector TEXT PRIMARY KEY,
            started_at TEXT,
            last_success_at TEXT,
            last_error_at TEXT,
            status TEXT NOT NULL,
            last_error TEXT,
            collection_gaps INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_events_timestamp
            ON events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_events_category_time
            ON events(event_category, timestamp);
        CREATE INDEX IF NOT EXISTS idx_events_type
            ON events(event_type);
        CREATE INDEX IF NOT EXISTS idx_events_pid
            ON events(process_id);
        CREATE INDEX IF NOT EXISTS idx_events_domain
            ON events(domain);
        CREATE INDEX IF NOT EXISTS idx_events_file
            ON events(file_path);
        CREATE INDEX IF NOT EXISTS idx_status_updated
            ON collector_status(updated_at);
    """)

    # Restrict the database directory to the current Windows user
    # where possible. Existing parent-directory ACLs also matter.
    try:
        if is_windows():
            subprocess.run(
                [
                    "icacls", str(APP_DIR),
                    "/inheritance:r",
                    "/grant:r",
                    f"{username()}:(OI)(CI)F",
                    "SYSTEM:(OI)(CI)F",
                ],
                capture_output=True, text=True, timeout=10,
                check=False,
            )
    except Exception:
        pass

    return conn


def db_writer():
    conn = open_database()
    record_status(conn, "database", "ok", "Database initialized")
    conn.commit()

    pending = []
    last_maintenance = time.monotonic()

    try:
        while not STOP.is_set() or not EVENT_QUEUE.empty():
            try:
                item = EVENT_QUEUE.get(timeout=0.5)
                pending.append(item)
            except queue.Empty:
                pass

            if len(pending) >= 100 or (
                pending and EVENT_QUEUE.empty()
            ):
                try:
                    conn.executemany("""
                        INSERT INTO events (
                            timestamp, event_category, event_type, source,
                            username, process_id, parent_process_id,
                            file_path, source_ip, destination_ip, domain,
                            severity, details_json, collection_status
                        ) VALUES (
                            :timestamp, :event_category, :event_type, :source,
                            :username, :process_id, :parent_process_id,
                            :file_path, :source_ip, :destination_ip, :domain,
                            :severity, :details_json, :collection_status
                        )
                    """, pending)
                    conn.commit()
                    pending.clear()
                except sqlite3.Error as exc:
                    conn.rollback()
                    # Retry the batch a bounded number of times.
                    batch = pending[:]
                    saved = False
                    for attempt in range(3):
                        if STOP.wait(0.5 * (attempt + 1)):
                            break
                        try:
                            conn.executemany("""
                                INSERT INTO events (
                                    timestamp, event_category, event_type,
                                    source, username, process_id,
                                    parent_process_id, file_path, source_ip,
                                    destination_ip, domain, severity,
                                    details_json, collection_status
                                ) VALUES (
                                    :timestamp, :event_category, :event_type,
                                    :source, :username, :process_id,
                                    :parent_process_id, :file_path, :source_ip,
                                    :destination_ip, :domain, :severity,
                                    :details_json, :collection_status
                                )
                            """, batch)
                            conn.commit()
                            pending.clear()
                            saved = True
                            break
                        except sqlite3.Error:
                            conn.rollback()
                    if not saved:
                        # Preserve bounded memory. Record the failure if
                        # the database becomes writable again.
                        pending.clear()
                        try:
                            record_status(
                                conn, "database", "error", str(exc)
                            )
                            conn.commit()
                        except sqlite3.Error:
                            pass

            if time.monotonic() - last_maintenance > 3600:
                try:
                    if RETENTION_DAYS > 0:
                        conn.execute(
                            "DELETE FROM events WHERE timestamp < ?",
                            (datetime.fromtimestamp(
                                time.time() - RETENTION_DAYS * 86400,
                                timezone.utc,
                            ).isoformat(),),
                        )
                    conn.execute("PRAGMA wal_checkpoint(PASSIVE)")
                    conn.commit()
                except sqlite3.Error:
                    conn.rollback()
                last_maintenance = time.monotonic()

            with DROPPED_LOCK:
                dropped = DROPPED["count"]
                DROPPED["count"] = 0

            if dropped:
                try:
                    record_status(
                        conn, "event_queue", "error",
                        f"{dropped} events dropped because the bounded queue was full",
                    )
                    conn.execute("""
                        UPDATE collector_status
                        SET collection_gaps = collection_gaps + ?,
                            updated_at = ?
                        WHERE collector = 'event_queue'
                    """, (dropped, utc_now()))
                    conn.commit()
                except sqlite3.Error:
                    conn.rollback()

    finally:
        if pending:
            try:
                conn.executemany("""
                    INSERT INTO events (
                        timestamp, event_category, event_type, source,
                        username, process_id, parent_process_id, file_path,
                        source_ip, destination_ip, domain, severity,
                        details_json, collection_status
                    ) VALUES (
                        :timestamp, :event_category, :event_type, :source,
                        :username, :process_id, :parent_process_id, :file_path,
                        :source_ip, :destination_ip, :domain, :severity,
                        :details_json, :collection_status
                    )
                """, pending)
                conn.commit()
            except sqlite3.Error:
                conn.rollback()
        conn.close()


def powershell_json(script, timeout=15):
    """Run a read-only PowerShell query and parse JSON output."""
    result = subprocess.run(
        [
            "powershell.exe", "-NoProfile", "-NonInteractive",
            "-ExecutionPolicy", "RemoteSigned", "-Command", script,
        ],
        capture_output=True, text=True, timeout=timeout,
        encoding="utf-8", errors="replace",
    )
    if result.returncode != 0:
        raise RuntimeError(
            (result.stderr or result.stdout or "PowerShell query failed")[:1500]
        )

    output = result.stdout.strip()
    if not output:
        return []
    data = json.loads(output)
    return data if isinstance(data, list) else [data]


def classify_windows_event(channel, item):
    event_id = int(item.get("Id") or 0)
    provider = str(item.get("ProviderName") or "")
    message = str(item.get("Message") or "")[:4000]
    record_id = item.get("RecordId")
    category = CHANNELS.get(channel, "system")
    event_type = f"windows_event_{event_id}"
    level = str(item.get("LevelDisplayName") or "").lower()
    sev = "informational"

    if "error" in level or "critical" in level:
        sev = "medium"
    if "critical" in level:
        sev = "high"

    if channel == "Security":
        if event_id in LOGIN_IDS:
            category = "login"
            event_type = {
                4624: "login_success",
                4625: "login_failure",
                4634: "logoff",
                4647: "user_logoff",
                4648: "explicit_credentials_logon",
                4672: "special_privileges_assigned",
                4778: "session_reconnected",
                4779: "session_disconnected",
            }.get(event_id, event_type)
            if event_id in (4625, 4771, 4776):
                sev = "medium"
        elif event_id == 4740:
            category, event_type, sev = "login", "account_lockout", "high"
        elif event_id in SECURITY_IDS:
            category, sev = "security", "medium"
            if event_id in (1102, 4719):
                sev = "high"
        elif event_id in PROCESS_IDS:
            category, event_type = "process", {
                4688: "process_creation",
                4689: "process_termination",
            }.get(event_id, event_type)

    elif "Sysmon" in channel:
        category = "process"
        if event_id == 1:
            event_type = "process_creation"
        elif event_id == 5:
            event_type = "process_termination"
        elif event_id == 3:
            category, event_type = "network", "network_connection"
        elif event_id == 11:
            category, event_type = "file", "file_created"
        elif event_id in (12, 13, 14):
            category, event_type, sev = "security", "registry_change", "medium"
        elif event_id == 22:
            category, event_type = "dns", "dns_query"
        else:
            event_type = f"sysmon_event_{event_id}"

    elif "DNS-Client" in channel:
        category, event_type = "dns", "dns_event"

    elif channel == "System":
        if event_id == 6005:
            event_type = "event_log_service_started"
        elif event_id == 6006:
            event_type = "event_log_service_stopped"
        elif event_id == 6008:
            event_type, sev = "unexpected_shutdown", "high"
        elif event_id == 1074:
            event_type = "shutdown_or_restart_initiated"
        elif event_id in (7031, 7034):
            event_type, sev = "service_failure", "medium"
        elif event_id == 7040:
            category, event_type, sev = "security", "service_start_type_changed", "medium"
        elif event_id in (7035, 7036):
            event_type = "service_state_change"
        elif event_id == 7045:
            category, event_type, sev = "security", "service_installed", "high"
        else:
            event_type = f"system_event_{event_id}"

    # Extract useful event metadata from the message and event properties.
    details = {
        "channel": channel,
        "event_id": event_id,
        "record_id": record_id,
        "provider": provider,
        "level": item.get("LevelDisplayName"),
        "message": message,
    }

    # Sysmon and some Security event messages contain process IDs,
    # paths, domains, addresses, and ports. Keep extraction conservative.
    pid = None
    ppid = None
    path = None
    domain = None
    source_ip = None
    destination_ip = None

    for line in message.splitlines():
        key, sep, value = line.partition(":")
        if not sep:
            continue
        key = key.strip().lower()
        value = value.strip()
        if key in ("processid", "newprocessid", "process id"):
            try:
                pid = int(value, 0)
            except ValueError:
                pass
        elif key in ("parentprocessid", "creatorprocessid", "parent process id"):
            try:
                ppid = int(value, 0)
            except ValueError:
                pass
        elif key in (
            "image", "newprocessname", "processname", "image file name",
            "targetfilename",
        ):
            path = value[:1000]
        elif key in ("queryname", "query name", "hostname"):
            domain = value[:253]
        elif key in ("sourceip", "source network address"):
            source_ip = value
        elif key in ("destinationip", "destination address"):
            destination_ip = value

    # Prefer XML event properties if PowerShell included them in the message.
    return {
        "category": category,
        "event_type": event_type,
        "severity": sev,
        "pid": pid,
        "ppid": ppid,
        "path": path,
        "domain": domain,
        "source_ip": source_ip,
        "destination_ip": destination_ip,
        "details": details,
    }



def windows_event_collector(channel, default_category):
    """
    Poll recent Windows Event Log events.

    Missing optional logs are marked unavailable.
    Permission errors and other genuine failures remain errors.
    """
    seen = set()
    first_run = True
    collector = "eventlog:" + channel

    while not STOP.is_set():
        try:
            seconds = max(POLL_INTERVAL * 3, 30)

            # Escape single quotes for a PowerShell single-quoted string.
            safe_channel = channel.replace("'", "''")

            script = r"""
            $ErrorActionPreference = 'Stop'
            $logName = 'CHANNEL'
            $start = (Get-Date).AddSeconds(-SECONDS)

            # Check whether the event log exists.
            try {
                $null = Get-WinEvent -ListLog $logName -ErrorAction Stop
            }
            catch {
                if ($_.FullyQualifiedErrorId -like 'NoMatchingLogsFound*') {
                    [Console]::Error.WriteLine('LOG_UNAVAILABLE: ' + $logName)
                    exit 3
                }
                throw
            }

            # Query recent events. No matching events is normal.
            try {
                $items = @(Get-WinEvent -FilterHashtable @{
                    LogName = $logName
                    StartTime = $start
                } -MaxEvents 200 -ErrorAction Stop)
            }
            catch {
                if ($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') {
                    $items = @()
                }
                else {
                    throw
                }
            }

            if ($items.Count -eq 0) {
                [Console]::WriteLine('[]')
                exit 0
            }

            $items |
            Select-Object @{
                Name = 'TimeCreated'
                Expression = {
                    $_.TimeCreated.ToUniversalTime().ToString('o')
                }
            }, Id, RecordId, ProviderName, LevelDisplayName,
               Message, MachineName, UserId, ProcessId |
            ConvertTo-Json -Depth 4 -Compress
            """

            script = script.replace("SECONDS", str(seconds))
            script = script.replace("CHANNEL", safe_channel)

            items = powershell_json(script, timeout=20)

            for item in reversed(items):
                record_id = item.get("RecordId")
                key = (channel, record_id, item.get("Id"))

                if key in seen:
                    continue

                seen.add(key)

                if len(seen) > 20000:
                    seen = set(list(seen)[-10000:])

                parsed = classify_windows_event(channel, item)

                emit_event(
                    parsed["category"],
                    parsed["event_type"],
                    "Windows Event Log: " + channel,
                    username=item.get("UserId"),
                    process_id=parsed["pid"],
                    parent_process_id=parsed["ppid"],
                    file_path=parsed["path"],
                    source_ip=parsed["source_ip"],
                    destination_ip=parsed["destination_ip"],
                    domain=parsed["domain"],
                    severity=parsed["severity"],
                    details=parsed["details"],
                    collection_status="collected",
                )

            record_collector_health(collector, "ok")
            first_run = False

        except Exception as exc:
            error_text = str(exc)

            # A missing optional log is not the same as a collection failure.
            if "LOG_UNAVAILABLE:" in error_text:
                record_collector_health(
                    collector, "unavailable", error_text
                )
            else:
                record_collector_health(
                    collector, "error", error_text
                )

                if first_run:
                    emit_event(
                        "system",
                        "collector_unavailable",
                        "Windows Event Log",
                        severity="medium",
                        collection_status="partial",
                        details={
                            "channel": channel,
                            "error": error_text[:1000],
                            "hint": (
                                "Check event log permissions, "
                                "channel availability, and auditing settings."
                            ),
                        },
                    )

        STOP.wait(POLL_INTERVAL)


def record_collector_health(name, status, message=None):
    """Use a short-lived connection so collectors never share SQLite handles."""
    try:
        conn = sqlite3.connect(DB_PATH, timeout=3)
        record_status(conn, name, status, message)
        conn.commit()
        conn.close()
    except sqlite3.Error:
        pass


def process_collector():
    """Observe running processes with psutil; this is not a complete audit log."""
    name = "process_snapshot"
    if psutil is None:
        record_collector_health(name, "error", "psutil is not installed")
        emit_event(
            "system", "collector_unavailable", name,
            severity="medium", collection_status="partial",
            details={"install": "python -m pip install psutil"},
        )
        return

    previous = {}
    while not STOP.is_set():
        try:
            current = {}
            for proc in psutil.process_iter(
                ["pid", "ppid", "name", "exe", "username", "create_time"]
            ):
                try:
                    info = proc.info
                    pid = int(info["pid"])
                    current[pid] = info
                    if pid not in previous:
                        path = info.get("exe")
                        emit_event(
                            "process", "process_observed_running",
                            "psutil process snapshot",
                            username=info.get("username"),
                            process_id=pid,
                            parent_process_id=info.get("ppid"),
                            file_path=path,
                            details={
                                "name": info.get("name"),
                                "create_time": info.get("create_time"),
                                "sha256": sha256_file(path) if path else None,
                                "limitation": (
                                    "Observed between polls; short-lived "
                                    "processes may be missed."
                                ),
                            },
                        )
                except (psutil.NoSuchProcess, psutil.AccessDenied, OSError):
                    continue

            for pid, info in previous.items():
                if pid not in current:
                    emit_event(
                        "process", "process_no_longer_observed",
                        "psutil process snapshot",
                        process_id=pid,
                        parent_process_id=info.get("ppid"),
                        file_path=info.get("exe"),
                        details={
                            "name": info.get("name"),
                            "limitation": (
                                "Disappearance between snapshots; exact exit "
                                "time and exit code are unavailable."
                            ),
                        },
                    )

            previous = current
            record_collector_health(name, "ok")
        except Exception as exc:
            record_collector_health(name, "error", str(exc))

        STOP.wait(POLL_INTERVAL)


def network_collector():
    """Poll local interface/address metadata. Connections are not packet-captured."""
    name = "network_snapshot"
    previous = None

    while not STOP.is_set():
        try:
            snapshot = {"hostname": socket.gethostname(), "addresses": []}

            if psutil is not None:
                stats = psutil.net_if_stats()
                addresses = psutil.net_if_addrs()
                for interface, entries in addresses.items():
                    st = stats.get(interface)
                    for entry in entries:
                        if entry.family in (
                            socket.AF_INET, socket.AF_INET6
                        ):
                            snapshot["addresses"].append({
                                "interface": interface,
                                "address": entry.address.split("%")[0],
                                "netmask": entry.netmask,
                                "is_up": bool(st.isup) if st else None,
                            })

                connections = []
                try:
                    for c in psutil.net_connections(kind="inet"):
                        if c.status == "ESTABLISHED":
                            connections.append({
                                "pid": c.pid,
                                "local_ip": c.laddr.ip if c.laddr else None,
                                "local_port": c.laddr.port if c.laddr else None,
                                "remote_ip": c.raddr.ip if c.raddr else None,
                                "remote_port": c.raddr.port if c.raddr else None,
                                "status": c.status,
                            })
                except (psutil.AccessDenied, OSError):
                    snapshot["connection_metadata_status"] = "access_denied"

                snapshot["established_connections"] = connections[:2000]
            else:
                snapshot["address_collection_status"] = (
                    "psutil missing; only hostname available"
                )

            normalized = json_text(snapshot)
            if normalized != previous:
                emit_event(
                    "network", "network_state_changed",
                    "psutil/socket network snapshot",
                    details=snapshot,
                    collection_status="collected" if psutil else "partial",
                )
                previous = normalized

            record_collector_health(name, "ok")
        except Exception as exc:
            record_collector_health(name, "error", str(exc))

        STOP.wait(max(10, POLL_INTERVAL))


def public_ip_collector():
    """Optional external lookup; sends a request to api.ipify.org."""
    if os.environ.get("SYSTEM_MONITOR_PUBLIC_IP", "0") != "1":
        return

    while not STOP.is_set():
        try:
            req = urllib.request.Request(
                "https://api.ipify.org",
                headers={"User-Agent": "SystemMonitor/1.0"},
            )
            with urllib.request.urlopen(req, timeout=8) as response:
                value = response.read(100).decode("ascii", "replace").strip()

            ipaddress.ip_address(value)
            emit_event(
                "network", "public_ip_observed", "api.ipify.org",
                details={
                    "public_ip": value,
                    "service": "api.ipify.org",
                },
            )
            record_collector_health("public_ip", "ok")
        except Exception as exc:
            record_collector_health("public_ip", "error", str(exc))

        STOP.wait(3600)


def classify_file_event(event_type, path, source):
    ext = Path(path).suffix.lower()
    details = file_metadata(path)
    details["extension"] = ext

    if ext in EXECUTABLE_EXTENSIONS:
        details["security_indicator"] = "executable_or_script_extension"
        details["sha256"] = sha256_file(path)
        sev = "medium"
    else:
        sev = "informational"

    emit_event(
        "file", event_type, source,
        file_path=str(path),
        severity=sev,
        details=details,
    )


def filesystem_collector():
    name = "filesystem_watcher"

    existing_dirs = [p for p in WATCH_DIRS if p.is_dir()]
    if Observer is None or FileSystemEventHandler is None:
        record_collector_health(
            name, "error", "watchdog is not installed"
        )
        emit_event(
            "system", "collector_unavailable", name,
            severity="medium", collection_status="partial",
            details={
                "install": "python -m pip install watchdog",
                "watch_directories": [str(p) for p in WATCH_DIRS],
            },
        )
        return

    if not existing_dirs:
        record_collector_health(
            name, "error", "No configured watch directories exist"
        )
        emit_event(
            "system", "filesystem_watch_unavailable", name,
            severity="low", collection_status="partial",
            details={"configured_directories": [str(p) for p in WATCH_DIRS]},
        )
        return

    class Handler(FileSystemEventHandler):
        def on_created(self, event):
            if not event.is_directory:
                classify_file_event("file_created", event.src_path, name)

        def on_modified(self, event):
            if not event.is_directory:
                classify_file_event("file_modified", event.src_path, name)

        def on_deleted(self, event):
            if not event.is_directory:
                emit_event(
                    "file", "file_deleted", name,
                    file_path=event.src_path,
                    details={"metadata_status": "file no longer exists"},
                )

        def on_moved(self, event):
            if not event.is_directory:
                emit_event(
                    "file", "file_renamed", name,
                    file_path=event.dest_path,
                    details={
                        "old_path": event.src_path,
                        "new_path": event.dest_path,
                        **file_metadata(event.dest_path),
                    },
                )

    observer = Observer()
    try:
        handler = Handler()
        for directory in existing_dirs:
            observer.schedule(handler, str(directory), recursive=True)

        observer.start()
        record_collector_health(name, "ok")
        emit_event(
            "system", "filesystem_monitor_started", name,
            details={"directories": [str(p) for p in existing_dirs]},
        )

        while not STOP.wait(1):
            if not observer.is_alive():
                raise RuntimeError("Filesystem observer stopped unexpectedly")
        observer.stop()
        observer.join(timeout=5)
    except Exception as exc:
        record_collector_health(name, "error", str(exc))
        try:
            observer.stop()
            observer.join(timeout=5)
        except Exception:
            pass


def device_collector():
    """Poll mounted drive letters; this does not identify every USB device."""
    name = "mounted_drives"
    if not is_windows():
        record_collector_health(name, "error", "Windows only")
        return

    previous = None
    script = r"""
    $ErrorActionPreference = 'Stop'
    Get-CimInstance Win32_LogicalDisk |
      Select-Object DeviceID, DriveType, VolumeName, FileSystem, Size |
      ConvertTo-Json -Compress
    """

    while not STOP.is_set():
        try:
            drives = powershell_json(script, timeout=15)
            normalized = json_text(drives)
            if normalized != previous:
                emit_event(
                    "device", "mounted_drive_state_changed",
                    "Windows CIM Win32_LogicalDisk",
                    details={"drives": drives},
                )
                previous = normalized
            record_collector_health(name, "ok")
        except Exception as exc:
            record_collector_health(name, "error", str(exc))

        STOP.wait(15)


def startup_event():
    emit_event(
        "system", "monitor_started", "system_monitor.py",
        details={
            "instance_id": INSTANCE_ID,
            "python_version": sys.version,
            "is_admin": is_admin(),
            "database": str(DB_PATH),
            "watch_directories": [str(p) for p in WATCH_DIRS],
            "psutil_available": psutil is not None,
            "watchdog_available": Observer is not None,
            "coverage_note": (
                "Best-effort monitoring. Windows audit policies and "
                "telemetry configuration determine event availability."
            ),
        },
    )


def acquire_instance_lock():
    """Windows byte-range lock prevents two instances using this script."""
    APP_DIR.mkdir(parents=True, exist_ok=True)
    handle = open(LOCK_PATH, "a+b")

    if os.name == "nt":
        import msvcrt
        handle.seek(0)
        if handle.read(1) == b"":
            handle.seek(0)
            handle.write(b"0")
            handle.flush()
        handle.seek(0)
        try:
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            handle.close()
            raise RuntimeError(
                "Another system_monitor.py instance appears to be running."
            )
    else:
        import fcntl
        try:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            handle.close()
            raise RuntimeError(
                "Another system_monitor.py instance appears to be running."
            )

    return handle


def main():
    if not is_windows():
        print("Warning: Windows Event Log collectors require Windows.")

    lock_handle = acquire_instance_lock()
    writer = threading.Thread(
        target=db_writer, name="sqlite-writer", daemon=False
    )
    writer.start()

    # Wait for schema initialization before starting collectors.
    for _ in range(100):
        if DB_PATH.exists():
            try:
                conn = sqlite3.connect(DB_PATH, timeout=1)
                conn.execute("SELECT 1 FROM events LIMIT 1")
                conn.close()
                break
            except sqlite3.Error:
                pass
        time.sleep(0.1)

    startup_event()

    threads = []

    if is_windows():
        for channel, category in CHANNELS.items():
            t = threading.Thread(
                target=windows_event_collector,
                args=(channel, category),
                name="eventlog-" + channel,
                daemon=True,
            )
            t.start()
            threads.append(t)

        t = threading.Thread(
            target=device_collector, name="device-collector", daemon=True
        )
        t.start()
        threads.append(t)

    for target, name in [
        (process_collector, "process-collector"),
        (network_collector, "network-collector"),
        (filesystem_collector, "filesystem-collector"),
        (public_ip_collector, "public-ip-collector"),
    ]:
        t = threading.Thread(target=target, name=name, daemon=True)
        t.start()
        threads.append(t)

    print(f"Monitoring started. Database: {DB_PATH}")
    print("Press Ctrl+C to stop.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping collectors...")
        STOP.set()
    finally:
        for t in threads:
            t.join(timeout=8)

        # Drain queued events before allowing the writer to exit.
        writer.join(timeout=20)
        try:
            emit_event(
                "system", "monitor_stopped", "system_monitor.py",
                details={"instance_id": INSTANCE_ID},
            )
        except Exception:
            pass

        # The writer may have exited after STOP; this final event is
        # best-effort. The shutdown status is also printed to the console.
        try:
            lock_handle.close()
        except Exception:
            pass

        print("Monitoring stopped.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Fatal error: {exc}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
