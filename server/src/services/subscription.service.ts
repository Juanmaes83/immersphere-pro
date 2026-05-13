import { prisma } from '../index.js';
import Stripe from 'stripe';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
type Plan = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

interface CheckoutSessionInput {
  tenantId: string;
  userId: string;
  plan: string;
}

interface CustomerPortalInput {
  tenantId: string;
  userId: string;
}

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  const key = env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith('sk_')) {
    const hint = key ? `valor actual empieza por "${key.slice(0, 10)}..." (debe empezar por sk_test_ o sk_live_)` : 'STRIPE_SECRET_KEY está vacía';
    throw new AppError(503, `Stripe no configurado: ${hint}.`);
  }

  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }

  return stripeClient;
}

function normalizePlan(value?: string): Plan {
  const normalized = (value || 'STARTER').toUpperCase();
  const allowed: Plan[] = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

  return allowed.includes(normalized as Plan) ? (normalized as Plan) : 'STARTER';
}

function normalizeSubscriptionStatus(value?: string): SubscriptionStatus {
  const normalized = (value || 'TRIAL').toUpperCase();
  const allowed: SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'];

  return allowed.includes(normalized as SubscriptionStatus)
    ? (normalized as SubscriptionStatus)
    : 'TRIAL';
}

function mapStripeStatus(status: string): SubscriptionStatus {
  if (status === 'trialing') return 'TRIAL';
  if (status === 'active') return 'ACTIVE';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'PAST_DUE';
  if (status === 'canceled') return 'CANCELED';
  if (status === 'incomplete_expired') return 'EXPIRED';

  return 'PAST_DUE';
}

function getPriceIdForPlan(plan: Plan): string | null {
  if (plan === 'STARTER') {
    return null;
  }

  if (plan === 'PROFESSIONAL') {
    return env.STRIPE_PRICE_PROFESSIONAL || null;
  }

  if (plan === 'ENTERPRISE') {
    return env.STRIPE_PRICE_ENTERPRISE || null;
  }

  return null;
}

function getPlanFromPriceId(priceId: string | undefined): Plan {
  if (priceId && priceId === env.STRIPE_PRICE_ENTERPRISE) {
    return 'ENTERPRISE';
  }

  if (priceId && priceId === env.STRIPE_PRICE_PROFESSIONAL) {
    return 'PROFESSIONAL';
  }

  return 'STARTER';
}

function extractStripeId(value: string | { id?: string } | null | undefined): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return typeof value.id === 'string' ? value.id : '';
}

async function getUserWithTenant(tenantId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      tenantId
    },
    include: {
      tenant: {
        include: {
          subscription: true
        }
      }
    }
  });

  if (!user) {
    throw new Error('Usuario no encontrado para este tenant.');
  }

  return user;
}

async function ensureStripeCustomer(tenantId: string, userId: string): Promise<string> {
  const stripe = getStripe();
  const user = await getUserWithTenant(tenantId, userId);
  const existingCustomerId = user.tenant.subscription?.stripeCustomerId;

  if (existingCustomerId) {
    return existingCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.tenant.name,
    metadata: {
      tenantId,
      userId
    }
  });

  await prisma.subscription.upsert({
    where: { tenantId },
    create: {
      tenantId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: '',
      plan: user.tenant.plan || 'STARTER',
      status: 'TRIAL'
    },
    update: {
      stripeCustomerId: customer.id
    }
  });

  return customer.id;
}

async function applyTenantPlan(input: {
  tenantId: string;
  plan: Plan;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}) {
  const tenant = await prisma.$transaction(async (tx: any) => {
    await tx.tenant.update({
      where: { id: input.tenantId },
      data: {
        plan: input.plan
      }
    });

    await tx.subscription.upsert({
      where: { tenantId: input.tenantId },
      create: {
        tenantId: input.tenantId,
        stripeCustomerId: input.stripeCustomerId ?? '',
        stripeSubscriptionId: input.stripeSubscriptionId ?? '',
        plan: input.plan,
        status: input.status
      },
      update: {
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        plan: input.plan,
        status: input.status
      }
    });

    return tx.tenant.findUnique({
      where: { id: input.tenantId },
      include: {
        subscription: true
      }
    });
  });

  if (!tenant) {
    throw new Error('Tenant no encontrado al actualizar suscripción.');
  }

  return tenant;
}

