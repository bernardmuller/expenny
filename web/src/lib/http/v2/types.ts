/**
 * Shapes returned by the Go v2 API (see cmd/http). Field names are the
 * snake_case the Go handlers emit; the dashboard maps them to the display
 * types in components/v2/shared.
 */

export type StatementCategoryGroup = {
  id: string
  key: string
  label: string
}

export type StatementCategory = {
  id: string
  key: string
  label: string
  icon: string
  /** Populated by the categories endpoint; nested categories may omit it. */
  groups?: Array<StatementCategoryGroup>
}

export type StatementClassification = {
  id: string
  category: StatementCategory | null
  is_expense: boolean | null
  expense_prob: number | null
  confidence: number | null
  source: string
  group: string | null
  classified_at: string | null
  /** NULL means the table still highlights the row as new. */
  seen_at?: string | null
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
  total: number
  review_count: number
  next_offset: number | null
}

export type MarkTransactionSeenResponse = {
  seen_at: string
}

export type StatementCategoriesResponse = {
  categories: Array<StatementCategory>
}

export type CategoryGroupsResponse = {
  groups: Array<StatementCategoryGroup>
}

export type CategoryBudgetCategory = {
  id: string
  key: string
  label: string
  icon: string
  category_budget_id: string | null
  allocated: string | null
  spent: string
}

export type CategoryBudgetGroup = {
  key: string
  label: string
  categories: Array<CategoryBudgetCategory>
}

export type CategoryBudgetOverview = {
  budget: {
    id: string
    name: string
    start_date: string | null
    end_date: string | null
  } | null
  groups: Array<CategoryBudgetGroup>
}

export type MeResponse = {
  id: string
  name: string
  email: string
}

export type IngestStatementResponse = {
  processed: number
  skipped: number
  /** Statement date range, so the drawer can show it before classification. */
  from: string | null
  to: string | null
  errors?: Array<string>
}

export type ClassifiedTransaction = {
  id: string
  description: string
  original_description: string
  transaction_date: string
  category: StatementCategory | null
  is_expense: boolean | null
  confidence: number | null
  group: string | null
  needs_review: boolean
  error?: string
}

export type ClassifyTransactionsResponse = {
  rows: Array<ClassifiedTransaction>
  /** Ids that were already classified or did not belong to the user. */
  skipped: number
  /** The user's rows still waiting for a classification after this batch. */
  pending: number
}

/** How much of the user's statement is still waiting to be classified. */
export type ClassificationStatusResponse = {
  total: number
  classified: number
  pending: number
  needs_review: number
}

export type CorrectTransactionResponse = {
  id: string
  normalised_description: string
  category_id: string
}

export type CorrectionsResponse = {
  corrections: Array<Correction>
}

export type Correction = {
  id: string
  description: string
  category: StatementCategory
  created_at: string
  updated_at: string
}

export type BudgetPreferences = {
  start_date: string
  end_date: string
  account: string | null
}

export type BudgetSalaryTransaction = {
  id: string
  description: string
  original_description: string
  transaction_date: string
  amount: string
}

/** Statement-derived budget: latest balance, salary anchor, and the gap. */
export type BudgetResponse = {
  preferences: BudgetPreferences | null
  current_balance: string | null
  salary_amount: string | null
  salary_transaction: BudgetSalaryTransaction | null
  spent_amount: string | null
  accounts: Array<string>
}
