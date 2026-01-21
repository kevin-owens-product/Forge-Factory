# ADR-061: Subscription & Billing Integration

## Status
Proposed

## Date
2026-01-21

## Priority
P1 - Enterprise Features

## Complexity
High - External payment system integration with financial compliance requirements

## Context

Forge Factory requires a comprehensive subscription and billing system to monetize the platform and manage customer relationships. The system must integrate with Stripe for payment processing, support multiple pricing tiers, handle complex enterprise billing scenarios, and maintain strict financial compliance.

### Business Requirements
- **FF-012**: Stripe payment integration
- **FF-014**: Subscription plan management
- **Enterprise Billing**: Custom contracts, volume discounts, committed use
- **Invoicing**: Automated invoice generation, PDF export, payment reminders
- **Revenue Recognition**: ASC 606 compliance for SaaS revenue
- **Global Payments**: Multi-currency, regional tax compliance

### Technical Challenges
1. **Payment Security**: PCI DSS compliance without handling raw card data
2. **Webhook Reliability**: Idempotent processing of Stripe events
3. **Billing Accuracy**: Precise usage metering and proration
4. **Enterprise Complexity**: Custom pricing, multi-entity billing
5. **Subscription Lifecycle**: Trials, upgrades, downgrades, cancellations
6. **Financial Reconciliation**: Matching payments to invoices

## Decision

We will implement a **Stripe-Native Billing Architecture** that leverages Stripe's subscription and billing infrastructure while maintaining local state for business logic, analytics, and enterprise customizations.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Billing Service Layer                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  Plan Manager   │  │   Subscription  │  │    Invoice      │         │
│  │                 │  │    Service      │  │    Service      │         │
│  │ - Plan CRUD     │  │ - Create/Update │  │ - Generation    │         │
│  │ - Features      │  │ - Proration     │  │ - PDF Export    │         │
│  │ - Pricing       │  │ - Trials        │  │ - Reminders     │         │
│  │ - Entitlements  │  │ - Lifecycle     │  │ - Payment Apply │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                   │
│  ┌────────┴────────────────────┴────────────────────┴────────┐         │
│  │                    Billing Orchestrator                    │         │
│  │  - Business Rules  - Event Coordination  - State Machine   │         │
│  └────────┬────────────────────┬────────────────────┬────────┘         │
│           │                    │                    │                   │
│  ┌────────┴────────┐  ┌────────┴────────┐  ┌────────┴────────┐         │
│  │  Usage Meter    │  │ Payment Gateway │  │   Tax Engine    │         │
│  │  Integration    │  │   (Stripe)      │  │                 │         │
│  │                 │  │                 │  │ - Rate Lookup   │         │
│  │ - ADR-060 Link  │  │ - Customers     │  │ - Jurisdiction  │         │
│  │ - Aggregation   │  │ - Payments      │  │ - Exemptions    │         │
│  │ - Rating        │  │ - Webhooks      │  │ - Reporting     │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component 1: Plan & Pricing Management