export async function getCurrentSubscription(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: true
    }
  });

  if (!tenant) {
    throw new Error('Tenant no encontrado.');
  }

  return {
    tenantId: tenant.id,
    plan: tenant.plan,
    subscription: tenant.subscription
      ? {
          id: tenant.subscription.id,
          stripeCustomerId: tenant.subscription.stripeCustomerId,
          stripeSubscriptionId: tenant.subscription.stripeSubscriptionId,
          plan: tenant.subscription.plan,
          status: tenant.subscription.status,
          createdAt: tenant.subscription.createdAt,
          updatedAt: tenant.subscription.updatedAt
        }
      : null
  };
}

export async function createCheckoutSession(input: CheckoutSessionInput) {
  const plan = normalizePlan(input.plan);

  if (plan === 'STARTER') {
    const tenant = await applyTenantPlan({
      tenantId: input.tenantId,
      plan: 'STARTER',
      status: 'TRIAL'
    });

    return {
      mode: 'internal',
      plan: tenant.plan,
      url: null
    };
  }

  const priceId = getPriceIdForPlan(plan);

  if (!priceId) {
    throw new AppError(503, `Stripe no configurado: falta STRIPE_PRICE_${plan} en las variables de entorno.`);
  }

  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(input.tenantId, input.userId);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    success_url: `${env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/billing/cancelled`,
    metadata: {
      tenantId: input.tenantId,
      userId: input.userId,
      plan
    },
    subscription_data: {
      metadata: {
        tenantId: input.tenantId,
        userId: input.userId,
        plan
      }
    }
  });

  if (!session.url) {
    throw new Error('Stripe no devolvió URL de Checkout.');
  }

  return {
    mode: 'stripe',
    plan,
    url: session.url
  };
}

export async function createCustomerPortalSession(input: CustomerPortalInput) {
  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(input.tenantId, input.userId);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.APP_URL}/dashboard/billing`
  });

  return {
    url: session.url
  };
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const tenantId = session.metadata?.tenantId;
  const plan = normalizePlan(session.metadata?.plan);
  const stripeCustomerId = extractStripeId(session.customer);
  const stripeSubscriptionId = extractStripeId(session.subscription);

  if (!tenantId) {
    return {
      handled: false,
      reason: 'checkout.session.completed sin tenantId en metadata'
    };
  }

  await applyTenantPlan({
    tenantId,
    plan,
    status: 'ACTIVE',
    stripeCustomerId,
    stripeSubscriptionId
  });

  return {
    handled: true,
    type: 'checkout.session.completed',
    tenantId,
    plan
  };
}

async function handleCustomerSubscriptionUpdated(subscription: Stripe.Subscription) {
  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId = extractStripeId(subscription.customer);
  const priceId = subscription.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId);
  const status = mapStripeStatus(subscription.status);

  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId },
        { stripeCustomerId }
      ]
    }
  });

  const tenantId = existingSubscription?.tenantId ?? subscription.metadata?.tenantId;

  if (!tenantId) {
    return {
      handled: false,
      reason: 'customer.subscription.updated sin tenant vinculado'
    };
  }

  await applyTenantPlan({
    tenantId,
    plan,
    status,
    stripeCustomerId,
    stripeSubscriptionId
  });

  return {
    handled: true,
    type: 'customer.subscription.updated',
    tenantId,
    plan,
    status
  };
}

async function handleCustomerSubscriptionDeleted(subscription: Stripe.Subscription) {
  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId = extractStripeId(subscription.customer);

  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId },
        { stripeCustomerId }
      ]
    }
  });

  const tenantId = existingSubscription?.tenantId ?? subscription.metadata?.tenantId;

  if (!tenantId) {
    return {
      handled: false,
      reason: 'customer.subscription.deleted sin tenant vinculado'
    };
  }

  await applyTenantPlan({
    tenantId,
    plan: 'STARTER',
    status: 'CANCELED',
    stripeCustomerId,
    stripeSubscriptionId
  });

  return {
    handled: true,
    type: 'customer.subscription.deleted',
    tenantId,
    plan: 'STARTER',
    status: 'CANCELED'
  };
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError(503, 'Stripe no configurado: falta STRIPE_WEBHOOK_SECRET en las variables de entorno.');
  }

  const stripe = getStripe();

  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );

  if (event.type === 'checkout.session.completed') {
    return handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
  }

  if (event.type === 'customer.subscription.updated') {
    return handleCustomerSubscriptionUpdated(event.data.object as Stripe.Subscription);
  }

  if (event.type === 'customer.subscription.deleted') {
    return handleCustomerSubscriptionDeleted(event.data.object as Stripe.Subscription);
  }

  return {
    handled: false,
    type: event.type
  };
}

