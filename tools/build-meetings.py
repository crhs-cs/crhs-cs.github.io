#!/usr/bin/env python3
"""Writes data/meetings.json: the next few meetings from the club's public Google Calendar.

GitHub runs this every hour (.github/workflows/meetings.yml), so the "Next meeting" block on the
home page follows the calendar with no edits here. Repeating events are expanded.

Usage: build-meetings.py [path-or-url-of-.ics]   (defaults to the club calendar's public feed)
Needs: pip install icalendar recurring_ical_events
"""
import json
import sys
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import icalendar
import recurring_ical_events

CALENDAR_ID = "45e09ecb4565e6b8d15f0fd7f4853db8ec7c4d597bde3d7fb8aff8420847a40d@group.calendar.google.com"
FEED = f"https://calendar.google.com/calendar/ical/{CALENDAR_ID.replace('@', '%40')}/public/basic.ics"
TZ = ZoneInfo("America/Chicago")
OUT = Path(__file__).resolve().parent.parent / "data" / "meetings.json"
HOW_MANY, DAYS_AHEAD = 4, 120


def read_feed(src):
    if src.startswith("http"):
        with urllib.request.urlopen(src, timeout=30) as r:
            return r.read()
    return Path(src).read_bytes()


def as_local(value):
    """Calendar times come as dates (all-day events) or datetimes in any zone."""
    if isinstance(value, datetime):
        return (value if value.tzinfo else value.replace(tzinfo=TZ)).astimezone(TZ), False
    return datetime(value.year, value.month, value.day, tzinfo=TZ), True


def main():
    cal = icalendar.Calendar.from_ical(read_feed(sys.argv[1] if len(sys.argv) > 1 else FEED))
    now = datetime.now(TZ)
    # Start from the beginning of today, so a meeting stays "next" until it ends.
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    events = []
    for ev in recurring_ical_events.of(cal).between(start, start + timedelta(days=DAYS_AHEAD)):
        if str(ev.get("STATUS", "")).upper() == "CANCELLED":
            continue
        begins, all_day = as_local(ev.decoded("DTSTART"))
        ends = as_local(ev.decoded("DTEND"))[0] if ev.get("DTEND") else begins + timedelta(hours=1)
        if ends <= now:
            continue
        events.append({
            "title": str(ev.get("SUMMARY", "")).strip() or "Club meeting",
            "start": begins.isoformat(),
            "end": ends.isoformat(),
            "allDay": all_day,
            "location": str(ev.get("LOCATION", "")).strip(),
        })
    events.sort(key=lambda e: e["start"])
    OUT.write_text(json.dumps(events[:HOW_MANY], indent=2, ensure_ascii=False) + "\n")
    print(f"{len(events[:HOW_MANY])} upcoming meeting(s)")


if __name__ == "__main__":
    main()
