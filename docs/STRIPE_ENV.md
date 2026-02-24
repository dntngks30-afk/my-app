# Stripe 환경 변수

서버 전용 환경 변수 (절대 `NEXT_PUBLIC_`로 노출하지 마세요.)

| 변수명 | 용도 | 예시 |
|--------|------|------|
| `STRIPE_SECRET_KEY` | Stripe API 인증 (sk_test_ / sk_live_) | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook 서명 검증 | `whsec_...` |
| `STRIPE_PRICE_MOVE_RE_7D` | 7일 심층 분석 상품 Price ID | `price_...` |

클라이언트용: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test_ / pk_live_)

**STRIPE_PRICE_MOVE_RE_7D**: Stripe Dashboard → Products → 해당 상품 → 가격에서 `price_xxx` 형식 ID 복사 후 `.env.local`에 설정.
