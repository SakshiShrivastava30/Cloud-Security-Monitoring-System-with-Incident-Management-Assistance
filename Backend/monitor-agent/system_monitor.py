#!/usr/bin/env python3
"""
system_monitor.py - local, defensive system-activity recorder for Windows 10/11.

Records system, login, process, file, network, DNS, device and suspicious-activity
observations into a local SQLite database (system_monitor.db). It only OBSERVES:
it never blocks, deletes, quarantines, executes or modifies files or processes, and it
never captures keystrokes, passwords, cookies, page contents or private messages.
Use only on a computer you own or are authorised to administer.

Run:        python system_monitor.py
Check:      python system_monitor.py --check      (prerequisites + what will/won't work)
Status:     python system_monitor.py --status     (collector health and known gaps)
Stop:       Ctrl+C  (graceful: drains the queue, records a clean-shutdown marker)

Coverage is never guaranteed. Every collector documents its known gaps in the
`collector_status` table, and periods when the monitor was not running are recorded
as `monitoring_gap` events.
"""
from __future__ import annotations

import argparse
import collections
import copy
import datetime as dt
import fnmatch
import hashlib
import ipaddress
import json
import logging
import logging.handlers
import math
import ntpath
import os
import queue
import re
import signal
import socket
import sqlite3
import stat as stat_mod
import subprocess
import sys
import threading
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

try:
    import psutil
except ImportError:  # optional: only the process/network/connection collectors need it
    psutil = None
try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer
except ImportError:  # optional: only the file collector needs it
    Observer = None
    FileSystemEventHandler = object
try:
    import winreg  # Windows only
except ImportError:
    winreg = None

VERSION = "1.1.0"
IS_WINDOWS = os.name == "nt"
CREATE_NO_WINDOW = 0x08000000 if IS_WINDOWS else 0

CATEGORIES = {"system", "login", "process", "file", "network", "dns", "device", "security"}
SEVERITIES = {"informational", "low", "medium", "high", "unknown"}
STATUSES = {"collected", "partial", "error"}
SEV_RANK = {"unknown": 0, "informational": 1, "low": 2, "medium": 3, "high": 4}

log = logging.getLogger("system_monitor")

# --------------------------------------------------------------------------------------
# Configuration (JSON file created next to the database on first run)
# --------------------------------------------------------------------------------------
DEFAULT_CONFIG: Dict[str, Any] = {
    "retention_days": 90,          # 0 = keep forever
    "max_rows": 5_000_000,         # oldest rows are purged beyond this
    "queue_size": 10_000,          # bounded in-memory queue between collectors and DB writer
    "heartbeat_seconds": 30,
    "purge_interval_minutes": 60,
    "log_level": "INFO",
    "collectors": {
        "eventlog_security": True, "eventlog_system": True, "defender_log": True,
        "sysmon": True, "dns_client_log": True, "processes": True, "process_resources": True, "files": True,
        "interfaces": True, "gateway_dns": True, "connections": True, "volumes": True,
        "usb_pnp": True, "disk_usage": True, "removable_scan": True, "security_posture": True,
        "startup": True,
        "public_ip": False,        # contacts an external service: opt-in only
    },
    "intervals": {                 # seconds between polls
        "eventlog_security": 5, "eventlog_system": 10, "defender_log": 15, "sysmon": 5,
        "dns_client_log": 5, "processes": 2, "process_resources": 30, "files": 1, "interfaces": 10,
        "gateway_dns": 60, "connections": 5, "volumes": 3, "usb_pnp": 15,
        "disk_usage": 60, "removable_scan": 5, "security_posture": 300,
        "startup": 30, "public_ip": 3600,
    },
    "eventlog": {
        "backfill_minutes": 0,     # on first run only: also read this many minutes of history
        "logon_types": [2, 7, 10, 11, 12, 13],   # 3 (network) is very noisy; add it to record it
        "record_logoff": False,
        "record_special_privileges": False,      # event 4672 (every admin logon)
        "sysmon_event_ids": [1, 3, 5, 22],       # add 11 (file create) / 23 (file delete) if wanted
    },
    "files": {
        "watch_paths": [],         # empty = Downloads, Desktop, Temp and both Startup folders
        "ignore_patterns": ["*\\desktop.ini", "*\\thumbs.db", "*\\~$*"],
        "debounce_seconds": 2.0,
        "hash_max_mb": 50,
    },
    "processes": {"hash_executables": True, "hash_max_mb": 100, "store_command_lines": False},
    "process_resources": {"top_n": 200, "min_memory_mb": 0},
    "disk_usage": {"interval_seconds": 60, "warning_percent": 85, "critical_percent": 95},
    "removable_scan": {"max_files": 50000, "hash_max_mb": 100, "scan_with_defender": True,
                        "defender_timeout_seconds": 900, "scan_new_fixed_volumes": True},
    "security_posture": {"interval_seconds": 300, "old_update_days": 60},
    "connections": {"max_new_per_poll": 200, "record_listening": True},
    "dns": {"blocklist_file": "", "flag_generated_looking_names": True},
    "public_ip": {"url": "https://api.ipify.org", "timeout_seconds": 5},
    "failed_logins": {"threshold": 5, "window_minutes": 10},
}


def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            deep_merge(base[key], value)
        else:
            base[key] = value
    return base


def load_config(path: Path) -> Dict[str, Any]:
    cfg = copy.deepcopy(DEFAULT_CONFIG)
    if path.exists():
        user = json.loads(path.read_text(encoding="utf-8"))   # invalid JSON -> caller reports
        if not isinstance(user, dict):
            raise ValueError("config.json must contain a JSON object")
        deep_merge(cfg, user)
    else:
        path.write_text(json.dumps(DEFAULT_CONFIG, indent=2), encoding="utf-8")
    return cfg


def default_data_dir() -> Path:
    if IS_WINDOWS:
        return Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))) / "SystemMonitor"
    return Path(os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local" / "share"))) / "SystemMonitor"


# --------------------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------------------
def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def windows_time_to_iso(value: Optional[str]) -> str:
    """'2026-10-23T10:15:30.1234567Z' -> '2026-10-23T10:15:30.123Z'."""
    m = re.match(r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?", value or "")
    if not m:
        return utc_now()
    frac = (m.group(2) or ".000")[:4].ljust(4, "0")
    return f"{m.group(1)}{frac}Z"


def iso_to_epoch(value: str) -> float:
    try:
        return dt.datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=dt.timezone.utc).timestamp()
    except ValueError:
        return time.time()


def is_admin() -> bool:
    if IS_WINDOWS:
        try:
            import ctypes
            return bool(ctypes.windll.shell32.IsUserAnAdmin())
        except Exception:
            return False
    return hasattr(os, "geteuid") and os.geteuid() == 0


def decode_output(raw: bytes) -> str:
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("mbcs" if IS_WINDOWS else "latin-1", errors="replace")


def run_cmd(args: List[str], timeout: float = 60) -> Tuple[int, str, str]:
    r = subprocess.run(args, capture_output=True, timeout=timeout, stdin=subprocess.DEVNULL,
                       creationflags=CREATE_NO_WINDOW)
    return r.returncode, decode_output(r.stdout), decode_output(r.stderr)


def run_powershell_json(script: str, timeout: float = 60) -> List[Dict[str, Any]]:
    rc, out, err = run_cmd(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script], timeout)
    if rc != 0:
        raise RuntimeError(f"powershell exited {rc}: {(err or out).strip()[:300]}")
    out = out.strip()
    if not out:
        return []
    data = json.loads(out)
    if isinstance(data, dict):
        return [data]
    return [x for x in data if isinstance(x, dict)]


def as_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, (str, int)):
        return [str(value)]
    return [str(v) for v in value if v is not None]


def entropy(text: str) -> float:
    if not text:
        return 0.0
    counts = collections.Counter(text)
    return -sum(c / len(text) * math.log2(c / len(text)) for c in counts.values())


def known_folder(folder_id: str, fallback: Path) -> str:
    """Resolve a Windows known folder (handles OneDrive-redirected Desktop/Documents). Falls back to a guess."""
    if IS_WINDOWS:
        try:
            import ctypes
            import uuid

            class GUID(ctypes.Structure):
                _fields_ = [("Data1", ctypes.c_ulong), ("Data2", ctypes.c_ushort), ("Data3", ctypes.c_ushort),
                            ("Data4", ctypes.c_ubyte * 8)]
            g = uuid.UUID(folder_id)
            guid = GUID(g.time_low, g.time_mid, g.time_hi_version, (ctypes.c_ubyte * 8)(*g.bytes[8:]))
            ptr = ctypes.c_wchar_p()
            if ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(guid), 0, None, ctypes.byref(ptr)) == 0:
                path = ptr.value
                ctypes.windll.ole32.CoTaskMemFree(ptr)
                if path:
                    return path
        except Exception:
            pass
    return str(fallback)


def default_watch_paths() -> List[str]:
    home = Path.home()
    paths = [known_folder("{374DE290-123F-4565-9164-39C4925E467B}", home / "Downloads"),    # Downloads
             known_folder("{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}", home / "Desktop"),      # Desktop
             os.environ.get("TEMP", "/tmp")]
    if IS_WINDOWS:
        paths.append(str(Path(os.environ.get("APPDATA", "")) / "Microsoft/Windows/Start Menu/Programs/Startup"))
        paths.append(str(Path(os.environ.get("PROGRAMDATA", "")) / "Microsoft/Windows/Start Menu/Programs/StartUp"))
    return paths


def hex_to_int(value: Any) -> Optional[int]:
    try:
        s = str(value).strip()
        return int(s, 16) if s.lower().startswith("0x") else int(s)
    except (TypeError, ValueError):
        return None


def clean(value: Any) -> Optional[str]:
    return None if value in (None, "", "-", "(NULL)", "NULL") else str(value)


def redact_command_line(cmd: str) -> str:
    """Best-effort removal of obvious secrets; command lines are NOT stored unless enabled."""
    cmd = re.sub(r"(?i)(-{1,2}|/)(p|pw|pass|password|pwd|token|secret|apikey|api-key)(\s+|[=:])\S+", r"\1\2\3[REDACTED]", cmd)
    cmd = re.sub(r"(?i)\b(password|pwd|token|secret|apikey)=\S+", r"\1=[REDACTED]", cmd)
    return cmd[:1000]


# --------------------------------------------------------------------------------------
# Event construction
# --------------------------------------------------------------------------------------
def make_event(category: str, event_type: str, source: str, *, collector: Optional[str] = None,
               severity: str = "informational", timestamp: Optional[str] = None,
               username: Optional[str] = None, pid: Optional[int] = None, ppid: Optional[int] = None,
               path: Optional[str] = None, src_ip: Optional[str] = None, dst_ip: Optional[str] = None,
               domain: Optional[str] = None, details: Optional[Dict[str, Any]] = None,
               status: str = "collected") -> Dict[str, Any]:
    if category not in CATEGORIES:
        raise ValueError(f"invalid event category {category!r}")
    ts = timestamp or utc_now()
    return {
        "timestamp": ts, "event_category": category, "event_type": event_type, "source": source,
        "username": username, "process_id": pid, "parent_process_id": ppid, "file_path": path,
        "source_ip": src_ip, "destination_ip": dst_ip, "domain": domain,
        "severity": severity if severity in SEVERITIES else "unknown",
        "details": details or {}, "collection_status": status if status in STATUSES else "partial",
        "collector": collector, "epoch": iso_to_epoch(ts),
    }


def event_row(ev: Dict[str, Any]) -> tuple:
    details = json.dumps(ev.get("details") or {}, default=str, separators=(",", ":"), ensure_ascii=False)
    if len(details) > 16000:
        details = json.dumps({"truncated": True, "preview": details[:2000]})
    return (ev["timestamp"], ev["event_category"], ev["event_type"], ev["source"], ev.get("username"),
            ev.get("process_id"), ev.get("parent_process_id"), ev.get("file_path"), ev.get("source_ip"),
            ev.get("destination_ip"), ev.get("domain"), ev["severity"], details, ev["collection_status"])