```typescript
// Plan definition with feature entitlements
interface PricingPlan {
  id: string;
  stripeProductId: string;
  name: string;
  description: string;
  tier: PlanTier;
  features: PlanFeature[];
  prices: PlanPrice[];
  entitlements: Entitlement[];
  trialDays: number;
  metadata: Record<string, string>;
  isPublic: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

enum PlanTier {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  TEAM = 'team',
  ENTERPRISE = 'enterprise',
  CUSTOM = 'custom'
}

interface PlanFeature {
  key: string;
  name: string;
  description: string;
  included: boolean;
  limit?: number;
  unit?: string;
}

interface PlanPrice {
  id: string;
  stripePriceId: string;
  currency: string;
  amount: number;
  interval: BillingInterval;
  intervalCount: number;
  usageType: 'licensed' | 'metered' | 'tiered';
  tieredPricing?: PriceTier[];
  metadata: Record<string, string>;
}

enum BillingInterval {
  MONTHLY = 'month',
  QUARTERLY = 'quarter',
  ANNUAL = 'year'
}

interface PriceTier {
  upTo: number | 'inf';
  unitAmount: number;
  flatAmount?: number;
}

interface Entitlement {
  feature: string;
  access: 'unlimited' | 'limited' | 'none';
  limit?: number;
  softLimit?: number;
  overage?: {
    allowed: boolean;
    unitPrice: number;
  };
}

// Plan management service
class PlanManager {
  constructor(
    private stripe: Stripe,
    private planRepository: PlanRepository,
    private cache: CacheService
  ) {}

  async createPlan(input: CreatePlanInput): Promise<PricingPlan> {
    // Create product in Stripe first
    const stripeProduct = await this.stripe.products.create({
      name: input.name,
      description: input.description,
      metadata: {
        tier: input.tier,
        forgeFactoryPlanId: input.id
      }
    });

    // Create prices in Stripe
    const stripePrices = await Promise.all(
      input.prices.map(price => this.createStripePrice(stripeProduct.id, price))
    );

    // Store plan locally with Stripe references
    const plan: PricingPlan = {
      id: input.id,
      stripeProductId: stripeProduct.id,
      name: input.name,
      description: input.description,
      tier: input.tier,
      features: input.features,
      prices: stripePrices.map((sp, i) => ({
        ...input.prices[i],
        stripePriceId: sp.id
      })),
      entitlements: input.entitlements,
      trialDays: input.trialDays ?? 0,
      metadata: input.metadata ?? {},
      isPublic: input.isPublic ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.planRepository.save(plan);
    await this.cache.invalidate(`plans:*`);

    return plan;
  }

  async getPlanEntitlements(planId: string): Promise<Map<string, Entitlement>> {
    const cacheKey = `plans:entitlements:${planId}`;
    const cached = await this.cache.get<Map<string, Entitlement>>(cacheKey);
    if (cached) return cached;

    const plan = await this.planRepository.findById(planId);
    if (!plan) throw new NotFoundError('Plan not found');

    const entitlementMap = new Map(
      plan.entitlements.map(e => [e.feature, e])
    );

    await this.cache.set(cacheKey, entitlementMap, { ttl: 3600 });
    return entitlementMap;
  }

  async comparePlans(fromPlanId: string, toPlanId: string): Promise<PlanComparison> {
    const [fromPlan, toPlan] = await Promise.all([
      this.planRepository.findById(fromPlanId),
      this.planRepository.findById(toPlanId)
    ]);

    const tierOrder = Object.values(PlanTier);
    const isUpgrade = tierOrder.indexOf(toPlan.tier) > tierOrder.indexOf(fromPlan.tier);

    const addedFeatures = toPlan.features.filter(
      f => f.included && !fromPlan.features.find(ff => ff.key === f.key)?.included
    );

    const removedFeatures = fromPlan.features.filter(
      f => f.included && !toPlan.features.find(tf => tf.key === f.key)?.included
    );

    const limitChanges = toPlan.entitlements
      .filter(te => {
        const fromEntitlement = fromPlan.entitlements.find(fe => fe.feature === te.feature);
        return fromEntitlement && fromEntitlement.limit !== te.limit;
      })
      .map(te => ({
        feature: te.feature,
        from: fromPlan.entitlements.find(fe => fe.feature === te.feature)!.limit,
        to: te.limit
      }));

    return {
      isUpgrade,
      isDowngrade: !isUpgrade,
      addedFeatures,
      removedFeatures,
      limitChanges,
      priceDifference: this.calculatePriceDifference(fromPlan, toPlan)
    };
  }

  private async createStripePrice(productId: string, price: Omit<PlanPrice, 'id' | 'stripePriceId'>): Promise<Stripe.Price> {
    const priceParams: Stripe.PriceCreateParams = {
      product: productId,
      currency: price.currency,
      recurring: {
        interval: price.interval,
        interval_count: price.intervalCount,
        usage_type: price.usageType === 'metered' ? 'metered' : 'licensed'
      }
    };

    if (price.usageType === 'tiered' && price.tieredPricing) {
      priceParams.billing_scheme = 'tiered';
      priceParams.tiers_mode = 'graduated';
      priceParams.tiers = price.tieredPricing.map(tier => ({
        up_to: tier.upTo === 'inf' ? 'inf' : tier.upTo,
        unit_amount: tier.unitAmount,
        flat_amount: tier.flatAmount
      }));
    } else {
      priceParams.unit_amount = price.amount;
    }

    return this.stripe.prices.create(priceParams);
  }

  private calculatePriceDifference(from: PricingPlan, to: PricingPlan): PriceDifference {
    const fromMonthly = from.prices.find(p => p.interval === BillingInterval.MONTHLY);
    const toMonthly = to.prices.find(p => p.interval === BillingInterval.MONTHLY);

    return {
      monthly: (toMonthly?.amount ?? 0) - (fromMonthly?.amount ?? 0),
      currency: fromMonthly?.currency ?? toMonthly?.currency ?? 'usd'
    };
  }
}
```

### Component 2: Subscription Lifecycle Management

