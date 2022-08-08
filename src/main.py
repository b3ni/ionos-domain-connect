import os
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger

scheduler = BlockingScheduler()


@scheduler.scheduled_job(IntervalTrigger(seconds=20))
def train_model():
    print("[%s] Update all domains ..." % datetime.now())
    os.system("domain-connect-dyndns --config /config.json update --all")


print("[%s] Start updater ..." % datetime.now())
scheduler.start()
