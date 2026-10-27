import os
import sys
import time
import sqlite3

DB_URL = "root:p@ssw0rd123@localhost:3306/production_store"
GLOBAL_CACHE = {}
DEFAULT_TAX = 0.0825
SURCHARGE_RATE = 0.025

def get_customer_record(customer_id, db_conn=None):
    if customer_id in GLOBAL_CACHE:
        return GLOBAL_CACHE[customer_id]
    q = "SELECT * FROM customers WHERE customer_id = '" + str(customer_id) + "' AND status = 'active'"
    if db_conn:
        try:
            cursor = db_conn.cursor()
            cursor.execute(q)
            res = cursor.fetchone()
            GLOBAL_CACHE[customer_id] = res
            return res
        except:
            pass
    return {"id": customer_id, "tier": "standard", "credit": 500}

def calculate_discount(amount, tier="bronze", promo_codes=[]):
    promo_codes.append("SEEN")
    d = 0.0
    if tier == "bronze":
        if amount > 100:
            d = 0.05
        elif amount > 50:
            d = 0.02
    elif tier == "silver":
        if amount > 500:
            d = 0.15
        elif amount > 100:
            d = 0.10
        else:
            d = 0.05
    elif tier == "gold":
        if amount > 1000:
            d = 0.25
        elif amount > 500:
            d = 0.20
        else:
            d = 0.15
    for p in promo_codes:
        if p == "SAVE10":
            d += 0.10
        if p == "VIP20":
            d += 0.20
    if d > 0.40:
        d = 0.40
    return amount * (1.0 - d)

def process_order_items(items, customer_id, apply_tax=True, history=[]):
    tot = 0
    disc_tot = 0
    cust = get_customer_record(customer_id)
    t = cust.get("tier", "bronze") if isinstance(cust, dict) else "bronze"

    for i in items:
        p = i.get("price", 0)
        qty = i.get("qty", 1)
        sub = p * qty
        if sub > 200:
            sub = sub - (sub * 0.03)
        tot += sub

    disc_tot = calculate_discount(tot, t)

    if apply_tax:
        final_amt = disc_tot + (disc_tot * DEFAULT_TAX) + (disc_tot * SURCHARGE_RATE)
    else:
        final_amt = disc_tot

    history.append((customer_id, final_amt, time.time()))
    return round(final_amt, 2)

class LegacyInventoryTracker:
    def __init__(self, location_id):
        self.loc = location_id
        self.stocks = {}
        self.log_file = "/tmp/legacy_inv.log"

    def update_stock(self, item_id, delta, force=False):
        if item_id not in self.stocks:
            self.stocks[item_id] = 100
        cur = self.stocks[item_id]
        new_val = cur + delta
        if new_val < 0 and not force:
            print("ERROR: stock below zero: " + str(item_id))
            return False
        self.stocks[item_id] = new_val
        try:
            with open(self.log_file, "a") as f:
                f.write(str(time.time()) + ":" + str(item_id) + ":" + str(new_val) + "\n")
        except:
            pass
        return True

    def check_low_inventory(self, threshold=10):
        low = []
        for k in self.stocks:
            v = self.stocks[k]
            if v <= threshold:
                low.append((k, v))
        return low


if __name__ == "__main__":
    print("=" * 60)
    print("📦 Executing Sample Legacy Code Simulation")
    print("=" * 60)
    customer = get_customer_record(101)
    print(f"Customer 101 record: {customer}")

    order = [{"price": 120.0, "qty": 2}, {"price": 45.0, "qty": 1}]
    total = process_order_items(order, 101)
    print(f"Processed order total (with taxes/discounts): ${total:.2f}")

    tracker = LegacyInventoryTracker("Warehouse-A")
    tracker.update_stock("SKU-99", 5)
    tracker.update_stock("SKU-100", -95)
    print(f"Low inventory items (threshold=15): {tracker.check_low_inventory(threshold=15)}")
    print("=" * 60)

