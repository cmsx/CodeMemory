package pricing

// Price is a monetary amount stored in minor units (cents).
type Price struct {
	Cents int
}

// Pricer can calculate a total price given a quantity.
type Pricer interface {
	Total(quantity int) Price
}

// NewPrice builds a Price from a whole-currency amount.
func NewPrice(amount int) Price {
	return Price{Cents: amount * 100}
}

// Total multiplies the price by a quantity.
func (p Price) Total(quantity int) Price {
	return Price{Cents: p.Cents * quantity}
}