```typescript
// Subscription state machine
interface Subscription {
  id: string;
  stripeSubscriptionId: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAt?: Date;
  canceledAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  quantity: number;
  items: SubscriptionItem[];
  discount?: SubscriptionDiscount;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

enum SubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  CANCELED = 'canceled',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
  PAUSED = 'paused'
}

interface SubscriptionItem {
  id: string;
  stripeItemId: string;
  priceId: string;
  quantity: number;
  usageType: 'licensed' | 'metered';
}

class SubscriptionService {
  constructor(
    private stripe: Stripe,
    private subscriptionRepository: SubscriptionRepository,
    private planManager: PlanManager,
    private usageTracker: UsageTracker,
    private eventBus: EventBus,
    private auditLogger: AuditLogger
  ) {}

  async createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    const plan = await this.planManager.getPlan(input.planId);
    const price = plan.prices.find(p => p.interval === input.billingInterval);

    if (!price) {
      throw new ValidationError('Invalid billing interval for plan');
    }

    // Get or create Stripe customer
    const stripeCustomerId = await this.getOrCreateStripeCustomer(input.organizationId);

    // Build subscription parameters
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: stripeCustomerId,
      items: [{
        price: price.stripePriceId,
        quantity: input.quantity ?? 1
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        organizationId: input.organizationId,
        planId: input.planId
      }
    };

    // Apply trial if applicable
    if (plan.trialDays > 0 && !input.skipTrial) {
      subscriptionParams.trial_period_days = plan.trialDays;
    }

    // Apply coupon if provided
    if (input.couponCode) {
      subscriptionParams.coupon = input.couponCode;
    }

    const stripeSubscription = await this.stripe.subscriptions.create(subscriptionParams);

    // Store subscription locally
    const subscription = await this.subscriptionRepository.create({
      stripeSubscriptionId: stripeSubscription.id,
      organizationId: input.organizationId,
      planId: input.planId,
      status: this.mapStripeStatus(stripeSubscription.status),
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      trialStart: stripeSubscription.trial_start
        ? new Date(stripeSubscription.trial_start * 1000)
        : undefined,
      trialEnd: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000)
        : undefined,
      quantity: input.quantity ?? 1,
      items: [{
        id: generateId(),
        stripeItemId: stripeSubscription.items.data[0].id,
        priceId: price.id,
        quantity: input.quantity ?? 1,
        usageType: price.usageType === 'metered' ? 'metered' : 'licensed'
      }],
      metadata: input.metadata ?? {}
    });

    await this.eventBus.publish({
      type: 'subscription.created',
      data: { subscription, plan }
    });

    await this.auditLogger.log({
      action: 'subscription.create',
      organizationId: input.organizationId,
      resourceType: 'subscription',
      resourceId: subscription.id,
      details: {
        planId: input.planId,
        billingInterval: input.billingInterval,
        quantity: input.quantity
      }
    });

    return subscription;
  }

  async changePlan(
    subscriptionId: string,
    newPlanId: string,
    options: ChangePlanOptions = {}
  ): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) throw new NotFoundError('Subscription not found');

    const [currentPlan, newPlan] = await Promise.all([
      this.planManager.getPlan(subscription.planId),
      this.planManager.getPlan(newPlanId)
    ]);

    const comparison = await this.planManager.comparePlans(subscription.planId, newPlanId);
    const newPrice = newPlan.prices.find(p =>
      p.interval === options.billingInterval ?? BillingInterval.MONTHLY
    );

    if (!newPrice) throw new ValidationError('Invalid billing interval');

    // Determine proration behavior
    const prorationBehavior = this.determineProrationBehavior(comparison, options);

    // Update in Stripe
    const stripeSubscription = await this.stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [{
          id: subscription.items[0].stripeItemId,
          price: newPrice.stripePriceId,
          quantity: options.quantity ?? subscription.quantity
        }],
        proration_behavior: prorationBehavior,
        metadata: {
          ...subscription.metadata,
          planId: newPlanId,
          previousPlanId: subscription.planId
        }
      }
    );

    // Update local record
    const updatedSubscription = await this.subscriptionRepository.update(subscriptionId, {
      planId: newPlanId,
      status: this.mapStripeStatus(stripeSubscription.status),
      items: [{
        ...subscription.items[0],
        priceId: newPrice.id,
        quantity: options.quantity ?? subscription.quantity
      }],
      quantity: options.quantity ?? subscription.quantity,
      updatedAt: new Date()
    });

    await this.eventBus.publish({
      type: comparison.isUpgrade ? 'subscription.upgraded' : 'subscription.downgraded',
      data: {
        subscription: updatedSubscription,
        previousPlan: currentPlan,
        newPlan
      }
    });

    await this.auditLogger.log({
      action: comparison.isUpgrade ? 'subscription.upgrade' : 'subscription.downgrade',
      organizationId: subscription.organizationId,
      resourceType: 'subscription',
      resourceId: subscriptionId,
      details: {
        fromPlanId: subscription.planId,
        toPlanId: newPlanId,
        prorationBehavior
      }
    });

    return updatedSubscription;
  }

  async cancelSubscription(
    subscriptionId: string,
    options: CancelOptions = {}
  ): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) throw new NotFoundError('Subscription not found');

    const cancelParams: Stripe.SubscriptionUpdateParams = {};

    if (options.immediately) {
      // Cancel immediately
      await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    } else {
      // Cancel at period end (default)
      cancelParams.cancel_at_period_end = true;
      await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        cancelParams
      );
    }

    const updatedSubscription = await this.subscriptionRepository.update(subscriptionId, {
      status: options.immediately ? SubscriptionStatus.CANCELED : subscription.status,
      cancelAt: options.immediately ? new Date() : subscription.currentPeriodEnd,
      canceledAt: new Date(),
      updatedAt: new Date()
    });

    // Capture cancellation reason
    if (options.reason) {
      await this.captureCancellationFeedback(subscriptionId, options.reason, options.feedback);
    }

    await this.eventBus.publish({
      type: 'subscription.canceled',
      data: {
        subscription: updatedSubscription,
        immediately: options.immediately,
        reason: options.reason
      }
    });

    return updatedSubscription;
  }

  async pauseSubscription(subscriptionId: string, resumeAt?: Date): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) throw new NotFoundError('Subscription not found');

    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      pause_collection: {
        behavior: 'void',
        resumes_at: resumeAt ? Math.floor(resumeAt.getTime() / 1000) : undefined
      }
    });

    return this.subscriptionRepository.update(subscriptionId, {
      status: SubscriptionStatus.PAUSED,
      metadata: {
        ...subscription.metadata,
        pausedAt: new Date().toISOString(),
        resumeAt: resumeAt?.toISOString()
      },
      updatedAt: new Date()
    });
  }

  async reactivateSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) throw new NotFoundError('Subscription not found');

    if (subscription.status === SubscriptionStatus.PAUSED) {
      await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        pause_collection: ''
      });
    } else if (subscription.cancelAt) {
      await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false
      });
    }

    return this.subscriptionRepository.update(subscriptionId, {
      status: SubscriptionStatus.ACTIVE,
      cancelAt: undefined,
      updatedAt: new Date()
    });
  }

  private determineProrationBehavior(
    comparison: PlanComparison,
    options: ChangePlanOptions
  ): Stripe.SubscriptionUpdateParams.ProrationBehavior {
    if (options.prorationBehavior) return options.prorationBehavior;

    // Upgrades prorate immediately, downgrades at period end
    if (comparison.isUpgrade) {
      return 'create_prorations';
    } else {
      return 'none'; // Downgrade takes effect at period end
    }
  }

  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      'trialing': SubscriptionStatus.TRIALING,
      'active': SubscriptionStatus.ACTIVE,
      'past_due': SubscriptionStatus.PAST_DUE,
      'unpaid': SubscriptionStatus.UNPAID,
      'canceled': SubscriptionStatus.CANCELED,
      'incomplete': SubscriptionStatus.INCOMPLETE,
      'incomplete_expired': SubscriptionStatus.INCOMPLETE_EXPIRED,
      'paused': SubscriptionStatus.PAUSED
    };
    return statusMap[stripeStatus] ?? SubscriptionStatus.ACTIVE;
  }
}
```

### Component 3: Invoice Management & Payment Processing

