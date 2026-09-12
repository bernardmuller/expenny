import {
  boolean,
  date,
  decimal,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  integer,
  unique,
  uuid,
  type PgTable,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  onboarded: boolean("onboarded")
    .$defaultFn(() => false)
    .notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  budgetStartDate: integer("budget_start_date"),
  frequency: varchar("frequency", { length: 20 }),
  customDuration: integer("custom_duration"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey(),
  accountId: text("account_id"),
  providerId: text("provider_id"),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
});

// Budgets table
export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  startAmount: varchar("start_amount").notNull(),
  currentAmount: varchar("current_amount").notNull(),
  sa_iv: varchar("sa_iv"),
  sa_tag: varchar("sa_tag"),
  ca_iv: varchar("ca_iv"),
  ca_tag: varchar("ca_tag"),
  isActive: boolean("is_active").default(true).notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at"),
});

// Categories table
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 10 }).default("").notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at"),
});

// User categories junction table
export const userCategories = pgTable(
  "user_categories",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    uniqueUserCategory: unique().on(table.userId, table.categoryId),
  }),
);

// Category budgets junction table
export const categoryBudgets = pgTable("category_budgets", {
  id: uuid("id").primaryKey(),
  budgetId: uuid("budget_id")
    .notNull()
    .references(() => budgets.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  allocatedAmount: decimal("allocated_amount", {
    precision: 10,
    scale: 2,
  }).notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey(),
  budgetId: uuid("budget_id")
    .notNull()
    .references(() => budgets.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  templateId: uuid("template_id").references(
    () => recurringExpenseTemplates.id,
    { onDelete: "set null" },
  ),
  note: varchar("note", { length: 255 }),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at"),
});

// Recurring expense templates (user-level definitions)
export const recurringExpenseTemplates = pgTable(
  "recurring_expense_templates",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    description: varchar("description", { length: 255 }).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    scheduledAt: varchar("scheduled_at")
      .$defaultFn(() => "1")
      .notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("recurring_expense_templates_user_id_idx").on(
      table.userId,
    ),
    userIdDeletedAtIdx: index(
      "recurring_expense_templates_user_id_deleted_at_idx",
    ).on(table.userId, table.deletedAt),
    userIdDescriptionActiveUq: uniqueIndex(
      "recurring_expense_templates_user_id_description_active_uq",
    )
      .on(table.userId, table.description)
      .where(sql`${table.deletedAt} IS NULL`),
  }),
);

// Budget-specific recurring expense instances (snapshots from templates)
export const budgetRecurringExpenses = pgTable(
  "budget_recurring_expenses",
  {
    id: uuid("id").primaryKey(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    description: varchar("description", { length: 255 }).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    isPaid: boolean("is_paid").default(false).notNull(),
    expenseId: uuid("expense_id").references(() => expenses.id, {
      onDelete: "set null",
    }),
    templateId: uuid("template_id").references(
      () => recurringExpenseTemplates.id,
      { onDelete: "set null" },
    ),
    scheduledAt: varchar("scheduled_at"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    budgetIdIdx: index("budget_recurring_expenses_budget_id_idx").on(
      table.budgetId,
    ),
    budgetIdDeletedAtIdx: index(
      "budget_recurring_expenses_budget_id_deleted_at_idx",
    ).on(table.budgetId, table.deletedAt),
    expenseIdIdx: index("budget_recurring_expenses_expense_id_idx").on(
      table.expenseId,
    ),
    templateIdIdx: index("budget_recurring_expenses_template_id_idx").on(
      table.templateId,
    ),
  }),
);

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  chatId: text("chat_id"),
  type: text("type"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  entityId: uuid("entity_id"),
  type: varchar("type", { length: 100 }).notNull(),
  enabled: boolean("enabled")
    .$defaultFn(() => true)
    .notNull(),
  channel: varchar("channel", { length: 20 }).notNull(),
  scheduledAt: date("scheduled_at", { mode: "date" }),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("none"),
  message: text("message").notNull(),
  channel: varchar("channel", { length: 20 }).notNull(),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

// Daily app-activity used to build engagement streaks
export const userActivity = pgTable(
  "user_activity",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    count: integer("count").default(1).notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    userIdDateUq: uniqueIndex("user_activity_user_id_date_uq").on(
      table.userId,
      table.date,
    ),
    userIdIdx: index("user_activity_user_id_idx").on(table.userId),
  }),
);

// Relations
export const userRelations = relations(users, ({ many }) => ({
  budgets: many(budgets),
  userCategories: many(userCategories),
  recurringExpenseTemplates: many(recurringExpenseTemplates),
  notificationPreferences: many(notificationPreferences),
  notifications: many(notifications),
  userActivity: many(userActivity),
}));

