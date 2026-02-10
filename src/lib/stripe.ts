/**
 * Stripe SDK 설정 및 유틸리티 함수
 * 
 * 환경 변수:
 * - STRIPE_SECRET_KEY: Stripe Secret Key (서버 사이드)
 * - STRIPE_PUBLISHABLE_KEY: Stripe Publishable Key (클라이언트 사이드)
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 클라이언트에서 사용할 Publishable Key
 */

import Stripe from 'stripe';

// 서버 사이드 Stripe 클라이언트 (Secret Key 사용)
let stripeInstance: Stripe | null = null;

/**
 * 서버 사이드 Stripe 클라이언트 인스턴스 반환
 * 싱글톤 패턴으로 인스턴스 재사용
 */
export function getStripeServerClient(): Stripe {
  if (stripeInstance) {
    return stripeInstance;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY 환경 변수가 설정되지 않았습니다. ' +
      '.env.local 파일에 STRIPE_SECRET_KEY를 추가하세요.'
    );
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion: '2024-12-18.acacia', // 최신 API 버전 사용
    typescript: true,
  });

  return stripeInstance;
}

/**
 * 클라이언트 사이드에서 사용할 Stripe Publishable Key 반환
 */
export function getStripePublishableKey(): string {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 환경 변수가 설정되지 않았습니다. ' +
      '.env.local 파일에 NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY를 추가하세요.'
    );
  }

  return publishableKey;
}

/**
 * Stripe Webhook 시그니처 검증
 * @param payload - 요청 본문 (raw string)
 * @param signature - Stripe-Signature 헤더 값
 * @param webhookSecret - Stripe Webhook Secret
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  const stripe = getStripeServerClient();

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
    return event;
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }
    throw new Error('Webhook signature verification failed');
  }
}

/**
 * Stripe Customer 생성 또는 조회
 * @param userId - 사용자 ID
 * @param email - 사용자 이메일
 * @param metadata - 추가 메타데이터
 * @param stripeCustomerId - DB에 저장된 Stripe Customer ID (선택)
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  metadata?: Record<string, string>,
  stripeCustomerId?: string | null
): Promise<Stripe.Customer> {
  const stripe = getStripeServerClient();

  // 1. DB에 저장된 stripe_customer_id가 있으면 해당 Customer 조회
  if (stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      if (!customer.deleted) {
        // 메타데이터 업데이트 (필요한 경우)
        if (metadata && Object.keys(metadata).length > 0) {
          return await stripe.customers.update(stripeCustomerId, {
            metadata: {
              ...(customer as Stripe.Customer).metadata,
              ...metadata,
              userId,
            },
          });
        }
        return customer as Stripe.Customer;
      }
    } catch (error) {
      // Customer가 존재하지 않으면 계속 진행
      console.warn(`Stripe Customer ${stripeCustomerId} not found, creating new one`);
    }
  }

  // 2. 이메일로 기존 Customer 조회 시도
  const customers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (customers.data.length > 0) {
    const customer = customers.data[0];
    
    // 메타데이터 업데이트 (필요한 경우)
    if (metadata && Object.keys(metadata).length > 0) {
      return await stripe.customers.update(customer.id, {
        metadata: {
          ...customer.metadata,
          ...metadata,
          userId,
        },
      });
    }

    return customer;
  }

  // 3. 새 Customer 생성
  return await stripe.customers.create({
    email,
    metadata: {
      userId,
      ...metadata,
    },
  });
}

/**
 * Stripe Price ID로 Price 정보 조회
 * @param priceId - Stripe Price ID
 */
export async function getStripePrice(priceId: string): Promise<Stripe.Price> {
  const stripe = getStripeServerClient();
  return await stripe.prices.retrieve(priceId);
}

/**
 * Stripe Product ID로 Product 정보 조회
 * @param productId - Stripe Product ID
 */
export async function getStripeProduct(
  productId: string
): Promise<Stripe.Product> {
  const stripe = getStripeServerClient();
  return await stripe.products.retrieve(productId);
}

/**
 * Stripe Subscription 조회
 * @param subscriptionId - Stripe Subscription ID
 */
export async function getStripeSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripeServerClient();
  return await stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Stripe Subscription 취소
 * @param subscriptionId - Stripe Subscription ID
 * @param immediately - 즉시 취소 여부 (기본값: false, 기간 종료 시 취소)
 */
export async function cancelStripeSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<Stripe.Subscription> {
  const stripe = getStripeServerClient();

  if (immediately) {
    return await stripe.subscriptions.cancel(subscriptionId);
  } else {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
}

/**
 * Stripe Payment Intent 조회
 * @param paymentIntentId - Stripe Payment Intent ID
 */
export async function getStripePaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeServerClient();
  return await stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * 에러 타입 가드: Stripe 에러인지 확인
 */
export function isStripeError(error: unknown): error is Stripe.StripeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error
  );
}

/**
 * Stripe 에러를 사용자 친화적인 메시지로 변환
 */
export function getStripeErrorMessage(error: unknown): string {
  if (isStripeError(error)) {
    switch (error.type) {
      case 'StripeCardError':
        return '카드 결제에 실패했습니다. 카드 정보를 확인해주세요.';
      case 'StripeRateLimitError':
        return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
      case 'StripeInvalidRequestError':
        return '잘못된 요청입니다. 입력 정보를 확인해주세요.';
      case 'StripeAPIError':
        return '결제 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
      case 'StripeConnectionError':
        return '결제 서비스에 연결할 수 없습니다. 네트워크를 확인해주세요.';
      case 'StripeAuthenticationError':
        return '결제 서비스 인증에 실패했습니다.';
      default:
        return error.message || '결제 처리 중 오류가 발생했습니다.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '알 수 없는 오류가 발생했습니다.';
}