```typescript
// Invoice management
interface Invoice {
  id: string;
  stripeInvoiceId: string;
  organizationId: string;
  subscriptionId?: string;
  number: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  lineItems: InvoiceLineItem[];
  periodStart: Date;
  periodEnd: Date;
  dueDate?: Date;
  paidAt?: Date;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

enum InvoiceStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PAID = 'paid',
  VOID = 'void',
  UNCOLLECTIBLE = 'uncollectible'
}

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  period: {
    start: Date;
    end: Date;
  };
  proration: boolean;
  metadata: Record<string, string>;
}

class InvoiceService {
  constructor(
    private stripe: Stripe,
    private invoiceRepository: InvoiceRepository,
    private pdfGenerator: PdfGenerator,
    private emailService: EmailService,
    private taxEngine: TaxEngine
  ) {}

  async syncInvoiceFromStripe(stripeInvoiceId: string): Promise<Invoice> {
    const stripeInvoice = await this.stripe.invoices.retrieve(stripeInvoiceId, {
      expand: ['lines.data', 'customer']
    });

    const invoice = await this.invoiceRepository.upsert({
      stripeInvoiceId: stripeInvoice.id,
      organizationId: stripeInvoice.metadata?.organizationId ?? '',
      subscriptionId: stripeInvoice.subscription as string,
      number: stripeInvoice.number ?? '',
      status: this.mapInvoiceStatus(stripeInvoice.status ?? 'draft'),
      currency: stripeInvoice.currency,
      subtotal: stripeInvoice.subtotal,
      tax: stripeInvoice.tax ?? 0,
      total: stripeInvoice.total,
      amountPaid: stripeInvoice.amount_paid,
      amountDue: stripeInvoice.amount_due,
      lineItems: this.mapLineItems(stripeInvoice.lines.data),
      periodStart: new Date(stripeInvoice.period_start * 1000),
      periodEnd: new Date(stripeInvoice.period_end * 1000),
      dueDate: stripeInvoice.due_date
        ? new Date(stripeInvoice.due_date * 1000)
        : undefined,
      paidAt: stripeInvoice.status_transitions?.paid_at
        ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
        : undefined,
      hostedInvoiceUrl: stripeInvoice.hosted_invoice_url ?? undefined,
      invoicePdf: stripeInvoice.invoice_pdf ?? undefined,
      metadata: stripeInvoice.metadata ?? {}
    });

    return invoice;
  }

  async createOneOffInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const stripeCustomerId = await this.getStripeCustomerId(input.organizationId);

    // Create invoice items first
    for (const item of input.items) {
      await this.stripe.invoiceItems.create({
        customer: stripeCustomerId,
        currency: input.currency,
        amount: item.amount,
        description: item.description,
        metadata: item.metadata
      });
    }

    // Create and finalize invoice
    const stripeInvoice = await this.stripe.invoices.create({
      customer: stripeCustomerId,
      auto_advance: input.autoFinalize ?? true,
      collection_method: input.collectionMethod ?? 'charge_automatically',
      metadata: {
        organizationId: input.organizationId,
        ...input.metadata
      }
    });

    if (input.autoFinalize) {
      await this.stripe.invoices.finalizeInvoice(stripeInvoice.id);
    }

    return this.syncInvoiceFromStripe(stripeInvoice.id);
  }

  async generateCustomPdf(invoiceId: string, template?: string): Promise<Buffer> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const organization = await this.organizationService.getById(invoice.organizationId);

    const pdfData = {
      invoice,
      organization,
      template: template ?? 'default',
      generatedAt: new Date()
    };

    return this.pdfGenerator.generate('invoice', pdfData);
  }

  async sendPaymentReminder(invoiceId: string): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    if (invoice.status !== InvoiceStatus.OPEN) {
      throw new ValidationError('Can only send reminders for open invoices');
    }

    await this.emailService.send({
      template: 'payment-reminder',
      to: await this.getBillingContacts(invoice.organizationId),
      data: {
        invoiceNumber: invoice.number,
        amountDue: this.formatCurrency(invoice.amountDue, invoice.currency),
        dueDate: invoice.dueDate,
        paymentUrl: invoice.hostedInvoiceUrl
      }
    });

    await this.invoiceRepository.update(invoiceId, {
      metadata: {
        ...invoice.metadata,
        lastReminderSent: new Date().toISOString()
      }
    });
  }

  async applyCredit(invoiceId: string, amount: number, reason: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    // Create a credit note in Stripe
    await this.stripe.creditNotes.create({
      invoice: invoice.stripeInvoiceId,
      amount,
      reason: 'order_change',
      memo: reason
    });

    return this.syncInvoiceFromStripe(invoice.stripeInvoiceId);
  }

  async voidInvoice(invoiceId: string, reason: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    await this.stripe.invoices.voidInvoice(invoice.stripeInvoiceId);

    return this.invoiceRepository.update(invoiceId, {
      status: InvoiceStatus.VOID,
      metadata: {
        ...invoice.metadata,
        voidReason: reason,
        voidedAt: new Date().toISOString()
      }
    });
  }

  private mapInvoiceStatus(stripeStatus: string): InvoiceStatus {
    const statusMap: Record<string, InvoiceStatus> = {
      'draft': InvoiceStatus.DRAFT,
      'open': InvoiceStatus.OPEN,
      'paid': InvoiceStatus.PAID,
      'void': InvoiceStatus.VOID,
      'uncollectible': InvoiceStatus.UNCOLLECTIBLE
    };
    return statusMap[stripeStatus] ?? InvoiceStatus.OPEN;
  }

  private mapLineItems(items: Stripe.InvoiceLineItem[]): InvoiceLineItem[] {
    return items.map(item => ({
      id: item.id,
      description: item.description ?? '',
      quantity: item.quantity ?? 1,
      unitAmount: item.unit_amount_excluding_tax
        ? parseInt(item.unit_amount_excluding_tax)
        : item.amount,
      amount: item.amount,
      period: {
        start: new Date(item.period.start * 1000),
        end: new Date(item.period.end * 1000)
      },
      proration: item.proration,
      metadata: item.metadata ?? {}
    }));
  }
}
```

