import os
import signal
import subprocess
import sys
from datetime import datetime

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger

INTERVAL_UPDATE = int(os.getenv("INTERVAL_UPDATE", 60))
CONFIG_PATH = os.getenv("CONFIG_PATH", "/config.json")

scheduler = BlockingScheduler()


@scheduler.scheduled_job(IntervalTrigger(seconds=INTERVAL_UPDATE))
def update_all_domains():
    print("[%s] Update all domains ..." % datetime.now(), flush=True)
    subprocess.call(
        ["domain-connect-dyndns", "--config", CONFIG_PATH, "update", "--all"]
    )


def shutdown(_signum, _frame):
    print("[%s] Stop updater ..." % datetime.now(), flush=True)
    scheduler.shutdown(wait=False)
    print("[%s] Exit ..." % datetime.now(), flush=True)
    sys.exit(0)


signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT, shutdown)

print(
    "[%s] Starting updater (period %s sec.) ..." % (datetime.now(), INTERVAL_UPDATE),
    flush=True,
)
scheduler.start()
