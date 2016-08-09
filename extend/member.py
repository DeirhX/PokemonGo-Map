from datetime import timedelta

from pogom.models import Scan

scan_pool_guest_max = 30
scan_pool_member_max = 60
scan_pool_duration = timedelta(minutes=60)

def member_scan_pool_max(user):
    return scan_pool_member_max if user else scan_pool_guest_max

def member_scan_pool_remain_ip(ip):
    scans = Scan.get_scan_count_by_ip(ip, scan_pool_duration)
    return max(scan_pool_guest_max - scans, 0)

def member_scan_pool_remain_user(user):
    scans = Scan.get_scan_count_by_account(user, scan_pool_duration)
    return max(scan_pool_member_max - scans, 0)