### Component 4: Stripe Webhook Processing

```typescript
// Webhook handler with idempotency
interface WebhookEvent {
  id: string;
  stripeEventId: string;
  type: string;
  data: any;
  processedAt?: Date;
  error?: string;
  retryCount: number;
  createdAt: Date;
}

class StripeWebhookHandler {
  constructor(
    private stripe: Stripe,
    private eventRepository: WebhookEventRepository,
    private subscriptionService: SubscriptionService,
    private invoiceService: InvoiceService,
    private paymentService: PaymentService,
    private eventBus: EventBus,
    private alertService: AlertService
  ) {}

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    // Verify webhook signature
    let stripeEvent: Stripe.Event;
    try {
      stripeEvent = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );
    } catch (err) {
      throw new UnauthorizedError('Invalid webhook signature');
    }

    // Check for idempotency
    const existingEvent = await this.eventRepository.findByStripeId(stripeEvent.id);
    if (existingEvent?.processedAt) {
      return; // Already processed
    }

    // Store event for tracking
    const event = await this.eventRepository.upsert({
      stripeEventId: stripeEvent.id,
      type: stripeEvent.type,
      data: stripeEvent.data,
      retryCount: existingEvent?.retryCount ?? 0,
      createdAt: new Date(stripeEvent.created * 1000)
    });

    try {
      await this.processEvent(stripeEvent);

      await this.eventRepository.update(event.id, {
        processedAt: new Date()
      });
    } catch (error) {
      await this.eventRepository.update(event.id, {
        error: error.message,
        retryCount: event.retryCount + 1
      });

      // Alert on repeated failures
      if (event.retryCount >= 3) {
        await this.alertService.critical('webhook_processing_failed', {
          eventId: stripeEvent.id,
          eventType: stripeEvent.type,
          error: error.message
        });
      }

      throw error;
    }
  }

  private async processEvent(event: Stripe.Event): Promise<void> {
    const handlers: Record<string, (data: any) => Promise<void>> = {
      // Subscription events
      'customer.subscription.created': this.handleSubscriptionCreated.bind(this),
      'customer.subscription.updated': this.handleSubscriptionUpdated.bind(this),
      'customer.subscription.deleted': this.handleSubscriptionDeleted.bind(this),
      'customer.subscription.trial_will_end': this.handleTrialEnding.bind(this),

      // Invoice events
      'invoice.created': this.handleInvoiceCreated.bind(this),
      'invoice.finalized': this.handleInvoiceFinalized.bind(this),
      'invoice.paid': this.handleInvoicePaid.bind(this),
      'invoice.payment_failed': this.handlePaymentFailed.bind(this),
      'invoice.upcoming': this.handleUpcomingInvoice.bind(this),

      // Payment events
      'payment_intent.succeeded': this.handlePaymentSucceeded.bind(this),
      'payment_intent.payment_failed': this.handlePaymentIntentFailed.bind(this),

      // Customer events
      'customer.updated': this.handleCustomerUpdated.bind(this),
      'customer.source.expiring': this.handleCardExpiring.bind(this)
    };

    const handler = handlers[event.type];
    if (handler) {
      await handler(event.data.object);
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const localSub = await this.subscriptionService.findByStripeId(subscription.id);
    if (!localSub) return;

    const previousStatus = localSub.status;
    const newStatus = this.subscriptionService.mapStripeStatus(subscription.status);

    await this.subscriptionService.syncFromStripe(subscription);

    // Emit status change events
    if (previousStatus !== newStatus) {
      await this.eventBus.publish({
        type: `subscription.status_changed`,
        data: {
          subscriptionId: localSub.id,
          previousStatus,
          newStatus
        }
      });

      // Handle specific transitions
      if (newStatus === SubscriptionStatus.PAST_DUE) {
        await this.handlePastDue(localSub);
      } else if (newStatus === SubscriptionStatus.ACTIVE && previousStatus === SubscriptionStatus.PAST_DUE) {
        await this.handlePaymentRecovered(localSub);
      }
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    await this.invoiceService.syncInvoiceFromStripe(invoice.id);

    const organizationId = invoice.metadata?.organizationId;
    if (!organizationId) return;

    const attempt = invoice.attempt_count ?? 1;

    // Send appropriate notification based on attempt
    if (attempt === 1) {
      await this.sendPaymentFailedNotification(organizationId, invoice, 'first_attempt');
    } else if (attempt === 2) {
      await this.sendPaymentFailedNotification(organizationId, invoice, 'second_attempt');
    } else if (attempt >= 3) {
      await this.sendPaymentFailedNotification(organizationId, invoice, 'final_attempt');
      // Consider downgrading or suspending
      await this.handleRepeatedPaymentFailure(organizationId, invoice);
    }
  }

  private async handleTrialEnding(subscription: Stripe.Subscription): Promise<void> {
    const organizationId = subscription.metadata?.organizationId;
    if (!organizationId) return;

    // Calculate days until trial ends
    const trialEnd = new Date(subscription.trial_end! * 1000);
    const daysRemaining = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    await this.eventBus.publish({
      type: 'subscription.trial_ending',
      data: {
        organizationId,
        subscriptionId: subscription.metadata?.subscriptionId,
        trialEnd,
        daysRemaining
      }
    });

    // Send trial ending notification
    await this.emailService.send({
      template: 'trial-ending',
      to: await this.getBillingContacts(organizationId),
      data: {
        daysRemaining,
        trialEnd: trialEnd.toLocaleDateString(),
        upgradeUrl: `${config.appUrl}/billing/upgrade`
      }
    });
  }

  private async handlePastDue(subscription: Subscription): Promise<void> {
    // Notify organization admins
    await this.emailService.send({
      template: 'subscription-past-due',
      to: await this.getBillingContacts(subscription.organizationId),
      data: {
        updatePaymentUrl: `${config.appUrl}/billing/payment-methods`
      }
    });

    // Apply soft restrictions after grace period
    setTimeout(async () => {
      const currentSub = await this.subscriptionService.findById(subscription.id);
      if (currentSub?.status === SubscriptionStatus.PAST_DUE) {
        await this.applyPastDueRestrictions(currentSub.organizationId);
      }
    }, config.billing.pastDueGracePeriodMs);
  }
}
```

