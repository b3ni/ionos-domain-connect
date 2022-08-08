import os
import subprocess
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger

INTERVAL_UPDATE = int(os.getenv("INTERVAL_UPDATE", 60))

scheduler = BlockingScheduler()


@scheduler.scheduled_job(IntervalTrigger(seconds=INTERVAL_UPDATE))
def train_model():
    print("[%s] Update all domains ..." % datetime.now())
    os.system("domain-connect-dyndns --config /config.json update --all")


try:
    print(
        "[%s] Starting updater (period %s sec.) ..." % (datetime.now(), INTERVAL_UPDATE)
    )
    scheduler.start()
except (KeyboardInterrupt, SystemExit):
    print("[%s] Stop updater ..." % datetime.now())
    scheduler.shutdown()
    print("[%s] Exit ..." % datetime.now())
    exit(0)
