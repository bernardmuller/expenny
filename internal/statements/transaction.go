package statements

import "time"

const (
	colNr = iota
	colAccount
	colPostingDate
	colTransactionDate
	colDescription
	colOriginalDescription
	colParentCategory
	colCategory
	colMoneyIn
	colMoneyOut
	colFee
	colBalance

	numColumns
)

const (
	PostingDateLayout     = "2006-01-02"
	TransactionDateLayout = "2006-01-02 15:04"
)

type Transaction struct {
	Nr                  int
	Account             string
	PostingDate         time.Time
	TransactionDate     time.Time
	Description         string
	OriginalDescription string
	ParentCategory      string
	Category            string
	MoneyIn             float64
	MoneyOut            float64
	Fee                 float64
	Balance             float64
}