### Component 5: Enterprise Billing & Custom Contracts

```typescript
// Enterprise contract management
interface EnterpriseContract {
  id: string;
  organizationId: string;
  name: string;
  status: ContractStatus;
  startDate: Date;
  endDate: Date;
  totalValue: number;
  currency: string;
  billingCycle: BillingInterval;
  paymentTerms: PaymentTerms;
  commitments: ContractCommitment[];
  discounts: ContractDiscount[];
  customPricing: CustomPricing[];
  autoRenew: boolean;
  renewalTerms?: string;
  signedAt?: Date;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

enum ContractStatus {
  DRAFT = 'draft',
  PENDING_SIGNATURE = 'pending_signature',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TERMINATED = 'terminated'
}

interface ContractCommitment {
  id: string;
  type: 'minimum_spend' | 'minimum_users' | 'minimum_usage';
  value: number;
  period: 'monthly' | 'quarterly' | 'annual' | 'contract_term';
  shortfallHandling: 'invoice' | 'rollover' | 'waive';
}

interface ContractDiscount {
  id: string;
  type: 'percentage' | 'fixed' | 'volume';
  value: number;
  appliesTo: 'all' | 'specific_products';
  productIds?: string[];
  conditions?: DiscountCondition[];
}

interface CustomPricing {
  productId: string;
  customPrice: number;
  effectiveDate: Date;
  expirationDate?: Date;
}

class EnterpriseContractService {
  constructor(
    private contractRepository: ContractRepository,
    private subscriptionService: SubscriptionService,
    private invoiceService: InvoiceService,
    private stripe: Stripe,
    private docuSign: DocuSignClient
  ) {}

  async createContract(input: CreateContractInput): Promise<EnterpriseContract> {
    // Validate contract terms
    this.validateContractTerms(input);

    const contract = await this.contractRepository.create({
      ...input,
      status: ContractStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Generate contract document
    await this.generateContractDocument(contract);

    return contract;
  }

  async activateContract(contractId: string): Promise<EnterpriseContract> {
    const contract = await this.contractRepository.findById(contractId);
    if (!contract) throw new NotFoundError('Contract not found');

    if (contract.status !== ContractStatus.PENDING_SIGNATURE) {
      throw new ValidationError('Contract must be signed before activation');
    }

    // Create custom Stripe price for contract
    const stripePrice = await this.createContractPrice(contract);

    // Create or update subscription with contract terms
    const subscription = await this.subscriptionService.createContractSubscription({
      organizationId: contract.organizationId,
      contractId: contract.id,
      stripePriceId: stripePrice.id,
      billingInterval: contract.billingCycle,
      discounts: contract.discounts
    });

    // Activate contract
    const activatedContract = await this.contractRepository.update(contractId, {
      status: ContractStatus.ACTIVE,
      metadata: {
        ...contract.metadata,
        subscriptionId: subscription.id,
        activatedAt: new Date().toISOString()
      },
      updatedAt: new Date()
    });

    return activatedContract;
  }

  async calculateCommitmentStatus(contractId: string): Promise<CommitmentStatus[]> {
    const contract = await this.contractRepository.findById(contractId);
    if (!contract) throw new NotFoundError('Contract not found');

    const statuses: CommitmentStatus[] = [];

    for (const commitment of contract.commitments) {
      const usage = await this.getCommitmentUsage(contract, commitment);
      const remaining = commitment.value - usage.current;
      const percentComplete = (usage.current / commitment.value) * 100;

      statuses.push({
        commitmentId: commitment.id,
        type: commitment.type,
        committed: commitment.value,
        current: usage.current,
        remaining: Math.max(0, remaining),
        percentComplete,
        onTrack: this.isOnTrackForCommitment(contract, commitment, usage),
        projectedShortfall: this.calculateProjectedShortfall(contract, commitment, usage)
      });
    }

    return statuses;
  }

  async processContractRenewal(contractId: string): Promise<EnterpriseContract | null> {
    const contract = await this.contractRepository.findById(contractId);
    if (!contract || !contract.autoRenew) return null;

    // Check for commitment shortfalls
    const commitmentStatuses = await this.calculateCommitmentStatus(contractId);
    const shortfalls = commitmentStatuses.filter(s => s.remaining > 0);

    // Handle shortfalls before renewal
    for (const shortfall of shortfalls) {
      const commitment = contract.commitments.find(c => c.id === shortfall.commitmentId)!;
      await this.handleCommitmentShortfall(contract, commitment, shortfall);
    }

    // Create renewal contract
    const renewalContract = await this.createContract({
      organizationId: contract.organizationId,
      name: `${contract.name} (Renewal)`,
      startDate: contract.endDate,
      endDate: this.calculateRenewalEndDate(contract),
      totalValue: contract.totalValue,
      currency: contract.currency,
      billingCycle: contract.billingCycle,
      paymentTerms: contract.paymentTerms,
      commitments: contract.commitments,
      discounts: contract.discounts,
      customPricing: contract.customPricing,
      autoRenew: contract.autoRenew,
      metadata: {
        previousContractId: contract.id,
        renewalNumber: String(parseInt(contract.metadata?.renewalNumber ?? '0') + 1)
      }
    });

    // Expire original contract
    await this.contractRepository.update(contractId, {
      status: ContractStatus.EXPIRED,
      metadata: {
        ...contract.metadata,
        renewedToContractId: renewalContract.id
      }
    });

    return renewalContract;
  }

  private async handleCommitmentShortfall(
    contract: EnterpriseContract,
    commitment: ContractCommitment,
    shortfall: CommitmentStatus
  ): Promise<void> {
    switch (commitment.shortfallHandling) {
      case 'invoice':
        // Invoice for the shortfall amount
        await this.invoiceService.createOneOffInvoice({
          organizationId: contract.organizationId,
          currency: contract.currency,
          items: [{
            description: `Commitment shortfall - ${commitment.type}`,
            amount: this.calculateShortfallAmount(commitment, shortfall)
          }],
          metadata: {
            contractId: contract.id,
            commitmentId: commitment.id,
            type: 'commitment_shortfall'
          }
        });
        break;

      case 'rollover':
        // Roll over shortfall to next period/contract
        // Store for next period processing
        break;

      case 'waive':
        // Log and waive the shortfall
        await this.auditLogger.log({
          action: 'commitment.shortfall_waived',
          resourceType: 'contract',
          resourceId: contract.id,
          details: { commitment, shortfall }
        });
        break;
    }
  }

  private async createContractPrice(contract: EnterpriseContract): Promise<Stripe.Price> {
    // Calculate contract-specific pricing
    const baseAmount = contract.totalValue / this.getPeriodsInContract(contract);

    // Apply discounts
    let finalAmount = baseAmount;
    for (const discount of contract.discounts) {
      if (discount.type === 'percentage') {
        finalAmount *= (1 - discount.value / 100);
      } else if (discount.type === 'fixed') {
        finalAmount -= discount.value;
      }
    }

    return this.stripe.prices.create({
      currency: contract.currency,
      unit_amount: Math.round(finalAmount),
      recurring: {
        interval: contract.billingCycle,
        interval_count: 1
      },
      product_data: {
        name: `Enterprise Contract - ${contract.name}`,
        metadata: {
          contractId: contract.id,
          type: 'enterprise_contract'
        }
      },
      metadata: {
        contractId: contract.id
      }
    });
  }
}
```

