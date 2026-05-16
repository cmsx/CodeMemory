class Warehouse:
    def __init__(self, name):
        self.name = name
        self.stock = {}

    def reserve(self, sku, quantity):
        available = self.stock.get(sku, 0)
        if available < quantity:
            raise ValueError("insufficient stock")
        self.stock[sku] = available - quantity

    def release(self, sku, quantity):
        self.stock[sku] = self.stock.get(sku, 0) + quantity


def total_units(warehouse):
    return sum(warehouse.stock.values())