# --------------------------------------------------------------------------------------
# SQLite schema and connection
# --------------------------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    event_category TEXT NOT NULL CHECK (event_category IN
        ('system','login','process','file','network','dns','device','security')),
    event_type TEXT NOT NULL,
    source TEXT NOT NULL,
    username TEXT,
    process_id INTEGER,
    parent_process_id INTEGER,
    file_path TEXT,
    source_ip TEXT,
    destination_ip TEXT,
    domain TEXT,
    severity TEXT NOT NULL DEFAULT 'unknown'
        CHECK (severity IN ('informational','low','medium','high','unknown')),
    details_json TEXT,
    collection_status TEXT NOT NULL DEFAULT 'collected'
        CHECK (collection_status IN ('collected','partial','error'))
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_cat_type_ts ON events(event_category, event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_sev_ts ON events(severity, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_domain ON events(domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_path ON events(file_path) WHERE file_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_dst ON events(destination_ip) WHERE destination_ip IS NOT NULL;

CREATE TABLE IF NOT EXISTS collector_status (
    collector TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'starting',   -- starting|running|unavailable|error|stopped
    status_detail TEXT,
    started_at TEXT,
    last_success TEXT,
    last_error TEXT,
    last_error_at TEXT,
    error_count INTEGER NOT NULL DEFAULT 0,
    events_recorded INTEGER NOT NULL DEFAULT 0,
    known_gaps TEXT,
    details_json TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (      -- resume points and small persisted state
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL
);
"""


def open_db(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path), timeout=30, isolation_level=None)  # we issue BEGIN/COMMIT
    conn.execute("PRAGMA busy_timeout=30000")
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(path: Path) -> None:
    new = not path.exists()
    conn = sqlite3.connect(str(path), timeout=30, isolation_level=None)
    try:
        if new:
            conn.execute("PRAGMA auto_vacuum=INCREMENTAL")   # only effective before tables exist
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(SCHEMA)
        conn.execute("PRAGMA user_version=1")
    finally:
        conn.close()


def harden_data_dir(path: Path) -> None:
    """Restrict the data directory to this user, SYSTEM and Administrators (Windows only).
    Inheritance is removed only after every grant succeeded, so we cannot lock ourselves out."""
    if not IS_WINDOWS:
        try:
            os.chmod(path, 0o700)
        except OSError:
            pass
        return
    user = f"{os.environ.get('USERDOMAIN', '')}\\{os.environ.get('USERNAME', '')}".strip("\\")
    grants = [user, "*S-1-5-18", "*S-1-5-32-544"]       # user, SYSTEM, Administrators
    try:
        for who in grants:
            rc, _, err = run_cmd(["icacls", str(path), "/grant:r", f"{who}:(OI)(CI)F"], timeout=30)
            if rc != 0:
                log.warning("Could not tighten permissions on %s (grant for %s failed): %s", path, who, err.strip())
                return
        rc, _, err = run_cmd(["icacls", str(path), "/inheritance:r"], timeout=30)
        if rc != 0:
            log.warning("Could not remove inherited permissions on %s: %s", path, err.strip())
    except Exception as exc:  # hardening is best-effort
        log.warning("Directory hardening skipped: %s", exc)


class SingleInstance:
    """Cross-session lock file. Released automatically if the process dies."""

    def __init__(self, path: Path):
        self.path = path
        self._fh = None

    def acquire(self) -> bool:
        self._fh = open(self.path, "a+")
        try:
            if IS_WINDOWS:
                import msvcrt
                self._fh.seek(1 << 20)                       # lock a byte far from the pid text
                msvcrt.locking(self._fh.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self._fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self._fh.close()
            self._fh = None
            return False
        try:
            self._fh.seek(0)
            self._fh.truncate(0)
            self._fh.write(str(os.getpid()))
            self._fh.flush()
        except OSError:
            pass
        return True


# --------------------------------------------------------------------------------------
# Analysis helpers (pure functions: static indicators only, nothing is executed)
# --------------------------------------------------------------------------------------
EXEC_EXT = {".exe", ".dll", ".sys", ".scr", ".com", ".msi", ".bat", ".cmd", ".ps1", ".vbs", ".vbe",
            ".js", ".jse", ".wsf", ".wsh", ".hta", ".lnk", ".jar", ".cpl", ".reg", ".pif"}
DOC_EXT = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".jpg", ".jpeg",
           ".png", ".gif", ".bmp", ".mp3", ".mp4", ".avi", ".mkv", ".zip", ".csv"}
SYSTEM_BINARIES = {"svchost.exe", "lsass.exe", "csrss.exe", "winlogon.exe", "services.exe", "smss.exe",
                   "wininit.exe", "explorer.exe", "taskhostw.exe", "dwm.exe", "spoolsv.exe", "lsm.exe"}


def norm_path(path: str) -> str:
    return path.replace("/", "\\").lower()


def classify_location(path: str) -> str:
    p = norm_path(path)
    if "\\start menu\\programs\\startup\\" in p or p.endswith("\\start menu\\programs\\startup"):
        return "startup_folder"
    if "\\$recycle.bin\\" in p:
        return "recycle_bin"
    if "\\appdata\\local\\temp\\" in p or "\\windows\\temp\\" in p or p.startswith("/tmp/"):
        return "temp"
    if "\\downloads\\" in p:
        return "downloads"
    return "other"


def assess_file(path: str, header: bytes = b"") -> List[Tuple[str, str]]:
    """Static filename/location/header indicators -> [(reason, severity)]. Leads, not proof."""
    reasons: List[Tuple[str, str]] = []
    name = ntpath.basename(norm_path(path))
    ext = ntpath.splitext(name)[1]
    parts = name.split(".")
    if len(parts) >= 3 and f".{parts[-2]}" in DOC_EXT and f".{parts[-1]}" in EXEC_EXT:
        reasons.append(("double_extension_executable_disguised_as_document", "high"))
    if "\u202e" in path:
        reasons.append(("right_to_left_override_character_in_filename", "high"))
    if ext in DOC_EXT and header[:2] == b"MZ":
        reasons.append(("windows_executable_content_with_document_extension", "high"))
    if ext in EXEC_EXT:
        where = classify_location(path)
        if where == "startup_folder":
            reasons.append(("executable_or_script_in_startup_folder", "medium"))
        elif where == "temp":
            reasons.append(("executable_or_script_in_temp_directory", "low"))
        elif where == "downloads":
            reasons.append(("executable_or_script_in_downloads_directory", "low"))
        elif where == "recycle_bin":
            reasons.append(("executable_or_script_in_recycle_bin", "medium"))
    return reasons


def assess_command(cmd: str) -> List[Tuple[str, str]]:
    c = cmd.lower().replace("/", "\\") if cmd else ""
    reasons: List[Tuple[str, str]] = []
    if re.search(r"powershell.*(-enc|-encodedcommand|downloadstring|iex\b|invoke-expression)", c):
        reasons.append(("encoded_or_download_powershell_command", "high"))
    if re.search(r"\b(mshta|regsvr32|rundll32|wscript|cscript|certutil|bitsadmin)\b", c) and \
            re.search(r"http|\\appdata\\|\\temp\\|-urlcache|/i:", c):
        reasons.append(("living_off_the_land_binary_with_remote_or_temp_target", "high"))
    if classify_location(c) in ("temp", "recycle_bin") or "\\users\\public\\" in c or "\\programdata\\" in c and "\\temp\\" in c:
        reasons.append(("command_references_temp_or_public_location", "medium"))
    return reasons


def assess_process(name: str, exe: Optional[str]) -> List[Tuple[str, str]]:
    if not exe:
        return []
    reasons: List[Tuple[str, str]] = []
    e = norm_path(exe)
    sysroot = os.environ.get("SystemRoot", r"C:\Windows").lower().replace("/", "\\")
    if name.lower() in SYSTEM_BINARIES and not e.startswith(sysroot + "\\"):
        reasons.append(("system_process_name_running_from_unexpected_location", "high"))
    where = classify_location(e)
    if where in ("temp", "recycle_bin"):
        reasons.append((f"process_running_from_{where}", "medium"))
    return reasons


def assess_domain(domain: str, blocklist: set, flag_generated: bool) -> List[Tuple[str, str]]:
    d = domain.lower().rstrip(".")
    reasons: List[Tuple[str, str]] = []
    labels = d.split(".")
    for i in range(len(labels) - 1):
        if ".".join(labels[i:]) in blocklist:
            reasons.append(("domain_on_local_blocklist", "high"))
            break
    if any(l.startswith("xn--") for l in labels):
        reasons.append(("punycode_internationalised_domain", "low"))
    if flag_generated and len(labels) >= 2:
        longest = max(labels[:-1], key=len)
        if len(longest) >= 20 and entropy(longest) > 3.7:
            reasons.append(("possible_algorithmically_generated_name", "low"))
    return reasons


def max_severity(reasons: Iterable[Tuple[str, str]]) -> str:
    best = "informational"
    for _, sev in reasons:
        if SEV_RANK[sev] > SEV_RANK[best]:
            best = sev
    return best


def load_blocklist(path: str) -> set:
    out = set()
    if not path:
        return out
    try:
        for line in Path(path).read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.split("#", 1)[0].strip().lower()
            if line:
                out.add(line.split()[-1].rstrip("."))   # supports plain lists and hosts-file format
    except OSError as exc:
        log.warning("Cannot read DNS blocklist %s: %s", path, exc)
    return out


class HashService:
    """SHA-256 with a small cache keyed on (path, size, mtime). Read-only."""

    def __init__(self, max_mb: int):
        self.max_bytes = int(max_mb) * 1024 * 1024
        self._cache: "collections.OrderedDict[tuple, str]" = collections.OrderedDict()
        self._lock = threading.Lock()

    def sha256(self, path: str, max_mb: Optional[int] = None) -> Tuple[Optional[str], Optional[str]]:
        limit = int(max_mb) * 1024 * 1024 if max_mb else self.max_bytes
        try:
            st = os.stat(path)
        except OSError as exc:
            return None, f"stat failed: {exc.strerror or exc}"
        if not stat_mod.S_ISREG(st.st_mode):
            return None, "not a regular file"
        if st.st_size > limit:
            return None, "larger than configured hash limit"
        key = (path, st.st_size, st.st_mtime_ns)
        with self._lock:
            if key in self._cache:
                return self._cache[key], None
        try:
            h = hashlib.sha256()
            with open(path, "rb") as fh:
                for chunk in iter(lambda: fh.read(1 << 20), b""):
                    h.update(chunk)
        except OSError as exc:
            return None, f"read failed: {exc.strerror or exc}"
        digest = h.hexdigest()
        with self._lock:
            self._cache[key] = digest
            while len(self._cache) > 4096:
                self._cache.popitem(last=False)
        return digest, None


class FailedLoginDetector:
    """Raises a 'repeated_failed_logins' observation; takes no action."""

    def __init__(self, threshold: int, window_minutes: int):
        self.threshold = max(2, int(threshold))
        self.window = max(1, int(window_minutes)) * 60
        self._hits: Dict[Tuple[str, str], collections.deque] = collections.defaultdict(collections.deque)
        self._last_alert: Dict[Tuple[str, str], float] = {}
        self._lock = threading.Lock()

    def observe(self, ev: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if ev["event_category"] != "login" or ev["event_type"] != "logon_failed":
            return None
        t = ev["epoch"]
        with self._lock:
            for kind, value in (("username", ev.get("username")), ("source_ip", ev.get("source_ip"))):
                if not value:
                    continue
                key = (kind, str(value).lower())
                dq = self._hits[key]
                dq.append(t)
                while dq and t - dq[0] > self.window:
                    dq.popleft()
                if len(dq) >= self.threshold and t - self._last_alert.get(key, -1e18) > self.window:
                    self._last_alert[key] = t
                    return make_event(
                        "security", "repeated_failed_logins", "heuristic: failed-login counter",
                        collector="analyzer", severity="high" if len(dq) >= self.threshold * 2 else "medium",
                        timestamp=ev["timestamp"], username=ev.get("username"), src_ip=ev.get("source_ip"),
                        details={"reason": f"{len(dq)} failed logons for the same {kind} within "
                                           f"{self.window // 60} minutes", "grouped_by": kind, "value": value,
                                 "threshold": self.threshold, "classification_source": "FailedLoginDetector"})
        return None


# --------------------------------------------------------------------------------------
# Event pipeline: bounded queue -> single SQLite writer thread
# --------------------------------------------------------------------------------------
class Sink:
    def __init__(self, maxsize: int, analyzers: list):
        self.q: "queue.Queue[tuple]" = queue.Queue(maxsize=maxsize)
        self.analyzers = analyzers
        self._dropped = 0
        self._lock = threading.Lock()

    def _put(self, item: tuple) -> None:
        try:
            self.q.put_nowait(item)
        except queue.Full:
            with self._lock:
                self._dropped += 1

    def emit(self, ev: Dict[str, Any]) -> None:
        extra = []
        for a in self.analyzers:
            try:
                r = a.observe(ev)
                if r:
                    extra.append(r)
            except Exception:
                log.exception("analyzer failed")
        self._put(("event", ev))
        for e in extra:
            self._put(("event", e))

    def status(self, collector: str, **fields: Any) -> None:
        self._put(("status", (collector, fields)))

    def bookmark(self, key: str, value: Any) -> None:
        self._put(("bookmark", (key, str(value))))

    def take_dropped(self) -> int:
        with self._lock:
            d, self._dropped = self._dropped, 0
        return d

    def close(self) -> None:
        # Block until the queue has room so the writer always receives its stop marker.
        self.q.put(("stop", None))


STATUS_COLS = {"status", "status_detail", "started_at", "last_success", "last_error",
               "last_error_at", "known_gaps", "details_json"}      # whitelist: column names never come from data
POISON_ERRORS = (sqlite3.IntegrityError, sqlite3.InterfaceError, sqlite3.ProgrammingError, OverflowError)


def upsert_status(conn: sqlite3.Connection, collector: str, fields: Dict[str, Any]) -> None:
    now = utc_now()
    conn.execute("INSERT OR IGNORE INTO collector_status(collector, status, updated_at) VALUES (?, 'starting', ?)",
                 (collector, now))
    sets: List[str] = []
    args: List[Any] = []
    for k, v in fields.items():
        if k in STATUS_COLS:
            sets.append(f"{k}=?")
            args.append(v if not isinstance(v, (dict, list)) else json.dumps(v, default=str))
        elif k == "events_recorded_inc":
            sets.append("events_recorded=events_recorded+?")
            args.append(int(v))
        elif k == "error":
            sets += ["last_error=?", "last_error_at=?", "error_count=error_count+1"]
            args += [str(v)[:1000], now]
    sets.append("updated_at=?")
    args.append(now)
    conn.execute(f"UPDATE collector_status SET {', '.join(sets)} WHERE collector=?", args + [collector])


def set_bookmark(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("INSERT INTO bookmarks(key, value, updated_at) VALUES (?,?,?) "
                 "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
                 (key, value, utc_now()))


INSERT_SQL = ("INSERT INTO events (timestamp, event_category, event_type, source, username, process_id, "
              "parent_process_id, file_path, source_ip, destination_ip, domain, severity, details_json, "
              "collection_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")


class DatabaseWriter:
    """Owns the only write connection. Runs in its own (non-daemon) thread."""

    def __init__(self, db_path: Path, sink: Sink, cfg: Dict[str, Any]):
        self.db_path, self.sink, self.cfg = db_path, sink, cfg
        self.purge_requested = threading.Event()
        self.rows_written = 0
        self._last_writer_status = 0.0
        self._thread = threading.Thread(target=self.run, name="db-writer", daemon=False)

    def start(self) -> None:
        self._thread.start()

    def join(self, timeout: Optional[float] = None) -> None:
        self._thread.join(timeout)

    def is_alive(self) -> bool:
        return self._thread.is_alive()

    def _drain(self) -> Tuple[list, bool]:
        try:
            batch = [self.sink.q.get(timeout=1.0)]
        except queue.Empty:
            return [], False
        while len(batch) < 500:
            try:
                batch.append(self.sink.q.get_nowait())
            except queue.Empty:
                break
        stopping = any(kind == "stop" for kind, _ in batch)
        return [it for it in batch if it[0] != "stop"], stopping

    def _apply(self, conn: sqlite3.Connection, items: list) -> None:
        conn.execute("BEGIN IMMEDIATE")
        try:
            rows, per_collector = [], collections.Counter()
            for kind, payload in items:
                if kind == "event":
                    rows.append(event_row(payload))
                    if payload.get("collector"):
                        per_collector[payload["collector"]] += 1
            if rows:
                conn.executemany(INSERT_SQL, rows)
            for kind, payload in items:
                if kind == "status":
                    upsert_status(conn, payload[0], payload[1])
                elif kind == "bookmark":
                    set_bookmark(conn, payload[0], payload[1])
            for collector, n in per_collector.items():
                upsert_status(conn, collector, {"events_recorded_inc": n})
            conn.execute("COMMIT")
            self.rows_written += len(rows)
        except BaseException:
            try:
                conn.execute("ROLLBACK")
            except sqlite3.Error:
                pass
            raise

    def _apply_individually(self, conn: sqlite3.Connection, items: list) -> None:
        for item in items:                       # isolate a malformed ("poison") row
            try:
                self._apply(conn, [item])
            except POISON_ERRORS as exc:
                log.error("Discarding unstorable item (%s): %s", exc, str(item)[:200])

    def _purge(self, conn: sqlite3.Connection) -> None:
        total = 0
        days = int(self.cfg.get("retention_days", 0) or 0)
        if days > 0:
            cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
            while True:
                n = conn.execute("DELETE FROM events WHERE id IN "
                                 "(SELECT id FROM events WHERE timestamp < ? LIMIT 5000)", (cutoff,)).rowcount
                total += max(n, 0)
                if n < 5000:
                    break
        max_rows = int(self.cfg.get("max_rows", 0) or 0)
        if max_rows > 0:
            count = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
            excess = count - max_rows
            while excess > 0:
                n = conn.execute("DELETE FROM events WHERE id IN (SELECT id FROM events ORDER BY id LIMIT ?)",
                                 (min(excess, 5000),)).rowcount
                total += max(n, 0)
                excess -= 5000
                if n <= 0:
                    break
        if total:
            conn.execute("PRAGMA incremental_vacuum(2000)")
            self.sink.emit(make_event("system", "retention_purge", "system_monitor", collector="writer",
                                      details={"rows_deleted": total, "retention_days": days, "max_rows": max_rows}))
        conn.execute("PRAGMA wal_checkpoint(PASSIVE)")

    def run(self) -> None:
        conn: Optional[sqlite3.Connection] = None
        pending: list = []
        stopping = False
        attempt = 0
        recovered_from: Optional[str] = None
        while True:
            try:
                if conn is None:
                    conn = open_db(self.db_path)
                if self.purge_requested.is_set():
                    self.purge_requested.clear()
                    self._purge(conn)
                if not pending and not stopping:
                    pending, stopping = self._drain()
                if not pending:
                    if stopping:
                        break
                    continue
                try:
                    self._apply(conn, pending)
                except POISON_ERRORS:
                    self._apply_individually(conn, pending)
                pending = []
                if attempt:
                    pending.append(("status", ("writer", {"status": "running", "error": recovered_from or "recovered"})))
                    attempt, recovered_from = 0, None
                dropped = self.sink.take_dropped()
                if dropped:
                    pending.append(("event", make_event(
                        "system", "events_dropped", "system_monitor internal queue", collector="writer",
                        severity="medium", status="partial",
                        details={"dropped_events": dropped,
                                 "reason": "bounded queue was full (database writer slow or unavailable)"})))
                if time.monotonic() - self._last_writer_status > 30:
                    self._last_writer_status = time.monotonic()
                    pending.append(("status", ("writer", {"status": "running", "last_success": utc_now()})))
            except sqlite3.Error as exc:          # locked / disk full / I/O error: retry, never lose the batch
                attempt += 1
                recovered_from = f"database error: {exc}"
                log.error("Database write failed (attempt %d): %s", attempt, exc)
                try:
                    if conn:
                        conn.close()
                except sqlite3.Error:
                    pass
                conn = None
                if stopping and attempt > 8:
                    log.error("Giving up on %d unsaved items at shutdown", len(pending))
                    break
                time.sleep(min(30.0, 0.5 * 2 ** attempt))
            except Exception:
                log.exception("unexpected writer error")
                time.sleep(1)
        try:
            if conn:
                conn.close()
        except sqlite3.Error:
            pass


# --------------------------------------------------------------------------------------
# Collector framework
# --------------------------------------------------------------------------------------
class CollectorUnavailable(Exception):
    """A prerequisite (OS, permission, log, library) is missing; retried every 5 minutes."""


class Collector:
    """Base class. Deliberately NOT a Thread subclass (avoids clashing with Thread's private attributes)."""
    cname = "base"
    default_interval = 5.0
    known_gaps = ""

    def __init__(self, app: "App"):
        self.app, self.cfg, self.sink, self.stop_event = app, app.cfg, app.sink, app.stop
        self.interval = float(app.cfg["intervals"].get(self.cname, self.default_interval))
        self._state = "starting"
        self._last_push = 0.0
        self._thread = threading.Thread(target=self.run, name=f"collector-{self.cname}", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def join(self, timeout: Optional[float] = None) -> None:
        self._thread.join(timeout)

    def is_alive(self) -> bool:
        return self._thread.is_alive()

    # -- API for subclasses -------------------------------------------------------
    def setup(self) -> None: ...
    def poll(self) -> None: raise NotImplementedError
    def teardown(self) -> None: ...

    def emit(self, ev: Dict[str, Any]) -> None:
        ev["collector"] = self.cname
        self.sink.emit(ev)

    def get_bookmark(self, key: str) -> Optional[str]:
        return self.app.read_bookmark(key)

    def set_bookmark(self, key: str, value: Any) -> None:
        self.sink.bookmark(key, value)

    def set_details(self, **details: Any) -> None:
        self.sink.status(self.cname, details_json=details)

    # -- lifecycle -----------------------------------------------------------------
    def _transition(self, state: str, detail: str = "", error: bool = False) -> None:
        fields: Dict[str, Any] = {"status": state, "status_detail": detail[:500]}
        if error:
            fields["error"] = detail
        if state == "running":
            fields["last_success"] = utc_now()
        self.sink.status(self.cname, **fields)
        if state != self._state:
            if state in ("unavailable", "error"):
                self.emit(make_event("system", f"collector_{state}", f"collector:{self.cname}", severity="low",
                                     status="partial", details={"collector": self.cname, "detail": detail[:500],
                                                                "known_gaps": self.known_gaps}))
            elif state == "running" and self._state in ("unavailable", "error"):
                self.emit(make_event("system", "collector_recovered", f"collector:{self.cname}",
                                     details={"collector": self.cname}))
            self._state = state

    def _setup_loop(self) -> bool:
        while not self.stop_event.is_set():
            try:
                self.setup()
                return True
            except CollectorUnavailable as exc:
                log.warning("[%s] unavailable: %s", self.cname, exc)
                self._transition("unavailable", str(exc))
                wait = 300.0
            except Exception as exc:
                log.exception("[%s] setup failed", self.cname)
                self._transition("error", f"setup failed: {exc!r}", error=True)
                wait = 60.0
            if self.stop_event.wait(wait):
                return False
        return False

    def run(self) -> None:
        self.sink.status(self.cname, status="starting", started_at=utc_now(), known_gaps=self.known_gaps)
        try:
            if not self._setup_loop():
                return
            self._transition("running")
            failures = 0
            while not self.stop_event.is_set():
                try:
                    self.poll()
                    if failures or self._state != "running":
                        failures = 0
                        self._transition("running")
                    elif time.monotonic() - self._last_push > 60:
                        self._last_push = time.monotonic()
                        self.sink.status(self.cname, status="running", last_success=utc_now())
                except CollectorUnavailable as exc:
                    self._transition("unavailable", str(exc))
                    try:
                        self.teardown()
                    except Exception:
                        pass
                    if not self._setup_loop():
                        return
                except Exception as exc:
                    failures += 1
                    log.exception("[%s] poll failed", self.cname)
                    self._transition("error", repr(exc), error=True)
                    if self.stop_event.wait(min(60, 2 ** failures)):
                        break
                if self.stop_event.wait(self.interval):
                    break
        finally:
            try:
                self.teardown()
            except Exception:
                pass
            if self._state in ("unavailable", "error"):
                pass          # keep the last meaningful state so the coverage gap stays visible
            else:
                self.sink.status(self.cname, status="stopped")


# --------------------------------------------------------------------------------------
# Windows Event Log collectors (wevtutil, polling with a persisted RecordID bookmark)
# --------------------------------------------------------------------------------------
EVT_NS = {"e": "http://schemas.microsoft.com/win/2004/08/events/event"}
MAX_IDS_PER_QUERY = 15   # Windows XPath filters fail ("operator is unsupported") above ~22 expressions
LOGON_TYPES = {2: "interactive", 3: "network", 4: "batch", 5: "service", 7: "unlock", 8: "network_cleartext",
               9: "new_credentials", 10: "remote_interactive", 11: "cached_interactive",
               12: "cached_remote_interactive", 13: "cached_unlock"}
FAIL_STATUS = {"0xc000006a": "wrong password", "0xc0000064": "unknown user name", "0xc0000072": "account disabled",
               "0xc0000234": "account locked out", "0xc000006d": "logon failure (bad name or password)",
               "0xc0000070": "workstation restriction", "0xc0000071": "password expired",
               "0xc0000193": "account expired", "0xc000006e": "account restriction",
               "0xc000015b": "logon type not granted"}


def parse_events_xml(xml_text: str) -> List[Dict[str, Any]]:
    """Parse the concatenated <Event> documents emitted by `wevtutil qe /f:xml`."""
    xml_text = re.sub(r"<\?xml[^>]*\?>", "", xml_text)
    root = ET.fromstring("<Events>" + xml_text + "</Events>")
    out = []
    for ev in root.findall("e:Event", EVT_NS):
        sysel = ev.find("e:System", EVT_NS)
        if sysel is None:
            continue
        try:
            eid = int(sysel.findtext("e:EventID", default="0", namespaces=EVT_NS))
            rec = int(sysel.findtext("e:EventRecordID", default="0", namespaces=EVT_NS))
        except ValueError:
            continue
        prov = sysel.find("e:Provider", EVT_NS)
        tc = sysel.find("e:TimeCreated", EVT_NS)
        sec = sysel.find("e:Security", EVT_NS)
        data: Dict[str, str] = {}
        ed = ev.find("e:EventData", EVT_NS)
        if ed is not None:
            for i, d in enumerate(ed.findall("e:Data", EVT_NS)):
                data[d.get("Name") or f"Data{i}"] = d.text or ""
        ud = ev.find("e:UserData", EVT_NS)
        if ud is not None and len(ud):
            for child in list(ud)[0]:
                data[child.tag.split("}")[-1]] = child.text or ""
        out.append({"event_id": eid, "record_id": rec, "provider": prov.get("Name", "") if prov is not None else "",
                    "time": windows_time_to_iso(tc.get("SystemTime") if tc is not None else None),
                    "sid": sec.get("UserID") if sec is not None else None, "data": data})
    return out


def trim_data(data: Dict[str, str], limit: int = 15) -> Dict[str, str]:
    return {k: v[:200] for k, v in list(data.items())[:limit]}


class WevtCollector(Collector):
    log_name = ""
    event_ids: Tuple[int, ...] = ()
    batch = 500
    needs_enabled_log = False

    def event_filter_ids(self) -> Tuple[int, ...]:
        return self.event_ids

    def handle(self, p: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def _wevt(self, args: List[str]) -> str:
        rc, out, err = run_cmd(["wevtutil"] + args, timeout=60)
        if rc != 0:
            text = (err or out).strip()
            low = text.lower()
            if rc == 5 or "access is denied" in low:
                raise CollectorUnavailable(f"access denied reading '{self.log_name}': run as Administrator or add the "
                                           f"account to 'Event Log Readers'")
            if rc == 15007 or "could not be found" in low or "channel" in low and "not" in low:
                raise CollectorUnavailable(f"event log '{self.log_name}' not found (feature or product not installed)")
            raise RuntimeError(f"wevtutil exited {rc}: {text[:300]}")
        return out

    def _query(self, xpath: Optional[str], count: int, newest_first: bool = False) -> List[Dict[str, Any]]:
        args = ["qe", self.log_name, "/f:xml", f"/c:{count}", f"/rd:{'true' if newest_first else 'false'}"]
        if xpath:
            args.insert(2, f"/q:{xpath}")
        out = self._wevt(args)
        return parse_events_xml(out) if out.strip() else []

    def _latest_record_id(self) -> int:
        evs = self._query(None, 1, newest_first=True)
        return evs[0]["record_id"] if evs else 0

    def setup(self) -> None:
        if not IS_WINDOWS:
            raise CollectorUnavailable("Windows Event Log is only available on Windows")
        rc, out, err = run_cmd(["wevtutil", "gl", self.log_name], timeout=30)
        if rc != 0:
            text = (err or out).strip()
            if rc == 5 or "access is denied" in text.lower():
                raise CollectorUnavailable(f"access denied to '{self.log_name}': run as Administrator")
            raise CollectorUnavailable(f"event log '{self.log_name}' not available: {text[:200]}")
        if self.needs_enabled_log and re.search(r"enabled:\s*false", out, re.I):
            raise CollectorUnavailable(f"log '{self.log_name}' is disabled; enable it (Administrator): "
                                       f"wevtutil sl \"{self.log_name}\" /e:true")
        latest = self._latest_record_id()
        stored = self.get_bookmark(f"evt:{self.log_name}")
        if stored is not None and stored.isdigit():
            self.last_id = int(stored)
            if latest < self.last_id:      # log cleared or reset since last run
                self.emit(make_event("system", "event_log_reset_or_cleared", f"collector:{self.cname}",
                                     severity="medium", status="partial",
                                     details={"log": self.log_name, "bookmark": self.last_id, "latest_record_id": latest,
                                              "note": "events before this point may be lost"}))
                self.last_id = latest
        else:
            self.last_id = latest
            mins = int(self.cfg["eventlog"].get("backfill_minutes", 0) or 0)
            if mins > 0:
                self._backfill(mins)

    def _id_chunks(self) -> List[Tuple[int, ...]]:
        ids = tuple(self.event_filter_ids())
        return [ids[i:i + MAX_IDS_PER_QUERY] for i in range(0, len(ids), MAX_IDS_PER_QUERY)]

    @staticmethod
    def _id_condition(chunk: Tuple[int, ...]) -> str:
        return " or ".join(f"EventID={i}" for i in chunk)

    def _backfill(self, minutes: int) -> None:
        base = self.last_id
        found: List[Dict[str, Any]] = []
        for chunk in self._id_chunks():
            xpath = (f"*[System[({self._id_condition(chunk)}) and "
                     f"TimeCreated[timediff(@SystemTime) <= {minutes * 60000}]]]")
            found.extend(self._query(xpath, 2000))
        for p in sorted(found, key=lambda e: e["record_id"]):
            if p["record_id"] <= base:
                self._process(p)

    def _process(self, p: Dict[str, Any]) -> None:
        ev = self.handle(p)
        if ev:
            ev["details"].setdefault("event_record_id", p["record_id"])
            self.emit(ev)

    def poll(self) -> None:
        # Windows rejects XPath filters with more than ~22 expressions, so the event IDs are queried in chunks.
        # All chunks share one upper bound (latest record id at the start of this round) so none can be skipped.
        chunks = self._id_chunks()
        while not self.stop_event.is_set():
            latest = self._latest_record_id()
            if latest < self.last_id:                       # log cleared/reset while running
                self.emit(make_event("system", "event_log_reset_or_cleared", f"collector:{self.cname}",
                                     severity="medium", status="partial",
                                     details={"log": self.log_name, "bookmark": self.last_id, "latest_record_id": latest,
                                              "note": "events before this point may be lost"}))
                self.last_id = latest
                self.set_bookmark(f"evt:{self.log_name}", self.last_id)
                return
            if latest == self.last_id:
                return
            collected: List[Dict[str, Any]] = []
            watermark = latest
            for chunk in chunks:
                xpath = (f"*[System[({self._id_condition(chunk)}) and "
                         f"(EventRecordID > {self.last_id}) and (EventRecordID <= {latest})]]")
                evs = self._query(xpath, self.batch)
                collected.extend(evs)
                if len(evs) >= self.batch:                  # truncated: only trust results up to its last record
                    watermark = min(watermark, max(e["record_id"] for e in evs))
            for p in sorted(collected, key=lambda e: e["record_id"]):
                if p["record_id"] <= watermark:
                    self._process(p)
            self.last_id = watermark
            self.set_bookmark(f"evt:{self.log_name}", self.last_id)
            if watermark >= latest:
                return


class SecurityLogCollector(WevtCollector):
    cname = "eventlog_security"
    log_name = "Security"
    known_gaps = ("Polling. Needs Administrator or 'Event Log Readers'. Only events enabled in the Windows audit policy "
                  "exist (4688/4689 process events and 4698 task events are OFF by default). Log wrap/clear can lose events.")
    event_ids = (4624, 4625, 4634, 4647, 4672, 4688, 4689, 4697, 4698, 4699, 4702, 4719, 4720, 4722, 4723, 4724,
                 4725, 4726, 4728, 4729, 4732, 4733, 4738, 4740, 4756, 4757, 4781, 1102)
    ACCOUNT = {4720: ("user_account_created", "medium"), 4722: ("user_account_enabled", "low"),
               4725: ("user_account_disabled", "low"), 4726: ("user_account_deleted", "medium"),
               4723: ("password_change_attempt", "low"), 4724: ("password_reset_attempt", "medium"),
               4738: ("user_account_changed", "low"), 4781: ("account_renamed", "low")}
    GROUP = {4728: ("member_added_to_global_group", "medium"), 4732: ("member_added_to_local_group", "medium"),
             4756: ("member_added_to_universal_group", "medium"), 4729: ("member_removed_from_global_group", "low"),
             4733: ("member_removed_from_local_group", "low"), 4757: ("member_removed_from_universal_group", "low")}
    MISC = {4719: ("security", "audit_policy_changed", "high"), 1102: ("security", "audit_log_cleared", "high"),
            4697: ("security", "service_installed", "medium"), 4698: ("security", "scheduled_task_created", "medium"),
            4699: ("security", "scheduled_task_deleted", "low"), 4702: ("security", "scheduled_task_updated", "low")}

    def handle(self, p: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        i, d, ts = p["event_id"], p["data"], p["time"]
        src = f"Windows Security Event Log (EventID {i})"
        cfg = self.cfg["eventlog"]
        if i == 4624:
            lt = int(d.get("LogonType") or 0)
            user, dom = d.get("TargetUserName", ""), d.get("TargetDomainName", "")
            if lt not in cfg["logon_types"] or user.endswith("$") or dom in ("NT AUTHORITY", "Window Manager", "Font Driver Host"):
                return None
            return make_event("login", "logon_success", src, timestamp=ts, username=user or None,
                              src_ip=clean(d.get("IpAddress")), details={
                                  "event_id": i, "logon_type": lt, "logon_type_name": LOGON_TYPES.get(lt, "other"),
                                  "is_remote": lt in (10, 12), "domain": dom, "workstation": clean(d.get("WorkstationName")),
                                  "auth_package": d.get("AuthenticationPackageName"), "logon_process": d.get("LogonProcessName"),
                                  "logon_id": d.get("TargetLogonId")})
        if i == 4625:
            lt = int(d.get("LogonType") or 0)
            st = (d.get("Status") or "").lower()
            sub = (d.get("SubStatus") or "").lower()
            return make_event("login", "logon_failed", src, timestamp=ts, severity="low",
                              username=clean(d.get("TargetUserName")), src_ip=clean(d.get("IpAddress")), details={
                                  "event_id": i, "logon_type": lt, "logon_type_name": LOGON_TYPES.get(lt, "other"),
                                  "failure_reason": FAIL_STATUS.get(sub) or FAIL_STATUS.get(st) or "unspecified",
                                  "status": st, "sub_status": sub, "workstation": clean(d.get("WorkstationName")),
                                  "domain": d.get("TargetDomainName")})
        if i in (4634, 4647):
            if not cfg["record_logoff"] or (d.get("TargetUserName") or "").endswith("$"):
                return None
            return make_event("login", "logoff", src, timestamp=ts, username=clean(d.get("TargetUserName")),
                              details={"event_id": i})
        if i == 4672:
            if not cfg["record_special_privileges"] or (d.get("SubjectUserName") or "").endswith("$"):
                return None
            return make_event("login", "special_privileges_assigned", src, timestamp=ts,
                              username=clean(d.get("SubjectUserName")),
                              details={"event_id": i, "privileges": (d.get("PrivilegeList") or "").split()[:30]})
        if i == 4740:
            return make_event("login", "account_lockout", src, timestamp=ts, severity="high",
                              username=clean(d.get("TargetUserName")),
                              details={"event_id": i, "caller_computer": clean(d.get("TargetDomainName"))})
        if i in self.ACCOUNT:
            etype, sev = self.ACCOUNT[i]
            return make_event("login", etype, src, timestamp=ts, severity=sev, username=clean(d.get("SubjectUserName")),
                              details={"event_id": i, "target_account": clean(d.get("TargetUserName")),
                                       "target_domain": clean(d.get("TargetDomainName"))})
        if i in self.GROUP:
            etype, sev = self.GROUP[i]
            if d.get("TargetSid") == "S-1-5-32-544" and "added" in etype:
                sev = "high"          # Administrators group membership gained
            return make_event("login", etype, src, timestamp=ts, severity=sev, username=clean(d.get("SubjectUserName")),
                              details={"event_id": i, "group": clean(d.get("TargetUserName")),
                                       "group_sid": clean(d.get("TargetSid")), "member_sid": clean(d.get("MemberSid")),
                                       "member_name": clean(d.get("MemberName"))})
        if i in self.MISC:
            cat, etype, sev = self.MISC[i]
            det: Dict[str, Any] = {"event_id": i}
            reasons: List[Tuple[str, str]] = []
            if i == 4697:
                det.update(service=d.get("ServiceName"), image_path=d.get("ServiceFileName"),
                           start_type=d.get("ServiceStartType"), account=d.get("ServiceAccount"))
                reasons = assess_command(d.get("ServiceFileName") or "")
            elif i in (4698, 4702, 4699):
                det["task_name"] = d.get("TaskName")
                m = re.search(r"<Command>(.*?)</Command>", d.get("TaskContent") or "", re.S)
                if m:
                    det["task_command"] = m.group(1).strip()[:500]
                    reasons = assess_command(det["task_command"])
            if reasons:
                det["suspicious_reasons"] = [{"reason": r, "severity": s} for r, s in reasons]
                det["classification_source"] = "assess_command (static command-line indicators)"
                if SEV_RANK[max_severity(reasons)] > SEV_RANK[sev]:
                    sev = max_severity(reasons)
            return make_event(cat, etype, src, timestamp=ts, severity=sev, username=clean(d.get("SubjectUserName")),
                              details=det)
        if i == 4688:
            path = clean(d.get("NewProcessName"))
            pid, ppid = hex_to_int(d.get("NewProcessId")), hex_to_int(d.get("ProcessId"))
            det = {"event_id": i, "name": ntpath.basename(path) if path else None,
                   "parent_path": clean(d.get("ParentProcessName")), "elevation": clean(d.get("TokenElevationType")),
                   "observed_via": "Security auditing (4688)"}
            status = "collected"
            if self.cfg["processes"]["store_command_lines"] and d.get("CommandLine"):
                det["command_line"] = redact_command_line(d["CommandLine"])
            if path and self.cfg["processes"]["hash_executables"]:
                sha, why = self.app.hasher.sha256(path, self.cfg["processes"]["hash_max_mb"])
                if sha:
                    det["sha256"] = sha
                else:
                    det["sha256_unavailable"], status = why, "partial"
            reasons = assess_process(det.get("name") or "", path)
            if reasons:
                det["suspicious_reasons"] = [{"reason": r, "severity": s} for r, s in reasons]
                det["classification_source"] = "assess_process (static path indicators)"
            return make_event("process", "process_created", src, timestamp=ts, severity=max_severity(reasons),
                              username=clean(d.get("SubjectUserName")), pid=pid, ppid=ppid, path=path,
                              details=det, status=status)
        if i == 4689:
            path = clean(d.get("ProcessName"))
            return make_event("process", "process_terminated", src, timestamp=ts, username=clean(d.get("SubjectUserName")),
                              pid=hex_to_int(d.get("ProcessId")), path=path,
                              details={"event_id": i, "name": ntpath.basename(path) if path else None,
                                       "exit_status": d.get("Status"), "observed_via": "Security auditing (4689)"})
        return None


class SystemLogCollector(WevtCollector):
    cname = "eventlog_system"
    log_name = "System"
    default_interval = 10
    known_gaps = ("Polling. Service state changes (7036) are recorded; kernel crash details are limited to what the "
                  "System log contains. Log wrap/clear can lose events.")
    event_ids = (6005, 6006, 6008, 41, 1074, 12, 13, 104, 1001, 7000, 7001, 7009, 7011, 7023, 7024, 7031, 7034,
                 7036, 7040, 7045)

    def event_filter_ids(self) -> Tuple[int, ...]:
        return self.event_ids

    def handle(self, p: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        i, prov, d, ts = p["event_id"], p["provider"], p["data"], p["time"]
        src = f"Windows System Event Log ({prov} {i})"
        scm = prov == "Service Control Manager"
        det: Dict[str, Any] = {"event_id": i, "provider": prov}
        if i == 6005 and prov == "EventLog":
            return make_event("system", "system_startup", src, timestamp=ts, details={**det, "note": "Event Log service started"})
        if i == 6006 and prov == "EventLog":
            return make_event("system", "system_shutdown", src, timestamp=ts, details={**det, "note": "Event Log service stopped (clean shutdown)"})
        if i == 6008 and prov == "EventLog":
            return make_event("system", "unexpected_shutdown", src, timestamp=ts, severity="medium", details=det)
        if i == 41 and "Kernel-Power" in prov:
            return make_event("system", "unexpected_reboot", src, timestamp=ts, severity="medium",
                              details={**det, "bugcheck_code": d.get("BugcheckCode")})
        if i == 12 and "Kernel-General" in prov:
            return make_event("system", "os_started", src, timestamp=ts, details=det)
        if i == 13 and "Kernel-General" in prov:
            return make_event("system", "os_shutdown", src, timestamp=ts, details=det)
        if i == 1074:
            return make_event("system", "shutdown_initiated", src, timestamp=ts, username=clean(d.get("param7")),
                              details={**det, "process": d.get("param1"), "reason": d.get("param3"), "action": d.get("param5")})
        if i == 104:
            return make_event("security", "event_log_cleared", src, timestamp=ts, severity="high",
                              username=clean(d.get("SubjectUserName")), details={**det, "log": d.get("Channel")})
        if i == 1001 and "SystemErrorReporting" in prov:
            return make_event("system", "bugcheck_recorded", src, timestamp=ts, severity="medium",
                              details={**det, "info": (d.get("param1") or "")[:200]})
        if scm:
            name = d.get("param1") or d.get("ServiceName")
            if i == 7036:
                return make_event("system", "service_state_changed", src, timestamp=ts,
                                  details={**det, "service": name, "state": d.get("param2")})
            table = {7000: "service_failed_to_start", 7001: "service_dependency_failed", 7009: "service_start_timeout",
                     7011: "service_response_timeout", 7023: "service_terminated_with_error",
                     7024: "service_terminated_with_service_specific_error", 7031: "service_crashed_recovery_action",
                     7034: "service_terminated_unexpectedly", 7040: "service_start_type_changed"}
            if i in table:
                return make_event("system", table[i], src, timestamp=ts, severity="low" if i in (7001, 7040) else "medium",
                                  details={**det, "service": name, "param2": d.get("param2"), "param3": d.get("param3")})
            if i == 7045:
                image = d.get("ImagePath") or ""
                reasons = assess_command(image)
                return make_event("system", "service_installed", src, timestamp=ts,
                                  severity=max(["medium", max_severity(reasons)], key=lambda s: SEV_RANK[s]),
                                  username=clean(d.get("AccountName")), path=image[:500] or None, details={
                                      **det, "service": d.get("ServiceName"), "start_type": d.get("StartType"),
                                      "service_type": d.get("ServiceType"),
                                      "suspicious_reasons": [{"reason": r, "severity": s} for r, s in reasons],
                                      "classification_source": "assess_command (static command-line indicators)"})
        return None


class DefenderLogCollector(WevtCollector):
    cname = "defender_log"
    log_name = "Microsoft-Windows-Windows Defender/Operational"
    default_interval = 15
    known_gaps = "Reads Microsoft Defender's own event log (read-only). Needs Administrator or Event Log Readers."
    event_ids = (1116, 1117, 1118, 1119, 5001, 5004, 5007, 5010, 5012)
    MAP = {1116: ("defender_threat_detected", "high"), 1117: ("defender_threat_action_taken", "medium"),
           1118: ("defender_threat_action_failed", "high"), 1119: ("defender_threat_action_failed", "high"),
           5001: ("defender_realtime_protection_disabled", "high"), 5004: ("defender_realtime_config_changed", "medium"),
           5007: ("defender_configuration_changed", "medium"), 5010: ("defender_scanning_disabled", "high"),
           5012: ("defender_virus_scanning_disabled", "high")}

    def handle(self, p: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        etype, sev = self.MAP[p["event_id"]]
        d = p["data"]
        return make_event("security", etype, f"Microsoft Defender event log (EventID {p['event_id']})",
                          timestamp=p["time"], severity=sev, path=d.get("Path") or d.get("Resource") or None,
                          username=clean(d.get("Detection User")),
                          details={"event_id": p["event_id"], "threat": d.get("Threat Name"), "data": trim_data(d)})


class SysmonCollector(WevtCollector):
    cname = "sysmon"
    log_name = "Microsoft-Windows-Sysmon/Operational"
    known_gaps = ("Requires Sysmon to be installed and configured by you (not included). What is recorded is exactly "
                  "what your Sysmon configuration logs.")

    def __init__(self, app: "App"):
        super().__init__(app)
        self.event_ids = tuple(int(x) for x in self.cfg["eventlog"]["sysmon_event_ids"])

    def handle(self, p: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        i, d, ts = p["event_id"], p["data"], p["time"]
        src = f"Sysmon (EventID {i})"
        user = clean(d.get("User"))
        if i == 1:
            image = clean(d.get("Image"))
            hashes = dict(h.split("=", 1) for h in (d.get("Hashes") or "").split(",") if "=" in h)
            det = {"event_id": i, "name": ntpath.basename(image) if image else None, "parent_path": clean(d.get("ParentImage")),
                   "sha256": hashes.get("SHA256"), "observed_via": "Sysmon"}
            if self.cfg["processes"]["store_command_lines"] and d.get("CommandLine"):
                det["command_line"] = redact_command_line(d["CommandLine"])
            reasons = assess_process(det["name"] or "", image)
            if reasons:
                det["suspicious_reasons"] = [{"reason": r, "severity": s} for r, s in reasons]
                det["classification_source"] = "assess_process (static path indicators)"
            return make_event("process", "process_created", src, timestamp=ts, severity=max_severity(reasons),
                              username=user, pid=hex_to_int(d.get("ProcessId")), ppid=hex_to_int(d.get("ParentProcessId")),
                              path=image, details=det)
        if i == 5:
            image = clean(d.get("Image"))
            return make_event("process", "process_terminated", src, timestamp=ts, pid=hex_to_int(d.get("ProcessId")),
                              path=image, details={"event_id": i, "name": ntpath.basename(image) if image else None,
                                                   "observed_via": "Sysmon"})
        if i == 3:
            init = (d.get("Initiated") or "").lower() == "true"
            return make_event("network", "network_connection", src, timestamp=ts, username=user,
                              pid=hex_to_int(d.get("ProcessId")), path=clean(d.get("Image")),
                              src_ip=clean(d.get("SourceIp")), dst_ip=clean(d.get("DestinationIp")),
                              domain=clean(d.get("DestinationHostname")), details={
                                  "event_id": i, "protocol": d.get("Protocol"), "initiated_by_local_process": init,
                                  "source_port": hex_to_int(d.get("SourcePort")),
                                  "destination_port": hex_to_int(d.get("DestinationPort")), "observed_via": "Sysmon"})
        if i == 22:
            return self.app.dns_event(clean(d.get("QueryName")), f"Sysmon DNS query (EventID 22)", ts,
                                      path=clean(d.get("Image")), pid=hex_to_int(d.get("ProcessId")), user=user,
                                      extra={"query_status": d.get("QueryStatus"), "answers": (d.get("QueryResults") or "")[:300]})
        if i in (11, 23):
            return make_event("file", "file_created" if i == 11 else "file_deleted", src, timestamp=ts, username=user,
                              pid=hex_to_int(d.get("ProcessId")), path=clean(d.get("TargetFilename")),
                              details={"event_id": i, "by_process": clean(d.get("Image")), "observed_via": "Sysmon"})
        return None


class DnsClientLogCollector(WevtCollector):
    cname = "dns_client_log"
    log_name = "Microsoft-Windows-DNS-Client/Operational"
    needs_enabled_log = True
    event_ids = (3008,)
    known_gaps = ("This log is DISABLED by default (enable as Administrator: wevtutil sl "
                  "Microsoft-Windows-DNS-Client/Operational /e:true). Cached lookups, DNS-over-HTTPS in browsers and "
                  "lookups before enabling are not visible. A lookup is not proof of a connection.")

    def handle(self, p: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        d = p["data"]
        return self.app.dns_event(clean(d.get("QueryName")), "Windows DNS-Client log (EventID 3008)", p["time"],
                                  extra={"query_type": d.get("QueryType"), "query_status": d.get("QueryStatus"),
                                         "answers": (d.get("QueryResults") or "")[:300]})


# --------------------------------------------------------------------------------------
# Polling collectors
# --------------------------------------------------------------------------------------
class ProcessCollector(Collector):
    cname = "processes"
    default_interval = 2
    known_gaps = ("Polling snapshot diff: processes that start and exit between two polls are MISSED, and processes "
                  "already running at startup are not reported as created. For complete process telemetry enable "
                  "Security auditing 4688/4689 or install Sysmon (those collectors then record the same activity "
                  "separately; disable this one if you want to avoid duplicates). Command lines are not stored by default.")

    def setup(self) -> None:
        if psutil is None:
            raise CollectorUnavailable("psutil is not installed (pip install psutil)")
        self.known = self._snapshot()
        self.set_details(baseline_process_count=len(self.known), baseline_not_recorded_as_events=True)

    def _snapshot(self) -> Dict[tuple, Dict[str, Any]]:
        snap = {}
        for p in psutil.process_iter(["pid", "ppid", "name", "create_time", "username", "exe"]):
            try:
                info = p.info
                snap[(info["pid"], info["create_time"])] = info
            except (psutil.NoSuchProcess, psutil.AccessDenied, KeyError):
                continue
        return snap

    def poll(self) -> None:
        cur = self._snapshot()
        hash_on = self.cfg["processes"]["hash_executables"]
        for key in cur.keys() - self.known.keys():
            info = cur[key]
            exe, name = info.get("exe"), info.get("name") or ""
            det: Dict[str, Any] = {"name": name, "observed_via": "psutil polling"}
            status = "collected" if exe else "partial"
            if not exe:
                det["note"] = "executable path not accessible (likely a protected/system process)"
            elif hash_on:
                sha, why = self.app.hasher.sha256(exe, self.cfg["processes"]["hash_max_mb"])
                if sha:
                    det["sha256"] = sha
                else:
                    det["sha256_unavailable"], status = why, "partial"
            reasons = assess_process(name, exe)
            if reasons:
                det["suspicious_reasons"] = [{"reason": r, "severity": s} for r, s in reasons]
                det["classification_source"] = "assess_process (static path indicators)"
            self.emit(make_event("process", "process_created", "psutil process polling", severity=max_severity(reasons),
                                 username=info.get("username"), pid=info["pid"], ppid=info.get("ppid"), path=exe,
                                 details=det, status=status))
        for key in self.known.keys() - cur.keys():
            info = self.known[key]
            self.emit(make_event("process", "process_terminated", "psutil process polling", username=info.get("username"),
                                 pid=info["pid"], ppid=info.get("ppid"), path=info.get("exe"),
                                 details={"name": info.get("name"), "observed_via": "psutil polling",
                                          "lifetime_seconds": round(max(0.0, time.time() - (info.get("create_time") or time.time())), 1)}))
        self.known = cur


class ProcessResourceCollector(Collector):
    """Periodic per-process CPU/RAM snapshots; no command lines or file contents."""
    cname = "process_resources"
    default_interval = 30
    known_gaps = ("Periodic snapshots only; short-lived processes between polls can be missed. Access-denied processes "
                  "are skipped, and only the configured top-N by resident memory are recorded per interval.")

    def setup(self) -> None:
        if psutil is None:
            raise CollectorUnavailable("psutil is not installed (pip install psutil)")
        for p in psutil.process_iter():
            try:
                p.cpu_percent(None)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

    def poll(self) -> None:
        rows = []
        min_bytes = max(0, float(self.cfg["process_resources"].get("min_memory_mb", 0))) * 1024 * 1024
        for p in psutil.process_iter(["pid", "ppid", "name", "username", "exe", "create_time", "memory_info", "memory_percent"]):
            try:
                info = p.info
                mi = info.get("memory_info")
                if not mi:
                    continue
                rss = int(mi.rss)
                if rss < min_bytes:
                    continue
                try:
                    cpu = float(p.cpu_percent(None))
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    cpu = None
                rows.append((rss, info, cpu))
            except (psutil.NoSuchProcess, psutil.AccessDenied, KeyError, TypeError):
                continue
        rows.sort(key=lambda x: x[0], reverse=True)
        cap = max(1, int(self.cfg["process_resources"].get("top_n", 200)))
        for rss, info, cpu in rows[:cap]:
            self.emit(make_event("process", "process_resource_snapshot", "psutil process resource polling",
                username=info.get("username"), pid=info.get("pid"), ppid=info.get("ppid"), path=info.get("exe"),
                details={"name": info.get("name"), "memory_rss_bytes": rss,
                         "memory_rss_mb": round(rss / (1024 * 1024), 2),
                         "memory_percent": round(float(info.get("memory_percent") or 0), 3),
                         "cpu_percent": round(cpu, 2) if cpu is not None else None,
                         "process_start_time": info.get("create_time"), "observed_via": "psutil polling",
                         "note": "RSS is resident physical memory, not a process memory allocation limit"}))
        if len(rows) > cap:
            self.emit(make_event("process", "process_resource_snapshot_truncated", "psutil process resource polling",
                severity="low", status="partial", details={"eligible_processes": len(rows), "recorded_top_n": cap}))


class DiskUsageCollector(Collector):
    """Records disk capacity and raises observations when usage crosses configured thresholds."""
    cname = "disk_usage"
    default_interval = 60
    known_gaps = "Uses shutil.disk_usage on mounted partitions; permissions and transient/removable mounts may limit coverage."

    def setup(self) -> None:
        import shutil
        self.previous = {}
        self.set_details(warning_percent=self.cfg["disk_usage"].get("warning_percent", 85),
                         critical_percent=self.cfg["disk_usage"].get("critical_percent", 95))

    def poll(self) -> None:
        import shutil
        current = {}
        for part in psutil.disk_partitions(all=False) if psutil is not None else []:
            mount = part.mountpoint
            try:
                usage = shutil.disk_usage(mount)
            except OSError:
                continue
            pct = round(usage.used / usage.total * 100, 2) if usage.total else 0.0
            key = os.path.normcase(mount)
            current[key] = {"mountpoint": mount, "filesystem": part.fstype, "total_bytes": usage.total,
                            "used_bytes": usage.used, "free_bytes": usage.free, "used_percent": pct}
            old = self.previous.get(key)
            warning = float(self.cfg["disk_usage"].get("warning_percent", 85))
            critical = float(self.cfg["disk_usage"].get("critical_percent", 95))
            sev = "high" if pct >= critical else "medium" if pct >= warning else "informational"
            self.emit(make_event("system", "disk_usage_snapshot", "shutil.disk_usage", severity=sev,
                                 path=mount, details={**current[key], "threshold_warning_percent": warning,
                                                      "threshold_critical_percent": critical}))
        self.previous = current


class RemovableScanCollector(Collector):
    """On newly mounted volumes, hash/inspect files and optionally invoke Microsoft Defender."""
    cname = "removable_scan"
    default_interval = 5
    known_gaps = ("Scans newly appearing mounted volumes only; volumes already present at startup are a baseline and are not "
                  "automatically scanned. Enumeration can miss files denied by ACLs, removed mid-scan, or beyond max_files. "
                  "Static indicators are not malware proof. Defender availability and results depend on local configuration.")

    def setup(self) -> None:
        if not IS_WINDOWS:
            raise CollectorUnavailable("removable-volume scanning currently requires Windows")
        self.previous = self._snapshot()
        self.set_details(baseline_volumes=sorted(self.previous), max_files=self.cfg["removable_scan"].get("max_files", 50000),
                         defender_scan_enabled=self.cfg["removable_scan"].get("scan_with_defender", True))

    def _snapshot(self) -> Dict[str, Dict[str, Any]]:
        import ctypes
        k32 = ctypes.windll.kernel32
        mask = k32.GetLogicalDrives()
        found = {}
        scan_fixed = bool(self.cfg["removable_scan"].get("scan_new_fixed_volumes", True))
        for i in range(26):
            if not (mask >> i) & 1:
                continue
            root = f"{chr(65+i)}:\\"
            dtype = k32.GetDriveTypeW(root)
            # DRIVE_REMOVABLE=2; DRIVE_FIXED=3. Fixed volumes are included because many USB disks report as fixed.
            if dtype != 2 and not (dtype == 3 and scan_fixed):
                continue
            label, fs, serial = ctypes.create_unicode_buffer(261), ctypes.create_unicode_buffer(261), ctypes.c_uint32(0)
            if not k32.GetVolumeInformationW(root, label, 261, ctypes.byref(serial), None, None, fs, 261):
                continue
            found[f"{root}|{serial.value:08X}"] = {"drive": root, "drive_type": "removable" if dtype == 2 else "fixed",
                "label": label.value, "filesystem": fs.value, "volume_serial": f"{serial.value:08X}"}
        return found

    def _defender_exe(self) -> Optional[str]:
        candidates = [Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Windows Defender" / "MpCmdRun.exe"]
        platform = Path(os.environ.get("ProgramData", r"C:\ProgramData")) / "Microsoft" / "Windows Defender" / "Platform"
        try:
            candidates.extend(sorted(platform.glob("*/MpCmdRun.exe"), reverse=True))
        except OSError:
            pass
        return str(next((p for p in candidates if p.is_file()), "")) or None

    def _scan_volume(self, info: Dict[str, Any]) -> None:
        root = info["drive"]
        cfg = self.cfg["removable_scan"]
        max_files = max(1, int(cfg.get("max_files", 50000)))
        checked = suspicious = errors = 0
        suspicious_files = []
        skipped = 0
        start = time.monotonic()
        for dirpath, dirs, files in os.walk(root, topdown=True, followlinks=False):
            dirs[:] = [d for d in dirs if not os.path.islink(os.path.join(dirpath, d))]
            for name in files:
                if checked + skipped >= max_files:
                    skipped += 1
                    continue
                path = os.path.join(dirpath, name)
                try:
                    st = os.stat(path, follow_symlinks=False)
                    if not stat_mod.S_ISREG(st.st_mode):
                        continue
                    checked += 1
                    ext = ntpath.splitext(name)[1].lower()
                    header = b""
                    if st.st_size > 0:
                        with open(path, "rb") as fh:
                            header = fh.read(4)
                    reasons = assess_file(path, header)
                    if ext in EXEC_EXT:
                        reasons.append(("executable_or_script_on_newly_mounted_volume", "low"))
                    sha = None
                    hash_error = None
                    # Hash all files within configured size limit; never modify or execute them.
                    if st.st_size <= int(cfg.get("hash_max_mb", 100)) * 1024 * 1024:
                        sha, hash_error = self.app.hasher.sha256(path, int(cfg.get("hash_max_mb", 100)))
                    if reasons:
                        suspicious += 1
                        record = {"path": path, "size_bytes": st.st_size, "extension": ext, "sha256": sha,
                                  "suspicious_reasons": [{"reason": r, "severity": sev} for r, sev in reasons]}
                        suspicious_files.append(record)
                        self.emit(make_event("security", "suspicious_file_indicator", "removable-device static inspection",
                            severity=max_severity(reasons), path=path, details={**record, "device": info,
                            "classification_source": "assess_file heuristic", "note": "indicator only; not proof of malware"}))
                except (OSError, PermissionError) as exc:
                    errors += 1
                    if errors <= 20:
                        self.emit(make_event("file", "removable_file_scan_error", "removable-device scanner", severity="low",
                            path=path, status="partial", details={"device": info, "error": str(exc)[:300]}))
                if checked >= max_files:
                    break
            if checked >= max_files:
                break
        defender_result = {"status": "not_run"}
        if cfg.get("scan_with_defender", True):
            exe = self._defender_exe()
            if not exe:
                defender_result = {"status": "unavailable", "reason": "MpCmdRun.exe not found"}
            else:
                try:
                    rc, stdout, stderr = run_cmd([exe, "-Scan", "-ScanType", "3", "-File", root],
                                                 timeout=float(cfg.get("defender_timeout_seconds", 900)))
                    defender_result = {"status": "completed" if rc == 0 else "error", "return_code": rc,
                                       "output": (stdout or stderr)[-2000:]}
                except subprocess.TimeoutExpired:
                    defender_result = {"status": "timeout", "timeout_seconds": cfg.get("defender_timeout_seconds", 900)}
                except Exception as exc:
                    defender_result = {"status": "error", "reason": str(exc)[:500]}
        limit_reached = checked >= max_files
        overall = "partial" if errors or limit_reached or defender_result.get("status") in ("unavailable", "error", "timeout") else "collected"
        self.emit(make_event("device", "removable_volume_scan_completed", "removable-device scanner", path=root,
            severity="high" if suspicious else "medium" if errors or limit_reached or defender_result.get("status") in ("error", "timeout") else "informational",
            status=overall, details={"device": info, "files_inspected": checked, "suspicious_files": suspicious,
                "file_errors": errors, "scan_file_limit": max_files, "scan_limit_reached": limit_reached,
                "files_not_inspected_due_to_limit": "not_counted_after_limit_to_bound_scan_time" if limit_reached else 0,
                "defender_scan": defender_result, "duration_seconds": round(time.monotonic()-start, 1),
                "sample_suspicious_files": suspicious_files[:50],
                "note": "Only a completed antivirus scan with a clean result can support a clean assessment; static heuristics alone cannot certify a device clean."}))

    def poll(self) -> None:
        cur = self._snapshot()
        for key in sorted(cur.keys() - self.previous.keys()):
            info = cur[key]
            self.emit(make_event("device", "removable_volume_detected", "Windows drive enumeration", path=info["drive"],
                severity="low", details={**info, "scan_started": True,
                "note": "New volume detected; read-only inspection and configured Defender scan will run."}))
            self._scan_volume(info)
        for key in sorted(self.previous.keys() - cur.keys()):
            self.emit(make_event("device", "removable_volume_removed", "Windows drive enumeration", path=self.previous[key]["drive"],
                details={**self.previous[key], "note": "Device removed; scan may have been incomplete if removed during scanning."}, status="partial"))
        self.previous = cur


class SecurityPostureCollector(Collector):
    """Read-only checks of Defender, firewall and recent installed update evidence."""
    cname = "security_posture"
    default_interval = 300
    known_gaps = ("Read-only point-in-time checks, not a complete vulnerability scanner. Get-HotFix does not cover every update type; "
                  "firewall/Defender data can be unavailable due to policy or permissions. No settings are changed.")

    def setup(self) -> None:
        if not IS_WINDOWS:
            raise CollectorUnavailable("security posture checks currently require Windows")
        self.last = {}

    def poll(self) -> None:
        script = r"""$out = [ordered]@{}; try { $m=Get-MpComputerStatus -ErrorAction Stop; $out.defender=@{available=$true; real_time_protection=$m.RealTimeProtectionEnabled; antivirus_enabled=$m.AntivirusEnabled; signatures_age_days=$m.AntivirusSignatureAge} } catch { $out.defender=@{available=$false; error=$_.Exception.Message} }; try { $out.firewall=@(Get-NetFirewallProfile -ErrorAction Stop | Select-Object Name,Enabled) } catch { $out.firewall_error=$_.Exception.Message }; try { $h=Get-HotFix -ErrorAction Stop | Sort-Object InstalledOn -Descending | Select-Object -First 1; if ($h) { $date=$null; if ($h.InstalledOn) { $date=$h.InstalledOn.ToString('yyyy-MM-dd') }; $out.latest_hotfix=@{id=$h.HotFixID; installed_on=$date} } } catch { $out.hotfix_error=$_.Exception.Message }; $out | ConvertTo-Json -Depth 5 -Compress"""
        try:
            data = run_powershell_json(script, timeout=45)
            snap = data[0] if data else {}
            findings = []
            defender = snap.get("defender") or {}
            if defender.get("available") is True:
                if defender.get("real_time_protection") is False:
                    findings.append(("defender_realtime_protection_disabled", "high"))
                if defender.get("antivirus_enabled") is False:
                    findings.append(("defender_antivirus_disabled", "high"))
                try:
                    age = int(defender.get("signatures_age_days"))
                    if age > 7:
                        findings.append(("defender_signatures_old", "medium"))
                except (TypeError, ValueError):
                    pass
            else:
                findings.append(("defender_status_unavailable", "low"))
            for profile in snap.get("firewall") or []:
                if profile.get("Enabled") is False:
                    findings.append((f"firewall_profile_disabled_{str(profile.get('Name','unknown')).lower()}", "high"))
            hotfix = snap.get("latest_hotfix") or {}
            if hotfix.get("installed_on"):
                try:
                    installed = dt.datetime.strptime(hotfix["installed_on"], "%Y-%m-%d").replace(tzinfo=dt.timezone.utc)
                    age = (dt.datetime.now(dt.timezone.utc) - installed).days
                    if age > int(self.cfg["security_posture"].get("old_update_days", 60)):
                        findings.append(("latest_reported_hotfix_is_old", "medium"))
                    snap["latest_hotfix"]["age_days"] = age
                except ValueError:
                    pass
            signature = json.dumps(snap, sort_keys=True, default=str)
            if signature != self.last.get("signature"):
                self.emit(make_event("security", "security_posture_snapshot", "Windows Defender / Firewall / Get-HotFix",
                    severity=max_severity(findings), status="collected" if defender.get("available") or snap.get("firewall") else "partial",
                    details={"checks": snap, "findings": [{"reason": r, "severity": sev} for r, sev in findings],
                             "classification_source": "read-only security configuration checks",
                             "note": "Not a full vulnerability scan; update age is only a rough indicator and not proof that patches are missing."}))
                self.last["signature"] = signature
        except Exception as exc:
            raise RuntimeError(f"security posture query failed: {exc}")


class _FileHandler(FileSystemEventHandler):
    def __init__(self, q: "queue.Queue", owner: "FileCollector"):
        self.q, self.owner = q, owner

    def _push(self, kind: str, src: Any, dest: Any = None, is_dir: bool = False) -> None:
        if is_dir:
            return
        try:
            self.q.put_nowait((time.monotonic(), kind, os.fsdecode(src), os.fsdecode(dest) if dest else None))
        except queue.Full:
            self.owner.dropped += 1

    def on_created(self, event): self._push("created", event.src_path, None, event.is_directory)
    def on_modified(self, event): self._push("modified", event.src_path, None, event.is_directory)
    def on_deleted(self, event): self._push("deleted", event.src_path, None, event.is_directory)
    def on_moved(self, event): self._push("moved", event.src_path, event.dest_path, event.is_directory)


class FileCollector(Collector):
    cname = "files"
    default_interval = 1
    known_gaps = ("Event-driven via the OS change-notification API (watchdog) for the configured folders only. If the OS "
                  "buffer overflows under heavy I/O, changes can be lost without notice. Who changed a file is not known. "
                  "Rapid repeated 'modified' events are merged within the debounce window.")

    def setup(self) -> None:
        if Observer is None:
            raise CollectorUnavailable("watchdog is not installed (pip install watchdog)")
        fcfg = self.cfg["files"]
        wanted = fcfg["watch_paths"] or default_watch_paths()
        self.raw: "queue.Queue" = queue.Queue(maxsize=20000)
        self.dropped = 0
        self.pending: "collections.OrderedDict[tuple, list]" = collections.OrderedDict()
        self.own_dir = norm_path(str(self.app.data_dir))
        self.observer = Observer()
        handler = _FileHandler(self.raw, self)
        watched, missing = [], []
        for p in wanted:
            if p and os.path.isdir(p):
                try:
                    self.observer.schedule(handler, p, recursive=True)
                    watched.append(p)
                except Exception as exc:
                    missing.append(f"{p} ({exc})")
            else:
                missing.append(p)
        if not watched:
            raise CollectorUnavailable("none of the configured watch paths exist or are accessible")
        self.observer.start()
        self.set_details(watched=watched, not_watched=missing)

    def teardown(self) -> None:
        obs = getattr(self, "observer", None)
        if obs is not None:
            try:
                obs.stop()
                obs.join(timeout=5)
            except Exception:
                pass

    def poll(self) -> None:
        if not self.observer.is_alive():
            raise CollectorUnavailable("filesystem observer stopped unexpectedly; restarting (events during the gap are lost)")
        debounce = float(self.cfg["files"]["debounce_seconds"])
        try:
            item = self.raw.get(timeout=0.5)
            self._ingest(item)
            for _ in range(5000):
                self._ingest(self.raw.get_nowait())
        except queue.Empty:
            pass
        if self.dropped:
            n, self.dropped = self.dropped, 0
            self.emit(make_event("file", "file_events_dropped", "filesystem watcher", severity="medium", status="partial",
                                 details={"dropped": n, "reason": "internal file-event queue full"}))
        now = time.monotonic()
        for key in [k for k, v in self.pending.items() if now - v[0] >= debounce]:
            _, dest = self.pending.pop(key)
            try:
                self._record(key[0], key[1], dest)
            except Exception:
                log.exception("[files] failed to record %s", key)

    def _ingest(self, item: tuple) -> None:
        ts, kind, src, dest = item
        norm = norm_path(src)
        if norm.startswith(self.own_dir) or any(fnmatch.fnmatch(norm, pat.lower()) for pat in self.cfg["files"]["ignore_patterns"]):
            return
        if kind == "modified" and ("created", src) in self.pending:
            self.pending[("created", src)][0] = ts          # fold into the pending 'created'
            return
        self.pending[(kind, src)] = [ts, dest]

    def _record(self, kind: str, path: str, dest: Optional[str]) -> None:
        target = dest or path
        ext = ntpath.splitext(norm_path(target))[1]
        st = None
        if kind != "deleted":
            try:
                st = os.stat(target)
            except OSError:
                st = None
        det: Dict[str, Any] = {"path_event": kind, "extension": ext, "is_executable_or_script": ext in EXEC_EXT}
        if kind == "moved":
            det["previous_path"] = path
        if st is not None:
            det["size_bytes"] = st.st_size
            det["modified_utc"] = dt.datetime.fromtimestamp(st.st_mtime, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        status = "partial" if (kind != "deleted" and st is None) else "collected"
        header = b""
        if st is not None and ext in DOC_EXT and st.st_size > 1:
            try:
                with open(target, "rb") as fh:
                    header = fh.read(4)
            except OSError:
                pass
        if st is not None and ext in EXEC_EXT and kind != "deleted":
            sha, why = self.app.hasher.sha256(target, self.cfg["files"]["hash_max_mb"])
            if sha:
                det["sha256"] = sha
            else:
                det["sha256_unavailable"], status = why, "partial"
        reasons = assess_file(target, header) if kind != "deleted" else []
        if kind == "deleted" and classify_location(path) == "startup_folder" and ext in EXEC_EXT:
            reasons = [("startup_folder_entry_removed", "low")]
        sev = max_severity(reasons)
        if reasons:
            det["suspicious_reasons"] = [{"reason": r, "severity": s} for r, s in reasons]
            det["classification_source"] = "assess_file (static filename/location/header indicators)"
        etype = {"created": "file_created", "modified": "file_modified", "deleted": "file_deleted",
                 "moved": "file_renamed" if (dest and os.path.dirname(path) == os.path.dirname(dest)) else "file_moved"}[kind]
        self.emit(make_event("file", etype, "filesystem watcher (watchdog)", severity=sev, path=target, details=det,
                             status=status))
        if reasons:
            self.emit(make_event("security", "suspicious_file_indicator", "heuristic: file collector", severity=sev,
                                 path=target, details={"reasons": [{"reason": r, "severity": s} for r, s in reasons],
                                                       "file_event": etype, "sha256": det.get("sha256"),
                                                       "note": "indicator of suspicion, not proof of malware; no action taken",
                                                       "classification_source": "assess_file"}))


def diff_interfaces(old: Dict[str, Dict[str, Any]], new: Dict[str, Dict[str, Any]]) -> List[Tuple[str, str, Dict[str, Any]]]:
    out: List[Tuple[str, str, Dict[str, Any]]] = []
    for ifn in new.keys() - old.keys():
        out.append(("interface_added", ifn, {"up": new[ifn]["up"]}))
    for ifn in old.keys() - new.keys():
        out.append(("interface_removed", ifn, {}))
    for ifn in new.keys() & old.keys():
        o, n = old[ifn], new[ifn]
        if o["up"] != n["up"] and n["up"] is not None:
            out.append(("interface_connected" if n["up"] else "interface_disconnected", ifn, {}))
    for ifn in new.keys():
        before = old.get(ifn, {"ips": set()})["ips"]
        for ip in sorted(new[ifn]["ips"] - before):
            out.append(("ip_address_added", ifn, {"ip": ip}))
        for ip in sorted(before - new[ifn]["ips"]):
            out.append(("ip_address_removed", ifn, {"ip": ip}))
    return out


class InterfaceCollector(Collector):
    cname = "interfaces"
    default_interval = 10
    known_gaps = "Polling: address/interface changes shorter than the poll interval are missed. Initial state is a baseline, not an event."

    def setup(self) -> None:
        if psutil is None:
            raise CollectorUnavailable("psutil is not installed (pip install psutil)")
        self.prev = self._snapshot()
        self.set_details(baseline_interfaces=sorted(self.prev))

    def _snapshot(self) -> Dict[str, Dict[str, Any]]:
        stats, snap = psutil.net_if_stats(), {}
        for ifn, addrs in psutil.net_if_addrs().items():
            ips = {a.address.split("%")[0] for a in addrs if a.family in (socket.AF_INET, socket.AF_INET6)}
            snap[ifn] = {"up": stats[ifn].isup if ifn in stats else None, "ips": ips}
        return snap

    def poll(self) -> None:
        cur = self._snapshot()
        for etype, ifn, det in diff_interfaces(self.prev, cur):
            ip = det.get("ip")
            if ip:
                det["ip_version"] = ipaddress.ip_address(ip).version
            self.emit(make_event("network", etype, "psutil network interface polling", src_ip=ip,
                                 details={"interface": ifn, **det}))
        self.prev = cur


GATEWAY_DNS_PS = (
    "Get-NetIPConfiguration | ForEach-Object { [pscustomobject]@{ Interface=$_.InterfaceAlias; "
    "Gateway4=@($_.IPv4DefaultGateway | ForEach-Object { $_.NextHop }); "
    "Gateway6=@($_.IPv6DefaultGateway | ForEach-Object { $_.NextHop }); "
    "Dns=@($_.DNSServer | ForEach-Object { $_.ServerAddresses }) } } | ConvertTo-Json -Depth 4 -Compress")


def diff_gateway_dns(old: Dict[str, Dict[str, List[str]]], new: Dict[str, Dict[str, List[str]]]) -> List[Tuple[str, str, Dict[str, Any], str]]:
    out = []
    for ifn in new:
        o = old.get(ifn)
        if o is None:
            continue
        gw_old, gw_new = sorted(o["gateways"]), sorted(new[ifn]["gateways"])
        if gw_old != gw_new:
            out.append(("gateway_changed", ifn, {"old": gw_old, "new": gw_new}, "low"))
        d_old, d_new = sorted(o["dns"]), sorted(new[ifn]["dns"])
        if d_old != d_new:
            out.append(("dns_servers_changed", ifn, {"old": d_old, "new": d_new}, "medium"))
    return out


class GatewayDnsCollector(Collector):
    cname = "gateway_dns"
    default_interval = 60
    known_gaps = ("Polling via PowerShell (Get-NetIPConfiguration) every interval; changes that revert within the interval "
                  "are missed. Changes made while the monitor was off are detected at next start.")

    def setup(self) -> None:
        if not IS_WINDOWS:
            raise CollectorUnavailable("uses Windows PowerShell (Get-NetIPConfiguration); Windows only")
        stored = self.get_bookmark("gateway_dns_state")
        self.prev = json.loads(stored) if stored else None
        cur = self._snapshot()
        if self.prev:
            self._report(cur, at_startup=True)
        self.prev = cur
        self.set_bookmark("gateway_dns_state", json.dumps(cur))

    def _snapshot(self) -> Dict[str, Dict[str, List[str]]]:
        snap = {}
        for row in run_powershell_json(GATEWAY_DNS_PS):
            snap[str(row.get("Interface"))] = {"gateways": as_list(row.get("Gateway4")) + as_list(row.get("Gateway6")),
                                               "dns": as_list(row.get("Dns"))}
        return snap

    def _report(self, cur: Dict[str, Dict[str, List[str]]], at_startup: bool = False) -> None:
        for etype, ifn, det, sev in diff_gateway_dns(self.prev or {}, cur):
            self.emit(make_event("network", etype, "PowerShell Get-NetIPConfiguration polling", severity=sev,
                                 details={"interface": ifn, **det, "detected_at_monitor_start": at_startup}))

    def poll(self) -> None:
        cur = self._snapshot()
        self._report(cur)
        if cur != self.prev:
            self.set_bookmark("gateway_dns_state", json.dumps(cur))
        self.prev = cur


class ConnectionCollector(Collector):
    cname = "connections"
    default_interval = 5
    known_gaps = ("Polling a snapshot of TCP connections: connections that open and close between polls are MISSED, and "
                  "only the connection metadata (addresses, ports, owning process) is recorded - never content. Other "
                  "users' processes may need Administrator to resolve. For full coverage use Sysmon EventID 3.")

    def setup(self) -> None:
        if psutil is None:
            raise CollectorUnavailable("psutil is not installed (pip install psutil)")
        self.known = self._snapshot()
        self.names: Dict[int, str] = {}
        self.set_details(baseline_connection_count=len(self.known), baseline_not_recorded_as_events=True)

    def _snapshot(self) -> Dict[tuple, Dict[str, Any]]:
        snap = {}
        try:
            conns = psutil.net_connections(kind="tcp")
        except psutil.AccessDenied:
            raise CollectorUnavailable("access denied listing connections; run as Administrator")
        for c in conns:
            if c.status not in (psutil.CONN_ESTABLISHED, psutil.CONN_LISTEN) or not c.laddr:
                continue
            r = c.raddr
            snap[(c.laddr.ip, c.laddr.port, r.ip if r else "", r.port if r else 0, c.pid or 0)] = {
                "status": c.status, "family": "ipv6" if c.family == socket.AF_INET6 else "ipv4"}
        return snap

    def _proc_name(self, pid: int) -> Optional[str]:
        if not pid:
            return None
        if pid not in self.names:
            try:
                self.names[pid] = psutil.Process(pid).name()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                self.names[pid] = ""
            if len(self.names) > 5000:
                self.names.clear()
        return self.names[pid] or None

    def poll(self) -> None:
        cur = self._snapshot()
        cap = int(self.cfg["connections"]["max_new_per_poll"])
        new = sorted(cur.keys() - self.known.keys())
        for key in new[:cap]:
            lip, lport, rip, rport, pid = key
            info = cur[key]
            if info["status"] == psutil.CONN_LISTEN:
                if not self.cfg["connections"]["record_listening"]:
                    continue
                self.emit(make_event("network", "listening_port_opened", "psutil connection polling", src_ip=lip, pid=pid or None,
                                     details={"local_port": lport, "process_name": self._proc_name(pid), "ip_family": info["family"],
                                              "observed_via": "polling"}))
                continue
            try:
                ip = ipaddress.ip_address(rip)
                if ip.is_loopback:
                    continue
                private = ip.is_private
            except ValueError:
                private = None
            self.emit(make_event("network", "tcp_connection_established", "psutil connection polling", src_ip=lip,
                                 dst_ip=rip, pid=pid or None, details={
                                     "local_port": lport, "remote_port": rport, "remote_is_private": private,
                                     "process_name": self._proc_name(pid), "ip_family": info["family"], "observed_via": "polling",
                                     "note": "connection metadata only; no content captured"}))
        if len(new) > cap:
            self.emit(make_event("network", "connection_burst_truncated", "psutil connection polling", severity="low",
                                 status="partial", details={"new_connections": len(new), "recorded": cap}))
        self.known = cur


def diff_volumes(old: Dict[str, Dict[str, Any]], new: Dict[str, Dict[str, Any]]) -> List[Tuple[str, str, Dict[str, Any]]]:
    out = []
    for k in sorted(new.keys() - old.keys()):
        out.append(("volume_mounted", k, new[k]))
    for k in sorted(old.keys() - new.keys()):
        out.append(("volume_unmounted", k, old[k]))
    return out


class VolumeCollector(Collector):
    cname = "volumes"
    default_interval = 3
    known_gaps = ("Polling drive letters every few seconds (Windows API). Volumes that appear and disappear between polls are "
                  "missed. USB external hard disks are reported by Windows as 'fixed' drives, so every newly appearing "
                  "fixed volume is recorded. An optical drive without a disc produces no event. Volume serial numbers are "
                  "filesystem serials, not hardware serials (see usb_pnp for USB identifiers).")
    TYPES = {2: "removable", 3: "fixed", 5: "optical"}

    def setup(self) -> None:
        if not IS_WINDOWS:
            raise CollectorUnavailable("drive enumeration uses Windows APIs; Windows only")
        import ctypes
        self.k32 = ctypes.windll.kernel32
        self.k32.SetErrorMode(0x0001)       # SEM_FAILCRITICALERRORS: no 'insert disk' dialogs for empty drives
        self.prev = self._snapshot()
        self.set_details(baseline_volumes=sorted(self.prev))

    def _snapshot(self) -> Dict[str, Dict[str, Any]]:
        import ctypes
        snap: Dict[str, Dict[str, Any]] = {}
        mask = self.k32.GetLogicalDrives()
        for i in range(26):
            if not mask >> i & 1:
                continue
            root = f"{chr(65 + i)}:\\"
            dtype = self.k32.GetDriveTypeW(root)
            if dtype not in self.TYPES:
                continue
            label, fs, serial = ctypes.create_unicode_buffer(261), ctypes.create_unicode_buffer(261), ctypes.c_uint32(0)
            if not self.k32.GetVolumeInformationW(root, label, 261, ctypes.byref(serial), None, None, fs, 261):
                continue        # no media (e.g. empty optical drive)
            info = {"drive": root, "drive_type": self.TYPES[dtype], "label": label.value,
                    "filesystem": fs.value, "volume_serial": f"{serial.value:08X}"}
            try:
                import shutil
                info["total_bytes"] = shutil.disk_usage(root).total
            except OSError:
                pass
            snap[f"{root}|{serial.value:08X}"] = info
        return snap

    def poll(self) -> None:
        cur = self._snapshot()
        for etype, key, info in diff_volumes(self.prev, cur):
            self.emit(make_event("device", etype, "Windows drive enumeration (GetLogicalDrives)", path=info["drive"],
                                 details={**info, "possibly_external": info["drive_type"] != "fixed" or "new fixed volume"}))
        self.prev = cur


USB_PS = ("Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -like 'USB\\*' } | "
          "Select-Object InstanceId,FriendlyName,Class,Manufacturer | ConvertTo-Json -Compress")


class UsbPnpCollector(Collector):
    cname = "usb_pnp"
    default_interval = 15
    known_gaps = ("Polling via PowerShell Get-PnpDevice: devices connected and removed within one interval are missed. "
                  "Identifiers (VID/PID/serial) are what Windows exposes in the device instance ID.")

    def setup(self) -> None:
        if not IS_WINDOWS:
            raise CollectorUnavailable("uses Windows PowerShell Get-PnpDevice; Windows only")
        self.prev = self._snapshot()
        self.set_details(baseline_usb_devices=len(self.prev))

    def _snapshot(self) -> Dict[str, Dict[str, Any]]:
        return {str(r.get("InstanceId")): r for r in run_powershell_json(USB_PS) if r.get("InstanceId")}

    def poll(self) -> None:
        cur = self._snapshot()
        for key in sorted(cur.keys() - self.prev.keys()):
            r = cur[key]
            hid = (r.get("Class") or "") in ("HIDClass", "Keyboard")
            det = {"instance_id": key, "name": r.get("FriendlyName"), "class": r.get("Class"), "manufacturer": r.get("Manufacturer")}
            if hid:
                det["note"] = "new input device (HID); keyboards can be emulated by malicious hardware"
            self.emit(make_event("device", "usb_device_connected", "Windows PnP (Get-PnpDevice)", severity="low" if hid else "informational", details=det))
        for key in sorted(self.prev.keys() - cur.keys()):
            r = self.prev[key]
            self.emit(make_event("device", "usb_device_disconnected", "Windows PnP (Get-PnpDevice)",
                                 details={"instance_id": key, "name": r.get("FriendlyName"), "class": r.get("Class")}))
        self.prev = cur


STARTUP_KEYS = [
    ("HKCU", r"Software\Microsoft\Windows\CurrentVersion\Run", None),
    ("HKCU", r"Software\Microsoft\Windows\CurrentVersion\RunOnce", None),
    ("HKCU", r"Software\Microsoft\Windows\CurrentVersion\Policies\Explorer\Run", None),
    ("HKLM", r"Software\Microsoft\Windows\CurrentVersion\Run", None),
    ("HKLM", r"Software\Microsoft\Windows\CurrentVersion\RunOnce", None),
    ("HKLM", r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run", None),
    ("HKLM", r"Software\Microsoft\Windows NT\CurrentVersion\Winlogon", {"Shell", "Userinit", "Taskman"}),
    ("HKLM", r"Software\Microsoft\Windows NT\CurrentVersion\Windows", {"AppInit_DLLs", "LoadAppInit_DLLs"}),
]


def diff_dicts(old: Dict[str, str], new: Dict[str, str]) -> Tuple[Dict[str, str], Dict[str, str], Dict[str, Tuple[str, str]]]:
    added = {k: new[k] for k in new.keys() - old.keys()}
    removed = {k: old[k] for k in old.keys() - new.keys()}
    changed = {k: (old[k], new[k]) for k in old.keys() & new.keys() if old[k] != new[k]}
    return added, removed, changed


class StartupCollector(Collector):
    cname = "startup"
    default_interval = 30
    known_gaps = ("Polls well-known autorun registry values only (Run/RunOnce, Winlogon Shell/Userinit, AppInit_DLLs). "
                  "Scheduled tasks, services, WMI subscriptions and other persistence are not covered here (new services "
                  "come from the System log, tasks from Security 4698 if audited; Startup-folder files from the file collector).")

    def setup(self) -> None:
        if winreg is None:
            raise CollectorUnavailable("winreg is only available on Windows")
        stored = self.get_bookmark("startup_state")
        cur = self._snapshot()
        if stored:
            self._report(json.loads(stored), cur, at_startup=True)
        self.prev = cur
        self.set_bookmark("startup_state", json.dumps(cur))

    def _snapshot(self) -> Dict[str, str]:
        snap: Dict[str, str] = {}
        for hive_name, sub, only in STARTUP_KEYS:
            hive = winreg.HKEY_CURRENT_USER if hive_name == "HKCU" else winreg.HKEY_LOCAL_MACHINE
            try:
                with winreg.OpenKey(hive, sub, 0, winreg.KEY_READ) as key:
                    i = 0
                    while True:
                        try:
                            name, value, _ = winreg.EnumValue(key, i)
                        except OSError:
                            break
                        i += 1
                        if only is None or name in only:
                            snap[f"{hive_name}\\{sub}::{name}"] = str(value)[:500]
            except OSError:
                continue
        return snap

    def _report(self, old: Dict[str, str], new: Dict[str, str], at_startup: bool = False) -> None:
        added, removed, changed = diff_dicts(old, new)
        flag = {"detected_at_monitor_start": at_startup}
        for k, v in added.items():
            reasons = assess_command(v)
            sev = max(["medium", max_severity(reasons)], key=lambda s: SEV_RANK[s])
            self.emit(make_event("security", "startup_entry_added", "registry autorun polling (winreg)", severity=sev,
                                 details={"entry": k, "command": v, **flag, "suspicious_reasons":
                                          [{"reason": r, "severity": s} for r, s in reasons],
                                          "classification_source": "new autorun entry + assess_command"}))
        for k, (a, b) in changed.items():
            reasons = assess_command(b)
            sev = max(["medium", max_severity(reasons)], key=lambda s: SEV_RANK[s])
            self.emit(make_event("security", "startup_entry_changed", "registry autorun polling (winreg)", severity=sev,
                                 details={"entry": k, "old": a, "new": b, **flag}))
        for k, v in removed.items():
            self.emit(make_event("security", "startup_entry_removed", "registry autorun polling (winreg)", severity="low",
                                 details={"entry": k, "command": v, **flag}))

    def poll(self) -> None:
        cur = self._snapshot()
        if cur != self.prev:
            self._report(self.prev, cur)
            self.set_bookmark("startup_state", json.dumps(cur))
        self.prev = cur


class PublicIpCollector(Collector):
    cname = "public_ip"
    default_interval = 3600
    known_gaps = ("Opt-in. Contacts the configured external service, which learns your public IP by design. "
                  "Only changes (and the first observation) are recorded.")

    def setup(self) -> None:
        self.last = self.get_bookmark("public_ip")

    def poll(self) -> None:
        url = self.cfg["public_ip"]["url"]
        req = urllib.request.Request(url, headers={"User-Agent": f"system_monitor/{VERSION}"})
        with urllib.request.urlopen(req, timeout=float(self.cfg["public_ip"]["timeout_seconds"])) as resp:
            text = resp.read(100).decode("ascii", "replace").strip()
        ip = str(ipaddress.ip_address(text))          # raises on anything that is not an IP
        if ip != self.last:
            host = url.split("/")[2] if "//" in url else url
            self.emit(make_event("network", "public_ip_changed" if self.last else "public_ip_observed",
                                 f"external service {host}", src_ip=ip, details={"previous": self.last, "current": ip}))
            self.set_bookmark("public_ip", ip)
            self.last = ip


COLLECTOR_CLASSES = [SecurityLogCollector, SystemLogCollector, DefenderLogCollector, SysmonCollector,
                     DnsClientLogCollector, ProcessCollector, ProcessResourceCollector, FileCollector, InterfaceCollector, GatewayDnsCollector,
                     ConnectionCollector, VolumeCollector, UsbPnpCollector, DiskUsageCollector, RemovableScanCollector,
                     SecurityPostureCollector, StartupCollector, PublicIpCollector]


# --------------------------------------------------------------------------------------
# Application
# --------------------------------------------------------------------------------------
class App:
    def __init__(self, cfg: Dict[str, Any], data_dir: Path, db_path: Path):
        self.cfg, self.data_dir, self.db_path = cfg, data_dir, db_path
        self.stop = threading.Event()
        fl = cfg["failed_logins"]
        self.sink = Sink(int(cfg["queue_size"]), [FailedLoginDetector(fl["threshold"], fl["window_minutes"])])
        self.hasher = HashService(cfg["processes"]["hash_max_mb"])
        self.writer = DatabaseWriter(db_path, self.sink, cfg)
        self.collectors: List[Collector] = []
        self._blocklist: set = set()
        self._blocklist_mtime = None

    def read_bookmark(self, key: str) -> Optional[str]:
        try:
            conn = sqlite3.connect(str(self.db_path), timeout=10)
            try:
                row = conn.execute("SELECT value FROM bookmarks WHERE key=?", (key,)).fetchone()
            finally:
                conn.close()
            return row[0] if row else None
        except sqlite3.Error:
            return None

    def blocklist(self) -> set:
        path = self.cfg["dns"]["blocklist_file"]
        if not path:
            return set()
        try:
            mtime = os.stat(path).st_mtime
        except OSError:
            return self._blocklist
        if mtime != self._blocklist_mtime:
            self._blocklist, self._blocklist_mtime = load_blocklist(path), mtime
        return self._blocklist

    def dns_event(self, domain: Optional[str], source: str, ts: str, *, path: Optional[str] = None,
                  pid: Optional[int] = None, user: Optional[str] = None, extra: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        if not domain:
            return None
        reasons = assess_domain(domain, self.blocklist(), self.cfg["dns"]["flag_generated_looking_names"])
        det = {**(extra or {}), "record_kind": "dns_lookup", "confirmed_connection": False,
               "note": "a DNS lookup does not prove a connection to the site was made",
               "reputation": {"source": "local blocklist / name heuristics only (no external reputation service)",
                              "blocklist_entries": len(self._blocklist),
                              "flags": [{"reason": r, "severity": s} for r, s in reasons]}}
        return make_event("dns", "dns_query", source, timestamp=ts, severity=max_severity(reasons), username=user,
                          pid=pid, path=path, domain=domain.lower().rstrip("."), details=det)

    def startup_events(self) -> None:
        prev_hb = self.read_bookmark("last_heartbeat")
        clean_flag = self.read_bookmark("clean_shutdown")
        if prev_hb:
            gap = max(0.0, time.time() - iso_to_epoch(prev_hb))
            self.sink.emit(make_event("system", "monitoring_gap", "system_monitor", collector="monitor",
                                      severity="medium" if clean_flag == "0" else "low", status="partial", details={
                                          "gap_start_utc": prev_hb, "gap_end_utc": utc_now(), "gap_seconds": round(gap),
                                          "previous_run_ended_cleanly": clean_flag == "1",
                                          "note": "events during this period were NOT recorded by this monitor"}))
        self.sink.bookmark("clean_shutdown", "0")
        try:
            import getpass
            user = getpass.getuser()
        except Exception:
            user = None
        self.sink.emit(make_event("system", "monitor_started", "system_monitor", collector="monitor", username=user,
                                  pid=os.getpid(), details={
                                      "version": VERSION, "python": sys.version.split()[0], "is_admin": is_admin(),
                                      "collectors_enabled": [c.cname for c in self.collectors],
                                      "note": "collector availability is recorded in the collector_status table"}))

    def run(self, duration: Optional[float] = None) -> int:
        def _handler(signum, _frame):
            log.info("signal %s received, shutting down", signum)
            self.stop.set()
        for name in ("SIGINT", "SIGTERM", "SIGBREAK"):
            if hasattr(signal, name):
                try:
                    signal.signal(getattr(signal, name), _handler)
                except (ValueError, OSError):
                    pass
        enabled = self.cfg["collectors"]
        self.collectors = [cls(self) for cls in COLLECTOR_CLASSES if enabled.get(cls.cname, False)]
        self.writer.start()
        for internal in ("monitor", "analyzer"):
            self.sink.status(internal, status="running", started_at=utc_now(),
                             known_gaps="internal component (source of monitor_* and analyzer events)")
        self.startup_events()
        for c in self.collectors:
            c.start()
        log.info("monitoring started: %d collectors, database %s (Ctrl+C to stop)", len(self.collectors), self.db_path)
        started = time.monotonic()
        next_hb = next_purge = 0.0
        hb = float(self.cfg["heartbeat_seconds"])
        purge_every = float(self.cfg["purge_interval_minutes"]) * 60
        try:
            while not self.stop.is_set():
                now = time.monotonic()
                if now >= next_hb:
                    self.sink.bookmark("last_heartbeat", utc_now())
                    next_hb = now + hb
                if now >= next_purge:
                    self.writer.purge_requested.set()
                    next_purge = now + purge_every
                if duration is not None and now - started >= duration:
                    break
                self.stop.wait(1.0)
        except KeyboardInterrupt:
            pass
        finally:
            self.shutdown()
        return 0

    def shutdown(self) -> None:
        self.stop.set()
        for c in self.collectors:
            c.join()
        self.sink.emit(make_event("system", "monitor_stopped", "system_monitor", collector="monitor", pid=os.getpid(),
                                  details={"clean": True}))
        self.sink.bookmark("last_heartbeat", utc_now())
        self.sink.bookmark("clean_shutdown", "1")
        for internal in ("monitor", "analyzer", "writer"):
            self.sink.status(internal, status="stopped")
        self.sink.close()
        self.writer.join(timeout=60)
        if self.writer.is_alive():
            log.error("database writer did not finish within 60s; some events may be unsaved")
        else:
            log.info("stopped cleanly; %d events written this run", self.writer.rows_written)


# --------------------------------------------------------------------------------------
# CLI helpers: --check, --status, --print-service-command
# --------------------------------------------------------------------------------------
def run_check(cfg: Dict[str, Any], data_dir: Path) -> int:
    def line(ok: Optional[bool], what: str, hint: str = "") -> None:
        mark = {True: "[ OK ]", False: "[MISSING]", None: "[ INFO ]"}[ok]
        print(f"{mark} {what}" + (f"\n         -> {hint}" if hint and ok is not True else ""))

    print(f"system_monitor {VERSION} prerequisite check\n")
    line(IS_WINDOWS, f"Windows ({sys.platform})", "Most collectors need Windows 10/11; the script still runs elsewhere with few collectors")
    line(sys.version_info >= (3, 9), f"Python {sys.version.split()[0]}", "Python 3.9+ required")
    line(is_admin() or None, "Administrator rights" if is_admin() else "Not running as Administrator",
         "Needed for the Security log (or add the account to 'Event Log Readers'), some connection owners and auditing setup")
    line(psutil is not None, "psutil", "pip install psutil   (process, interface and connection collectors)")
    line(Observer is not None, "watchdog", "pip install watchdog   (file activity collector)")
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
        probe = data_dir / ".write_test"
        probe.write_text("x")
        probe.unlink()
        line(True, f"Data directory writable: {data_dir}")
    except OSError as exc:
        line(False, f"Data directory not writable: {data_dir}", str(exc))
    if IS_WINDOWS:
        try:
            run_cmd(["wevtutil", "el"], timeout=30)
            line(True, "wevtutil (Windows Event Log CLI)")
        except Exception:
            line(False, "wevtutil", "Part of Windows; check PATH")
        for cls in (SecurityLogCollector, SystemLogCollector, DefenderLogCollector, SysmonCollector, DnsClientLogCollector):
            rc, out, err = run_cmd(["wevtutil", "gl", cls.log_name], timeout=30)
            if rc != 0:
                hint = {"sysmon": "Install Sysmon (Microsoft Sysinternals) with a config to get process/network/DNS telemetry",
                        "dns_client_log": "wevtutil sl Microsoft-Windows-DNS-Client/Operational /e:true  (run as Administrator)"}.get(cls.cname, (err or out).strip()[:150])
                line(False, f"Event log '{cls.log_name}' readable", hint)
            elif cls.needs_enabled_log and re.search(r"enabled:\s*false", out, re.I):
                line(False, f"Event log '{cls.log_name}' is present but DISABLED",
                     "wevtutil sl Microsoft-Windows-DNS-Client/Operational /e:true  (run as Administrator)")
            else:
                line(True, f"Event log '{cls.log_name}' readable")
        try:
            rc, _, _ = run_cmd(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.Major"], timeout=30)
            line(rc == 0, "Windows PowerShell (gateway/DNS, USB and security-posture collectors)", "powershell.exe must be available")
        except Exception:
            line(False, "Windows PowerShell", "powershell.exe must be available")
    print("\nFolders watched for file activity (edit files.watch_paths in config.json to change):")
    for p in (cfg["files"]["watch_paths"] or default_watch_paths()):
        line(os.path.isdir(p), p, "folder does not exist, so it will be skipped")
    print("\nAudit-policy note (the script never changes policy). Process events (4688/4689) and scheduled-task events need "
          "auditing enabled by you, e.g. as Administrator:\n"
          "  auditpol /set /subcategory:\"Process Creation\" /success:enable\n"
          "  auditpol /set /subcategory:\"Process Termination\" /success:enable\n"
          "  auditpol /set /subcategory:\"Other Object Access Events\" /success:enable\n"
          "(English Windows subcategory names; other languages use the localized name or GUID.)")
    return 0


def print_status(db_path: Path) -> int:
    if not db_path.exists():
        print("No database yet. Run the monitor first.")
        return 1
    conn = sqlite3.connect(str(db_path), timeout=10)
    conn.row_factory = sqlite3.Row
    print(f"{'collector':<20}{'status':<13}{'events':>9}  {'last_success (UTC)':<26}errors  detail")
    for r in conn.execute("SELECT * FROM collector_status ORDER BY collector"):
        print(f"{r['collector']:<20}{r['status']:<13}{r['events_recorded']:>9}  {(r['last_success'] or '-'):<26}{r['error_count']:<7} "
              f"{(r['status_detail'] or r['last_error'] or '')[:90]}")
        if r["known_gaps"]:
            print(f"{'':<20}known gaps: {r['known_gaps'][:200]}")
    n = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    print(f"\n{n} events stored. Treat coverage as incomplete wherever a collector is not 'running' or has known gaps.")
    conn.close()
    return 0


def service_command(data_dir: Path) -> str:
    py = sys.executable
    pyw = py[:-10] + "pythonw.exe" if py.lower().endswith("python.exe") else py
    script = Path(__file__).resolve()
    tr = f'\\"{pyw}\\" \\"{script}\\" --data-dir \\"{data_dir}\\"'
    return (f'schtasks /Create /TN "SystemMonitor" /SC ONSTART /RU SYSTEM /RL HIGHEST /F /TR "{tr}"')


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Local defensive system-activity recorder (observation only).")
    ap.add_argument("--data-dir", help="directory for system_monitor.db, config.json and logs")
    ap.add_argument("--check", action="store_true", help="check prerequisites and exit")
    ap.add_argument("--status", action="store_true", help="show collector health from the database and exit")
    ap.add_argument("--print-service-command", action="store_true", help="print a Task Scheduler command to run at boot (not executed)")
    ap.add_argument("--duration", type=float, help="stop automatically after N seconds (testing)")
    ap.add_argument("--version", action="version", version=f"system_monitor {VERSION}")
    args = ap.parse_args(argv)

    data_dir = Path(args.data_dir or os.environ.get("SYSTEM_MONITOR_HOME") or default_data_dir())
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        print(f"Cannot create data directory {data_dir}: {exc}", file=sys.stderr)
        return 2
    try:
        cfg = load_config(data_dir / "config.json")
    except (OSError, ValueError) as exc:
        print(f"Cannot load {data_dir / 'config.json'}: {exc}", file=sys.stderr)
        return 2
    db_path = data_dir / "system_monitor.db"

    if args.check:
        return run_check(cfg, data_dir)
    if args.status:
        return print_status(db_path)
    if args.print_service_command:
        pd = Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData")) / "SystemMonitor"
        print("Run in an elevated prompt (optional; runs the monitor as SYSTEM at boot):\n")
        print(service_command(pd))
        print("\nRemove with:  schtasks /Delete /TN \"SystemMonitor\" /F")
        print(f"As SYSTEM the 'current user' folders differ: set files.watch_paths explicitly in {pd / 'config.json'}, and make sure "
              "psutil/watchdog are installed for that Python.")
        return 0

    handlers: List[logging.Handler] = [logging.StreamHandler(sys.stderr)]
    try:
        handlers.append(logging.handlers.RotatingFileHandler(data_dir / "system_monitor.log", maxBytes=1_000_000,
                                                             backupCount=3, encoding="utf-8"))
    except OSError:
        pass
    logging.basicConfig(level=getattr(logging, str(cfg["log_level"]).upper(), logging.INFO), handlers=handlers,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    lock = SingleInstance(data_dir / "monitor.lock")
    if not lock.acquire():
        print("Another system_monitor instance is already running for this data directory.", file=sys.stderr)
        return 3
    harden_data_dir(data_dir)
    try:
        init_db(db_path)
    except sqlite3.Error as exc:
        print(f"Cannot initialise database {db_path}: {exc}", file=sys.stderr)
        return 2
    return App(cfg, data_dir, db_path).run(duration=args.duration)


if __name__ == "__main__":
    sys.exit(main())