### Component 6: Revenue Analytics & Reporting

```typescript
// Revenue metrics and reporting
interface RevenueMetrics {
  period: {
    start: Date;
    end: Date;
  };
  mrr: number;
  arr: number;
  netNewMrr: number;
  expansionMrr: number;
  contractionMrr: number;
  churnedMrr: number;
  reactivatedMrr: number;
  grossRevenue: number;
  netRevenue: number;
  arpu: number;
  totalCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
  churnRate: number;
  ltv: number;
  cac?: number;
}

class RevenueAnalyticsService {
  constructor(
    private subscriptionRepository: SubscriptionRepository,
    private invoiceRepository: InvoiceRepository,
    private metricsRepository: MetricsRepository
  ) {}

  async calculateMRR(asOfDate: Date = new Date()): Promise<MRRBreakdown> {
    const activeSubscriptions = await this.subscriptionRepository.findActive(asOfDate);

    let totalMrr = 0;
    const breakdown: Record<PlanTier, number> = {
      [PlanTier.FREE]: 0,
      [PlanTier.STARTER]: 0,
      [PlanTier.PROFESSIONAL]: 0,
      [PlanTier.TEAM]: 0,
      [PlanTier.ENTERPRISE]: 0,
      [PlanTier.CUSTOM]: 0
    };

    for (const subscription of activeSubscriptions) {
      const monthlyValue = this.normalizeToMonthly(subscription);
      totalMrr += monthlyValue;
      breakdown[subscription.plan.tier] += monthlyValue;
    }

    return {
      total: totalMrr,
      byTier: breakdown,
      subscriptionCount: activeSubscriptions.length
    };
  }

  async calculateMRRMovement(
    periodStart: Date,
    periodEnd: Date
  ): Promise<MRRMovement> {
    const startMrr = await this.calculateMRR(periodStart);
    const endMrr = await this.calculateMRR(periodEnd);

    // Get subscription changes in period
    const newSubscriptions = await this.subscriptionRepository.findCreatedBetween(
      periodStart, periodEnd
    );
    const canceledSubscriptions = await this.subscriptionRepository.findCanceledBetween(
      periodStart, periodEnd
    );
    const upgrades = await this.subscriptionRepository.findUpgradesBetween(
      periodStart, periodEnd
    );
    const downgrades = await this.subscriptionRepository.findDowngradesBetween(
      periodStart, periodEnd
    );
    const reactivations = await this.subscriptionRepository.findReactivationsBetween(
      periodStart, periodEnd
    );

    return {
      startingMrr: startMrr.total,
      endingMrr: endMrr.total,
      netChange: endMrr.total - startMrr.total,
      newBusiness: this.sumMrr(newSubscriptions),
      expansion: this.sumMrrDelta(upgrades),
      contraction: Math.abs(this.sumMrrDelta(downgrades)),
      churn: this.sumMrr(canceledSubscriptions),
      reactivation: this.sumMrr(reactivations)
    };
  }

  async generateRevenueReport(
    period: { start: Date; end: Date },
    options: ReportOptions = {}
  ): Promise<RevenueReport> {
    const [
      mrrMovement,
      invoices,
      subscriptionMetrics,
      cohortAnalysis
    ] = await Promise.all([
      this.calculateMRRMovement(period.start, period.end),
      this.invoiceRepository.findPaidBetween(period.start, period.end),
      this.calculateSubscriptionMetrics(period),
      options.includeCohorts ? this.analyzeCohorts(period) : null
    ]);

    const grossRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const refunds = await this.calculateRefunds(period);

    return {
      period,
      generatedAt: new Date(),
      mrr: {
        starting: mrrMovement.startingMrr,
        ending: mrrMovement.endingMrr,
        movement: mrrMovement
      },
      arr: mrrMovement.endingMrr * 12,
      revenue: {
        gross: grossRevenue,
        refunds,
        net: grossRevenue - refunds
      },
      subscriptions: subscriptionMetrics,
      customers: {
        total: subscriptionMetrics.active,
        new: subscriptionMetrics.newInPeriod,
        churned: subscriptionMetrics.churnedInPeriod,
        churnRate: subscriptionMetrics.churnRate
      },
      arpu: mrrMovement.endingMrr / Math.max(subscriptionMetrics.active, 1),
      cohorts: cohortAnalysis
    };
  }

  async calculateChurnRate(period: { start: Date; end: Date }): Promise<ChurnMetrics> {
    const startingCustomers = await this.subscriptionRepository.countActiveAt(period.start);
    const churnedCustomers = await this.subscriptionRepository.countChurnedBetween(
      period.start, period.end
    );

    const startingMrr = (await this.calculateMRR(period.start)).total;
    const churnedMrr = await this.calculateChurnedMrr(period.start, period.end);

    return {
      customerChurnRate: (churnedCustomers / Math.max(startingCustomers, 1)) * 100,
      revenueChurnRate: (churnedMrr / Math.max(startingMrr, 1)) * 100,
      churnedCustomers,
      churnedMrr
    };
  }

  async analyzeCohorts(period: { start: Date; end: Date }): Promise<CohortAnalysis[]> {
    // Get monthly cohorts for the last 12 months
    const cohorts: CohortAnalysis[] = [];
    const cohortStart = new Date(period.start);
    cohortStart.setMonth(cohortStart.getMonth() - 11);

    for (let i = 0; i < 12; i++) {
      const cohortMonth = new Date(cohortStart);
      cohortMonth.setMonth(cohortMonth.getMonth() + i);

      const cohortEnd = new Date(cohortMonth);
      cohortEnd.setMonth(cohortEnd.getMonth() + 1);

      const cohortSubscriptions = await this.subscriptionRepository.findCreatedBetween(
        cohortMonth, cohortEnd
      );

      const retentionByMonth: number[] = [];
      for (let month = 0; month <= 11 - i; month++) {
        const checkDate = new Date(cohortMonth);
        checkDate.setMonth(checkDate.getMonth() + month + 1);

        const stillActive = cohortSubscriptions.filter(sub =>
          sub.status === SubscriptionStatus.ACTIVE ||
          (sub.canceledAt && sub.canceledAt > checkDate)
        ).length;

        retentionByMonth.push(
          (stillActive / Math.max(cohortSubscriptions.length, 1)) * 100
        );
      }

      cohorts.push({
        cohortMonth: cohortMonth.toISOString().slice(0, 7),
        initialCustomers: cohortSubscriptions.length,
        initialMrr: this.sumMrr(cohortSubscriptions),
        retentionByMonth,
        currentRetention: retentionByMonth[retentionByMonth.length - 1] ?? 100
      });
    }

    return cohorts;
  }

  private normalizeToMonthly(subscription: Subscription): number {
    const baseAmount = subscription.items[0].quantity * subscription.price.amount;

    switch (subscription.price.interval) {
      case BillingInterval.MONTHLY:
        return baseAmount;
      case BillingInterval.QUARTERLY:
        return baseAmount / 3;
      case BillingInterval.ANNUAL:
        return baseAmount / 12;
      default:
        return baseAmount;
    }
  }
}
```

