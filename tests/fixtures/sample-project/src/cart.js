export class Cart {
  constructor() {
    this.items = [];
  }

  add(sku, quantity) {
    this.items.push({ sku, quantity });
  }

  clear() {
    this.items = [];
  }
}

export function countItems(cart) {
  return cart.items.reduce((n, i) => n + i.quantity, 0);
}

export const isEmpty = (cart) => cart.items.length === 0;
