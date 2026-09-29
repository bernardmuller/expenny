// Following this pattern: https://tkdodo.eu/blog/effective-react-query-keys
export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    register: {
      all: ['auth', 'register'] as const,
      request: () => ['auth', 'register', 'request'] as const,
      verify: (token: string) => ['auth', 'register', 'verify', token] as const,
    },
    login: {
      all: ['auth', 'login'] as const,
      request: () => ['auth', 'login', 'request'] as const,
      verify: (token: string) => ['auth', 'login', 'verify', token] as const,
    },
  },
  users: {
    all: ['users'] as const,
    current: ['users', 'current'] as const,
    onboard: () => ['users', 'onboard'] as const,
    categories: ['users', 'categories'] as const,
    preferences: ['users', 'preferences'] as const,
  },
  categories: {
    all: ['categories'] as const,
    timeseries: (
      categoryId: string,
      months?: number,
      granularity?: 'month' | 'budget',
    ) => ['categories', categoryId, 'timeseries', months, granularity] as const,
    expenses: (categoryId: string, options?: Record<string, unknown>) =>
      ['categories', categoryId, 'expenses', options] as const,
  },
  budgets: {
    all: ['budgets'] as const,
    active: (userId: string) => ['budgets', 'active', userId] as const,
    byId: (budgetId: string) => ['budgets', budgetId] as const,
    expenses: (budgetId: string) => ['budgets', budgetId, 'expenses'] as const,
    detail: (budgetId: string) => ['budgets', 'detail', budgetId] as const,
    create: () => ['budgets', 'create'] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    create: () => ['transactions', 'create'] as const,
    delete: () => ['transactions', 'delete'] as const,
  },
  recurringExpenses: {
    all: ['recurring-expenses'] as const,
    byUser: (userId: string) => ['recurring-expenses', 'user', userId] as const,
    byBudget: (budgetId: string) =>
      ['recurring-expenses', 'budget', budgetId] as const,
    create: () => ['recurring-expenses', 'create'] as const,
    update: () => ['recurring-expenses', 'update'] as const,
    delete: () => ['recurring-expenses', 'delete'] as const,
    instance: {
      update: () => ['recurring-expenses', 'instance', 'update'] as const,
      delete: () => ['recurring-expenses', 'instance', 'delete'] as const,
    },
  },
  chats: {
    all: ['chats'] as const,
    byUser: (userId: string) => ['chats', 'user', userId] as const,
  },
  verifications: {
    all: ['verifications'] as const,
    byValue: (value: string) => ['verifications', 'value', value] as const,
    create: () => ['verifications', 'create'] as const,
  },
  notificationPreferences: {
    all: ['notification-preferences'] as const,
    list: () => ['notification-preferences', 'list'] as const,
    update: () => ['notification-preferences', 'update'] as const,
  },
  streak: {
    all: ['streak'] as const,
    byUser: (userId: string) => ['streak', 'user', userId] as const,
    checkIn: () => ['streak', 'check-in'] as const,
  },
} as const