## Consequences

### Positive
- **Stripe-Native**: Leverages Stripe's battle-tested billing infrastructure
- **PCI Compliance**: No raw card data handling, Stripe manages payment security
- **Flexible Pricing**: Supports flat-rate, tiered, metered, and custom pricing
- **Enterprise Ready**: Full support for custom contracts and commitments
- **Revenue Visibility**: Comprehensive analytics and reporting
- **Reliable Webhooks**: Idempotent processing with failure recovery

### Negative
- **Stripe Dependency**: Tightly coupled to Stripe's API and pricing model
- **Sync Complexity**: Must keep local state synchronized with Stripe
- **Enterprise Overhead**: Custom contract management adds complexity
- **Webhook Reliability**: Dependent on Stripe webhook delivery

### Trade-offs
- **Local vs Stripe State**: Store minimal state locally, Stripe is source of truth
- **Immediate vs Delayed**: Upgrades apply immediately, downgrades at period end
- **Automation vs Control**: Auto-dunning for self-serve, manual for enterprise

## Implementation Plan

### Phase 1: Core Billing (Weeks 1-4)
- Stripe integration setup
- Plan and pricing management
- Basic subscription lifecycle

### Phase 2: Invoicing (Weeks 5-6)
- Invoice synchronization
- PDF generation
- Payment reminders

### Phase 3: Webhooks (Weeks 7-8)
- Webhook handler implementation
- Event processing
- Failure recovery

### Phase 4: Enterprise (Weeks 9-12)
- Contract management
- Custom pricing
- Commitment tracking

### Phase 5: Analytics (Weeks 13-14)
- Revenue metrics
- Churn analysis
- Cohort reporting

## References

- ADR-058: Authentication & Authorization Architecture
- ADR-059: Multi-Organization Hierarchy & Workspace Management
- ADR-060: Usage Tracking & Quota Enforcement
- Stripe Billing Documentation
- ASC 606 Revenue Recognition Standards
- PCI DSS Compliance Requirements
