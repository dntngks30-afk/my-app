# Stripe 설정 가이드

## 1. 패키지 설치

```bash
npm install stripe
```

## 2. 환경 변수 설정

`.env.local` 파일에 다음 환경 변수를 추가하세요:

```env
# Stripe Secret Key (서버 사이드)
STRIPE_SECRET_KEY=sk_test_...

# Stripe Publishable Key (클라이언트 사이드)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Webhook Secret (Webhook 엔드포인트용)
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 3. Stripe 계정 설정

1. [Stripe Dashboard](https://dashboard.stripe.com/)에 로그인
2. **Developers** → **API keys**에서 키 확인
   - 테스트 모드: `sk_test_...`, `pk_test_...`
   - 프로덕션 모드: `sk_live_...`, `pk_live_...`

## 4. Webhook 엔드포인트 설정

1. Stripe Dashboard → **Developers** → **Webhooks**
2. **Add endpoint** 클릭
3. 엔드포인트 URL 입력: `https://yourdomain.com/api/stripe/webhook`
4. 이벤트 선택:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. **Signing secret** 복사하여 `STRIPE_WEBHOOK_SECRET`에 설정

## 5. Products 및 Prices 생성

Stripe Dashboard에서 Products와 Prices를 생성하고, `plans` 테이블에 `stripe_price_id`와 `stripe_product_id`를 업데이트하세요.

### 예시: Premium 플랜 설정

1. **Products** → **Add product**
   - Name: `Premium`
   - Description: `Premium 플랜`
2. **Pricing** 설정
   - Price: `₩99,000`
   - Billing period: `Monthly`
   - Price ID 복사 (예: `price_xxx`)
3. `plans` 테이블 업데이트:
   ```sql
   UPDATE plans
   SET stripe_product_id = 'prod_xxx',
       stripe_price_id = 'price_xxx'
   WHERE tier = 'premium';
   ```

## 6. 사용 방법

### 서버 사이드

```typescript
import { getStripeServerClient } from '@/lib/stripe';

const stripe = getStripeServerClient();
// Stripe API 사용
```

### 클라이언트 사이드

```typescript
import { loadStripe } from '@stripe/stripe-js';
import { getStripePublishableKey } from '@/lib/stripe';

const stripePromise = loadStripe(getStripePublishableKey());
```

## 7. 테스트 카드

테스트 모드에서 사용할 수 있는 카드 번호:

- 성공: `4242 4242 4242 4242`
- 실패: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

자세한 내용은 [Stripe Testing 문서](https://stripe.com/docs/testing)를 참조하세요.