export const userActivityRelations = relations(userActivity, ({ one }) => ({
  user: one(users, {
    fields: [userActivity.userId],
    references: [users.id],
  }),
}));

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const budgetRelations = relations(budgets, ({ one, many }) => ({
  user: one(users, {
    fields: [budgets.userId],
    references: [users.id],
  }),
  expenses: many(expenses),
  categoryBudgets: many(categoryBudgets),
  budgetRecurringExpenses: many(budgetRecurringExpenses),
}));

export const expenseRelations = relations(expenses, ({ one }) => ({
  budget: one(budgets, {
    fields: [expenses.budgetId],
    references: [budgets.id],
  }),
  category: one(categories, {
    fields: [expenses.categoryId],
    references: [categories.id],
  }),
}));

export const categoryRelations = relations(categories, ({ many }) => ({
  userCategories: many(userCategories),
  categoryBudgets: many(categoryBudgets),
  expenses: many(expenses),
  recurringExpenseTemplates: many(recurringExpenseTemplates),
  budgetRecurringExpenses: many(budgetRecurringExpenses),
}));

export const recurringExpenseTemplateRelations = relations(
  recurringExpenseTemplates,
  ({ one }) => ({
    user: one(users, {
      fields: [recurringExpenseTemplates.userId],
      references: [users.id],
    }),
    category: one(categories, {
      fields: [recurringExpenseTemplates.categoryId],
      references: [categories.id],
    }),
  }),
);

export const budgetRecurringExpenseRelations = relations(
  budgetRecurringExpenses,
  ({ one }) => ({
    budget: one(budgets, {
      fields: [budgetRecurringExpenses.budgetId],
      references: [budgets.id],
    }),
    category: one(categories, {
      fields: [budgetRecurringExpenses.categoryId],
      references: [categories.id],
    }),
    expense: one(expenses, {
      fields: [budgetRecurringExpenses.expenseId],
      references: [expenses.id],
    }),
  }),
);

export const userCategoryRelations = relations(userCategories, ({ one }) => ({
  user: one(users, {
    fields: [userCategories.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [userCategories.categoryId],
    references: [categories.id],
  }),
}));

export const categoryBudgetRelations = relations(
  categoryBudgets,
  ({ one }) => ({
    budget: one(budgets, {
      fields: [categoryBudgets.budgetId],
      references: [budgets.id],
    }),
    category: one(categories, {
      fields: [categoryBudgets.categoryId],
      references: [categories.id],
    }),
  }),
);

// OAuth 2.1 dynamic client registration registry (MCP client credentials)
export const oauthClients = pgTable(
  "oauth_clients",
  {
    id: uuid("id").primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret").notNull(),
    clientName: text("client_name").notNull(),
    clientUri: text("client_uri"),
    redirectUris: text("redirect_uris"),
    grantTypes: text("grant_types").notNull(),
    scopes: text("scopes").default("openid profile email").notNull(),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method")
      .default("client_secret_basic")
      .notNull(),
    disabled: boolean("disabled").default(false).notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    clientIdIdx: uniqueIndex("oauth_clients_client_id_idx").on(table.clientId),
  }),
);

export const betterAuthSchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
} as const;

for (const [modelName, table] of Object.entries(betterAuthSchema)) {
  (table as PgTable & { modelName?: string }).modelName = modelName;
}

// Types
export type User = typeof users.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type UserCategory = typeof userCategories.$inferSelect;
export type NewUserCategory = typeof userCategories.$inferInsert;
export type CategoryBudget = typeof categoryBudgets.$inferSelect;
export type NewCategoryBudget = typeof categoryBudgets.$inferInsert;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerifications = typeof verifications.$inferInsert;
export type RecurringExpenseTemplate =
  typeof recurringExpenseTemplates.$inferSelect;
export type NewRecurringExpenseTemplate =
  typeof recurringExpenseTemplates.$inferInsert;
export type BudgetRecurringExpense =
  typeof budgetRecurringExpenses.$inferSelect;
export type NewBudgetRecurringExpense =
  typeof budgetRecurringExpenses.$inferInsert;
export type Chats = typeof chats.$inferInsert;
export type NotificationPreference =
  typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference =
  typeof notificationPreferences.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type UserActivity = typeof userActivity.$inferSelect;
export type NewUserActivity = typeof userActivity.$inferInsert;
export type OAuthClient = typeof oauthClients.$inferSelect;
export type NewOAuthClient = typeof oauthClients.$inferInsert;
