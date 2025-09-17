import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const senderEmails = pgTable("sender_emails", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  replyTo: text("reply_to"),
  isDefault: boolean("is_default").default(false).notNull(),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  signatureImage: text("signature_image"),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  company: text("company"),
  tags: text("tags").array().default([]).notNull(),
  position: text("position"),
  city: text("city"),
  stateProvince: text("state_province"),
  country: text("country"),
  number: text("number"),
  timeZone: text("time_zone"),
  department: text("department"),
  priority: integer("priority"),
  signal: text("signal"),
  signalLevel: text("signal_level"),
  compliment: text("compliment"),
  industry: text("industry"),
  links: text("links"),
  source: text("source"),
  contactCount: integer("contact_count").default(0).notNull(),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  templateId: integer("template_id").references(() => templates.id), // Keep for backward compatibility
  templateIds: jsonb("template_ids"), // Array of template IDs for multi-template support
  currentTemplateIndex: integer("current_template_index").default(0).notNull(), // Round-robin tracking
  senderEmailId: integer("sender_email_id").references(() => senderEmails.id).notNull(),
  status: text("status", { enum: ["draft", "active", "paused", "completed"] }).default("draft").notNull(),
  warmupMode: boolean("warmup_mode").default(true).notNull(),
  archived: boolean("archived").default(false).notNull(),
  totalContacts: integer("total_contacts").default(0).notNull(),
  emailsSent: integer("emails_sent").default(0).notNull(),
  // Long-running campaign fields
  type: text("type", { enum: ["regular", "long_running"] }).default("regular").notNull(),
  campaignDuration: integer("campaign_duration"), // in days
  reportInterval: jsonb("report_interval"), // {daily: boolean, weekly: boolean}
  contactFilters: jsonb("contact_filters"), // stored filter criteria
  emailsPerDay: integer("emails_per_day"), // daily email limit
  lastReportSent: timestamp("last_report_sent"),
  endDate: timestamp("end_date"), // calculated end date for the campaign
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailHistory = pgTable("email_history", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => templates.id).notNull(),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  senderEmailId: integer("sender_email_id").references(() => senderEmails.id).notNull(),
  contactEmail: text("contact_email").notNull(),
  contactName: text("contact_name").notNull(),
  personalizedSubject: text("personalized_subject").notNull(),
  personalizedContent: text("personalized_content").notNull(),
  status: text("status", { enum: ["pending", "sent", "failed"] }).default("pending").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  externalId: text("external_id"),
  errorMessage: text("error_message"),
  opened: boolean("opened").default(false).notNull(),
  openedAt: timestamp("opened_at"),
});

// Junction table for campaign-contact relationships
export const campaignContacts = pgTable("campaign_contacts", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id).notNull(),
  contactId: integer("contact_id").references(() => contacts.id).notNull(),
  emailSent: boolean("email_sent").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const senderEmailsRelations = relations(senderEmails, ({ many }) => ({
  campaigns: many(campaigns),
  emailHistory: many(emailHistory),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  template: one(templates, {
    fields: [campaigns.templateId],
    references: [templates.id],
  }),
  senderEmail: one(senderEmails, {
    fields: [campaigns.senderEmailId],
    references: [senderEmails.id],
  }),
  campaignContacts: many(campaignContacts),
  emailHistory: many(emailHistory),
}));

export const emailHistoryRelations = relations(emailHistory, ({ one }) => ({
  template: one(templates, {
    fields: [emailHistory.templateId],
    references: [templates.id],
  }),
  campaign: one(campaigns, {
    fields: [emailHistory.campaignId],
    references: [campaigns.id],
  }),
  senderEmail: one(senderEmails, {
    fields: [emailHistory.senderEmailId],
    references: [senderEmails.id],
  }),
}));

export const insertSenderEmailSchema = createInsertSchema(senderEmails).omit({
  id: true,
  createdAt: true,
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

// Create a separate schema for campaign-eligible contacts (must have email)
export const campaignEligibleContactSchema = insertContactSchema.extend({
  email: z.string().email("Valid email is required for campaign contacts"),
});

// Base schema without refine for use with .partial()
const baseCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  templateId: true, // Remove this to avoid conflicts, we'll add it back with proper typing
}).extend({
  // Custom validation for template selection
  templateIds: z.array(z.number()).min(1, "At least one template is required").optional(),
  templateId: z.number().optional(), // Backward compatibility - explicitly optional
});

export const insertCampaignSchema = baseCampaignSchema.refine((data) => {
  // Either templateId (legacy) or templateIds (new) must be provided
  return data.templateId || (data.templateIds && data.templateIds.length > 0);
}, {
  message: "Either templateId or templateIds must be provided",
});

// For partial updates, use the base schema without refine
export const updateCampaignSchema = baseCampaignSchema.partial();

export const insertEmailHistorySchema = createInsertSchema(emailHistory).omit({
  id: true,
});

export const insertCampaignContactSchema = createInsertSchema(campaignContacts).omit({
  id: true,
  createdAt: true,
});

export type SenderEmail = typeof senderEmails.$inferSelect;
export type InsertSenderEmail = z.infer<typeof insertSenderEmailSchema>;

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

export type EmailHistory = typeof emailHistory.$inferSelect;
export type InsertEmailHistory = z.infer<typeof insertEmailHistorySchema>;

export type CampaignContact = typeof campaignContacts.$inferSelect;
export type InsertCampaignContact = z.infer<typeof insertCampaignContactSchema>;

export type AppStats = {
  totalTemplates: number;
  totalContacts: number;
  totalSent: number;
  totalFailed?: number;
  totalEmails?: number;
};
