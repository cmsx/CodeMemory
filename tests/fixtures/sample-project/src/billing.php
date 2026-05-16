<?php

namespace Shop;

interface Invoiceable
{
    public function invoiceTotal(): int;
}

class Invoice implements Invoiceable
{
    private int $amount = 0;

    public function addCharge(int $cents): void
    {
        $this->amount += $cents;
    }

    public function invoiceTotal(): int
    {
        return $this->amount;
    }
}

trait Discountable
{
    public function applyDiscount(int $percent): int
    {
        return (int) ($this->invoiceTotal() * (1 - $percent / 100));
    }
}

enum PaymentMethod: string
{
    case Card     = 'card';
    case Cash     = 'cash';
    case Transfer = 'transfer';
}

function formatCents(int $cents): string
{
    return number_format($cents / 100, 2);
}
