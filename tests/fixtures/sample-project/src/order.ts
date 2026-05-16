export type OrderId = string;

export enum OrderStatus {
  Draft = "draft",
  Placed = "placed",
  Cancelled = "cancelled",
}

export interface OrderLine {
  sku: string;
  quantity: number;
}

export class Order {
  readonly id: OrderId;
  status: OrderStatus = OrderStatus.Draft;
  private lines: OrderLine[] = [];

  constructor(id: OrderId) {
    this.id = id;
  }

  addLine(line: OrderLine): void {
    this.lines.push(line);
  }

  place(): void {
    this.status = OrderStatus.Placed;
  }

  cancel(): void {
    this.status = OrderStatus.Cancelled;
  }
}

export const formatOrder = (order: Order): string =>
  `Order ${order.id} [${order.status}]`;
