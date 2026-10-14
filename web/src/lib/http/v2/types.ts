/**
 * Shapes returned by the Go v2 API (see cmd/http). Field names are the
 * snake_case the Go handlers emit; the dashboard maps them to the display
 * types in components/v2/shared.
 */

export type StatementCategory = {
  id: string
  key: string
  label: string
  icon: string
}

export type StatementClassification = {
  id: string
  category: StatementCategory | null
  is_expense: boolean | null
  expense_prob: number | null
  confidence: number | null
  source: string
  classified_at: string | null
}

export type StatementTransaction = {
  id: string
  nr: number
  account: string
  posting_date: string
  transaction_date: string
  description: string
  original_description: string
  parent_category: string | null
  category: string | null
  money_in: string
  money_out: string
  fee: string
  balance: string | null
  classification: StatementClassification | null
  needs_review: boolean
}

export type StatementTransactionsResponse = {
  transactions: Array<StatementTransaction>
}

export type StatementCategoriesResponse = {
  categories: Array<StatementCategory>
}

export type MeResponse = {
  id: string
  name: string
  email: string
}

export type IngestStatementResponse = {
  processed: number
  classified: number
  skipped: number
  errors?: Array<string>
  classification_error?: string
}

export type CorrectTransactionResponse = {
  id: string
  normalised_description: string
  category_id: string
}
