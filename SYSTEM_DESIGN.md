# 🏗️ 포스처랩 SaaS 플랫폼 시스템 설계서

> **작성일:** 2026-01-29  
> **버전:** 1.0  
> **설계자:** System Architect

---

## 📋 목차

1. [전체 아키텍처 개요](#1-전체-아키텍처-개요)
2. [사용자 등급별 서비스 매트릭스](#2-사용자-등급별-서비스-매트릭스)
3. [사용자 흐름 (User Flow)](#3-사용자-흐름-user-flow)
4. [데이터베이스 설계](#4-데이터베이스-설계)
5. [권한 관리 로직](#5-권한-관리-로직)
6. [결제 시스템 설계](#6-결제-시스템-설계)
7. [API 엔드포인트 설계](#7-api-엔드포인트-설계)
8. [확장 가능성 고려사항](#8-확장-가능성-고려사항)
9. [보안 및 컴플라이언스](#9-보안-및-컴플라이언스)

---

## 1. 전체 아키�ecture 개요

### 1.1 시스템 구성도

```
┌─────────────────────────────────────────────────────────────┐
│                        클라이언트 (Next.js)                    │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │   Free   │  Basic   │ Standard │ Premium  │   VIP    │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                     API 레이어 (Next.js API)                  │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │   인증    │  결제    │  파일    │  피드백   │  스케줄  │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                  데이터베이스 (Supabase)                       │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │  Users   │  Plans   │ Payments │ Feedback │ Schedule │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                      외부 서비스 통합                          │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │  Toss    │  AWS S3  │   Zoom   │  이메일   │   SMS    │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 기술 스택

| 레이어 | 기술 | 용도 |
|--------|------|------|
| **프론트엔드** | Next.js 16, React, TailwindCSS | UI/UX, SSR |
| **백엔드** | Next.js API Routes | RESTful API |
| **데이터베이스** | Supabase (PostgreSQL) | 메인 DB, 인증 |
| **스토리지** | Supabase Storage / AWS S3 | 사진, 영상, PDF |
| **결제** | Toss Payments | 단건, 구독 결제 |
| **화상통화** | Zoom API | Premium/VIP 코칭 |
| **이메일** | SendGrid / AWS SES | PDF 발송, 알림 |
| **배포** | Vercel | CI/CD, Edge Functions |

---

## 2. 사용자 등급별 서비스 매트릭스

### 2.1 등급 비교표

| 기능 | Free | Basic | Standard | Premium | VIP |
|------|------|-------|----------|---------|-----|
| **가격** | 무료 | ₩29,900 | ₩49,900 | ₩99,000/월 | ₩199,000/월 |
| **체형 설문** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **자동 PDF** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **영상 피드백** | ❌ | 1회 | 주 1회 | 주 2회 | 무제한 |
| **재평가** | ❌ | ❌ | 월 2회 | 월 4회 | 무제한 |
| **Zoom 코칭** | ❌ | ❌ | ❌ | 월 2회 (30분) | 월 4회 (60분) |
| **일정 관리** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **운동 기록** | ❌ | ❌ | ✅ (3개월) | ✅ (1년) | ✅ (무제한) |
| **전담 트레이너** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **24시간 Q&A** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **영양 상담** | ❌ | ❌ | ❌ | ❌ | ✅ |

### 2.2 결제 방식

| 등급 | 결제 타입 | 갱신 주기 | 환불 정책 |
|------|-----------|----------|----------|
| **Free** | - | - | - |
| **Basic** | 단건 결제 | - | 14일 (미사용 시) |
| **Standard** | 단건 결제 | - | 7일 (미사용 시) |
| **Premium** | 구독 결제 | 매월 자동 갱신 | 언제든지 취소 가능 |
| **VIP** | 구독 결제 | 매월 자동 갱신 | 언제든지 취소 가능 |

---

## 3. 사용자 흐름 (User Flow)

### 3.1 전체 흐름도

```
┌─────────────────────────────────────────────────────────────┐
│                        1. 회원가입/로그인                       │
│                  (이메일, 소셜 로그인, 구글, 카카오)              │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                     2. 프로필 설정 (선택)                      │
│              (이름, 나이, 성별, 키, 몸무게, 목표)               │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                      3. 등급 선택 페이지                       │
│         Free / Basic / Standard / Premium / VIP 비교         │
└────────────────────────┬────────────────────────────────────┘
                         ↓
         ┌───────────────┼───────────────┐
         ↓               ↓               ↓
    ┌────────┐      ┌────────┐     ┌────────┐
    │  Free  │      │ Basic  │     │Premium │
    │        │      │Standard│     │  VIP   │
    └────┬───┘      └────┬───┘     └────┬───┘
         ↓               ↓               ↓
    설문 작성         결제 진행       결제 진행
         ↓               ↓               ↓
    PDF 발송      서비스 이용     구독 시작
```

### 3.2 Free 등급 상세 흐름

```
회원가입
   ↓
체형 설문 작성 (15개 질문)
   ├─ 거북목 정도
   ├─ 라운드숄더 정도
   ├─ 골반 전방/후방 경사
   ├─ 통증 부위
   └─ 운동 경험
   ↓
AI 분석 (자동)
   ↓
PDF 생성 (자동)
   ↓
이메일 발송 (즉시)
   ↓
[업그레이드 유도]
```

### 3.3 Basic 등급 상세 흐름

```
회원가입
   ↓
Basic 플랜 선택
   ↓
결제 (₩29,900)
   ↓
사진 2장 업로드 (정면, 측면)
   ↓
전문가 분석 대기 (24시간)
   ↓
PDF + 영상 피드백 1회 발송
   ↓
서비스 완료
   ↓
[Standard 업그레이드 유도]
```

### 3.4 Standard 등급 상세 흐름

```
회원가입
   ↓
Standard 플랜 선택
   ↓
결제 (₩49,900)
   ↓
사진 업로드 (정면, 측면)
   ↓
초기 분석 (24시간)
   ↓
PDF + 영상 피드백 발송
   ↓
┌─────────────────────────────┐
│   주간 루틴 (4주간 반복)      │
│  ┌─────────────────────┐    │
│  │ 주 1회 영상 업로드    │    │
│  │        ↓             │    │
│  │ 전문가 피드백 (48시간) │    │
│  │        ↓             │    │
│  │ 운동 수행 기록        │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
   ↓
월 2회 재평가 (1일, 15일)
   ↓
개선 보고서 발송
   ↓
[Premium 업그레이드 유도]
```

### 3.5 Premium/VIP 등급 상세 흐름

```
회원가입
   ↓
Premium/VIP 플랜 선택
   ↓
구독 결제 (월 ₩99,000 / ₩199,000)
   ↓
온보딩 Zoom 세션 예약
   ↓
초기 평가 (Zoom 30/60분)
   ├─ 체형 분석
   ├─ 목표 설정
   ├─ 운동 계획 수립
   └─ 일정 조율
   ↓
┌─────────────────────────────┐
│     월간 루틴 (반복)          │
│  ┌─────────────────────┐    │
│  │ 주 2회 영상 업로드    │    │
│  │        ↓             │    │
│  │ 24시간 피드백         │    │
│  │        ↓             │    │
│  │ Zoom 코칭 (예약제)    │    │
│  │        ↓             │    │
│  │ 운동 수행 체크        │    │
│  │        ↓             │    │
│  │ 전담 트레이너 Q&A     │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
   ↓
월말 종합 평가
   ↓
차월 플랜 조정
   ↓
[구독 유지 또는 취소]
```

---

## 4. 데이터베이스 설계

### 4.1 ERD (Entity Relationship Diagram)

```
┌──────────────────┐       ┌──────────────────┐
│      users       │───────│   user_profiles  │
├──────────────────┤  1:1  ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ email            │       │ user_id (FK)     │
│ password_hash    │       │ full_name        │
│ role             │       │ age              │
│ plan_tier        │       │ gender           │
│ created_at       │       │ height           │
│ updated_at       │       │ weight           │
└──────────────────┘       │ goals            │
         │                 │ created_at       │
         │                 └──────────────────┘
         │
         │ 1:N
         ↓
┌──────────────────┐       ┌──────────────────┐
│   subscriptions  │───────│     payments     │
├──────────────────┤  1:N  ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ user_id (FK)     │       │ user_id (FK)     │
│ plan_id (FK)     │       │ subscription_id  │
│ status           │       │ amount           │
│ start_date       │       │ payment_method   │
│ end_date         │       │ order_id         │
│ auto_renew       │       │ payment_key      │
│ created_at       │       │ status           │
│ cancelled_at     │       │ paid_at          │
└──────────────────┘       └──────────────────┘
         │
         │ 1:N
         ↓
┌──────────────────┐       ┌──────────────────┐
│    assessments   │───────│      files       │
├──────────────────┤  1:N  ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ user_id (FK)     │       │ assessment_id    │
│ subscription_id  │       │ file_type        │
│ assessment_type  │       │ file_url         │
│ front_photo_url  │       │ file_size        │
│ side_photo_url   │       │ uploaded_at      │
│ diagnoses        │       │ deleted_at       │
│ status           │       └──────────────────┘
│ created_at       │
│ completed_at     │
└──────────────────┘
         │
         │ 1:N
         ↓
┌──────────────────┐       ┌──────────────────┐
│     feedbacks    │───────│     schedules    │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ assessment_id    │       │ user_id (FK)     │
│ trainer_id (FK)  │       │ trainer_id (FK)  │
│ feedback_type    │       │ meeting_type     │
│ video_url        │       │ scheduled_at     │
│ pdf_url          │       │ duration         │
│ notes            │       │ zoom_link        │
│ created_at       │       │ status           │
└──────────────────┘       │ notes            │
         │                 │ created_at       │
         │                 │ completed_at     │
         │                 └──────────────────┘
         │ 1:N
         ↓
┌──────────────────┐
│  workout_logs    │
├──────────────────┤
│ id (PK)          │
│ user_id (FK)     │
│ subscription_id  │
│ exercise_name    │
│ sets             │
│ reps             │
│ notes            │
│ logged_at        │
└──────────────────┘
```

### 4.2 테이블 상세 설계

#### 📘 users (사용자 기본 정보)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'trainer', 'admin')),
  plan_tier VARCHAR(20) DEFAULT 'free' CHECK (plan_tier IN ('free', 'basic', 'standard', 'premium', 'vip')),
  plan_status VARCHAR(20) DEFAULT 'active' CHECK (plan_status IN ('active', 'inactive', 'cancelled', 'expired')),
  oauth_provider VARCHAR(50),  -- 'google', 'kakao', 'naver', NULL
  oauth_id VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_plan_tier ON users(plan_tier);
CREATE INDEX idx_users_created_at ON users(created_at);
```

#### 📘 user_profiles (사용자 프로필)

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(100),
  phone VARCHAR(20),
  birth_date DATE,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
  height_cm INTEGER,
  weight_kg DECIMAL(5,2),
  goals TEXT[],  -- ['자세개선', '통증완화', '근력향상']
  medical_history TEXT,
  pain_areas TEXT[],  -- ['목', '어깨', '허리']
  exercise_experience VARCHAR(20) CHECK (exercise_experience IN ('beginner', 'intermediate', 'advanced')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
```

#### 📘 plans (요금제 정보)

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,  -- 'Free', 'Basic', 'Standard', 'Premium', 'VIP'
  tier VARCHAR(20) UNIQUE NOT NULL CHECK (tier IN ('free', 'basic', 'standard', 'premium', 'vip')),
  price INTEGER NOT NULL,  -- 원 단위
  billing_type VARCHAR(20) NOT NULL CHECK (billing_type IN ('free', 'one_time', 'subscription')),
  billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'yearly', NULL)),
  features JSONB NOT NULL,  -- 기능 리스트 (JSON)
  limits JSONB NOT NULL,  -- 제한사항 (JSON)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 플랜 데이터
INSERT INTO plans (name, tier, price, billing_type, billing_cycle, features, limits) VALUES
('Free', 'free', 0, 'free', NULL, 
  '{"survey": true, "auto_pdf": true, "video_feedback": false, "zoom": false}',
  '{"pdf_count": 1, "video_feedback": 0, "zoom_sessions": 0}'),
  
('Basic', 'basic', 29900, 'one_time', NULL,
  '{"survey": true, "auto_pdf": true, "video_feedback": true, "zoom": false}',
  '{"pdf_count": 1, "video_feedback": 1, "zoom_sessions": 0}'),
  
('Standard', 'standard', 49900, 'one_time', NULL,
  '{"survey": true, "auto_pdf": true, "video_feedback": true, "re_assessment": true, "workout_log": true, "zoom": false}',
  '{"video_feedback_per_week": 1, "re_assessment_per_month": 2, "history_months": 3}'),
  
('Premium', 'premium', 99000, 'subscription', 'monthly',
  '{"survey": true, "auto_pdf": true, "video_feedback": true, "re_assessment": true, "workout_log": true, "zoom": true, "schedule_management": true}',
  '{"video_feedback_per_week": 2, "re_assessment_per_month": 4, "zoom_sessions_per_month": 2, "zoom_duration_minutes": 30, "history_months": 12}'),
  
('VIP', 'vip', 199000, 'subscription', 'monthly',
  '{"survey": true, "auto_pdf": true, "video_feedback": true, "re_assessment": true, "workout_log": true, "zoom": true, "schedule_management": true, "dedicated_trainer": true, "24h_qa": true, "nutrition": true}',
  '{"video_feedback_unlimited": true, "re_assessment_unlimited": true, "zoom_sessions_per_month": 4, "zoom_duration_minutes": 60, "history_unlimited": true}');
```

#### 📘 subscriptions (구독 정보)

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  billing_type VARCHAR(20) NOT NULL CHECK (billing_type IN ('one_time', 'subscription')),
  
  -- 구독 기간
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  
  -- 자동 갱신
  auto_renew BOOLEAN DEFAULT TRUE,
  
  -- 사용량 추적
  usage_stats JSONB DEFAULT '{}',  -- {"video_feedback_used": 2, "zoom_sessions_used": 1}
  
  -- 취소 정보
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_billing ON subscriptions(next_billing_date);
```

#### 📘 payments (결제 정보)

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  subscription_id UUID REFERENCES subscriptions(id),
  
  -- 결제 금액
  amount INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'KRW',
  
  -- 결제 방식
  payment_method VARCHAR(50) NOT NULL,  -- 'card', 'transfer', 'virtual_account'
  payment_provider VARCHAR(50) DEFAULT 'toss',
  
  -- Toss Payments 정보
  order_id VARCHAR(255) UNIQUE NOT NULL,
  payment_key VARCHAR(255),
  
  -- 결제 상태
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
  
  -- 환불 정보
  refunded_amount INTEGER DEFAULT 0,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  
  -- 타임스탬프
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
```

#### 📘 assessments (평가/분석)

```sql
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  subscription_id UUID REFERENCES subscriptions(id),
  
  -- 평가 타입
  assessment_type VARCHAR(20) NOT NULL CHECK (assessment_type IN ('initial', 're_assessment', 'weekly_check')),
  
  -- 업로드된 사진
  front_photo_url TEXT,
  side_photo_url TEXT,
  
  -- AI/전문가 진단
  diagnoses JSONB,  -- {"forwardHead": "moderate", "roundedShoulder": "mild"}
  ai_score INTEGER CHECK (ai_score BETWEEN 0 AND 100),
  
  -- 상태
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'cancelled')),
  
  -- 담당 트레이너
  assigned_trainer_id UUID REFERENCES users(id),
  
  -- 완료 정보
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assessments_user_id ON assessments(user_id);
CREATE INDEX idx_assessments_subscription_id ON assessments(subscription_id);
CREATE INDEX idx_assessments_status ON assessments(status);
CREATE INDEX idx_assessments_created_at ON assessments(created_at);
```

#### 📘 feedbacks (피드백)

```sql
CREATE TABLE feedbacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  trainer_id UUID NOT NULL REFERENCES users(id),
  
  -- 피드백 타입
  feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('pdf', 'video', 'text', 'zoom')),
  
  -- 콘텐츠
  video_url TEXT,
  pdf_url TEXT,
  text_content TEXT,
  
  -- 메타데이터
  duration_seconds INTEGER,  -- 영상 길이
  notes TEXT,  -- 트레이너 메모
  
  -- 사용자 피드백
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  user_comment TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedbacks_assessment_id ON feedbacks(assessment_id);
CREATE INDEX idx_feedbacks_user_id ON feedbacks(user_id);
CREATE INDEX idx_feedbacks_trainer_id ON feedbacks(trainer_id);
```

#### 📘 schedules (일정 관리 - Premium/VIP)

```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  trainer_id UUID NOT NULL REFERENCES users(id),
  
  -- 미팅 정보
  meeting_type VARCHAR(20) NOT NULL CHECK (meeting_type IN ('zoom', 'in_person', 'phone')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- 일정
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  
  -- Zoom 정보 (meeting_type = 'zoom'일 때)
  zoom_meeting_id VARCHAR(255),
  zoom_join_url TEXT,
  zoom_password VARCHAR(50),
  
  -- 상태
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  
  -- 완료 정보
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  
  -- 취소 정보
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES users(id),
  
  -- 리마인더
  reminder_sent BOOLEAN DEFAULT FALSE,
  reminder_sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedules_user_id ON schedules(user_id);
CREATE INDEX idx_schedules_trainer_id ON schedules(trainer_id);
CREATE INDEX idx_schedules_scheduled_at ON schedules(scheduled_at);
CREATE INDEX idx_schedules_status ON schedules(status);
```

#### 📘 workout_logs (운동 기록 - Standard 이상)

```sql
CREATE TABLE workout_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  subscription_id UUID REFERENCES subscriptions(id),
  
  -- 운동 정보
  exercise_name VARCHAR(255) NOT NULL,
  exercise_category VARCHAR(50),  -- 'inhibit', 'lengthen', 'activate', 'integrate'
  
  -- 수행 기록
  sets INTEGER,
  reps INTEGER,
  duration_seconds INTEGER,
  weight_kg DECIMAL(5,2),
  
  -- 메모
  notes TEXT,
  difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),
  pain_level INTEGER CHECK (pain_level BETWEEN 0 AND 10),
  
  -- 타임스탬프
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workout_logs_user_id ON workout_logs(user_id);
CREATE INDEX idx_workout_logs_logged_at ON workout_logs(logged_at);
```

#### 📘 files (파일 관리)

```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  assessment_id UUID REFERENCES assessments(id),
  feedback_id UUID REFERENCES feedbacks(id),
  
  -- 파일 정보
  file_type VARCHAR(50) NOT NULL,  -- 'photo_front', 'photo_side', 'video_feedback', 'pdf_report'
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,  -- bytes
  mime_type VARCHAR(100),
  
  -- 스토리지 정보
  storage_provider VARCHAR(50) DEFAULT 'supabase',  -- 'supabase', 's3'
  storage_bucket VARCHAR(100),
  storage_path TEXT,
  file_url TEXT NOT NULL,
  
  -- 메타데이터
  metadata JSONB,
  
  -- 삭제 정보 (soft delete)
  deleted_at TIMESTAMPTZ,
  deletion_reason TEXT,
  
  -- 만료 (24시간 후 자동 삭제)
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_assessment_id ON files(assessment_id);
CREATE INDEX idx_files_expires_at ON files(expires_at);
CREATE INDEX idx_files_deleted_at ON files(deleted_at);
```

#### 📘 notifications (알림)

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- 알림 정보
  type VARCHAR(50) NOT NULL,  -- 'payment_success', 'feedback_ready', 'schedule_reminder', 'subscription_renewal'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  -- 링크
  action_url TEXT,
  
  -- 상태
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- 발송 채널
  sent_via_email BOOLEAN DEFAULT FALSE,
  sent_via_push BOOLEAN DEFAULT FALSE,
  sent_via_sms BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
```

---

## 5. 권한 관리 로직

### 5.1 권한 체크 함수

```typescript
// lib/permissions.ts

export type PlanTier = 'free' | 'basic' | 'standard' | 'premium' | 'vip';

export interface PlanLimits {
  videoFeedbackPerWeek?: number;
  videoFeedbackUnlimited?: boolean;
  reAssessmentPerMonth?: number;
  reAssessmentUnlimited?: boolean;
  zoomSessionsPerMonth?: number;
  zoomDurationMinutes?: number;
  historyMonths?: number;
  historyUnlimited?: boolean;
  dedicatedTrainer?: boolean;
  qa24h?: boolean;
}

export const PLAN_FEATURES: Record<PlanTier, {
  name: string;
  features: string[];
  limits: PlanLimits;
}> = {
  free: {
    name: 'Free',
    features: ['survey', 'auto_pdf'],
    limits: {}
  },
  basic: {
    name: 'Basic',
    features: ['survey', 'auto_pdf', 'video_feedback'],
    limits: {
      videoFeedbackPerWeek: 1
    }
  },
  standard: {
    name: 'Standard',
    features: ['survey', 'auto_pdf', 'video_feedback', 're_assessment', 'workout_log'],
    limits: {
      videoFeedbackPerWeek: 1,
      reAssessmentPerMonth: 2,
      historyMonths: 3
    }
  },
  premium: {
    name: 'Premium',
    features: ['survey', 'auto_pdf', 'video_feedback', 're_assessment', 'workout_log', 'zoom', 'schedule'],
    limits: {
      videoFeedbackPerWeek: 2,
      reAssessmentPerMonth: 4,
      zoomSessionsPerMonth: 2,
      zoomDurationMinutes: 30,
      historyMonths: 12
    }
  },
  vip: {
    name: 'VIP',
    features: ['survey', 'auto_pdf', 'video_feedback', 're_assessment', 'workout_log', 'zoom', 'schedule', 'dedicated_trainer', 'qa_24h', 'nutrition'],
    limits: {
      videoFeedbackUnlimited: true,
      reAssessmentUnlimited: true,
      zoomSessionsPerMonth: 4,
      zoomDurationMinutes: 60,
      historyUnlimited: true,
      dedicatedTrainer: true,
      qa24h: true
    }
  }
};

// 기능 접근 권한 체크
export function hasFeature(planTier: PlanTier, feature: string): boolean {
  return PLAN_FEATURES[planTier].features.includes(feature);
}

// 사용량 제한 체크
export async function checkUsageLimit(
  userId: string,
  planTier: PlanTier,
  action: 'video_feedback' | 're_assessment' | 'zoom_session'
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limits = PLAN_FEATURES[planTier].limits;
  
  // 무제한 플랜 체크
  if (action === 'video_feedback' && limits.videoFeedbackUnlimited) {
    return { allowed: true, used: 0, limit: Infinity };
  }
  if (action === 're_assessment' && limits.reAssessmentUnlimited) {
    return { allowed: true, used: 0, limit: Infinity };
  }
  
  // 현재 사용량 조회
  const usage = await getCurrentUsage(userId, action);
  
  // 제한 확인
  let limit = 0;
  if (action === 'video_feedback') {
    limit = limits.videoFeedbackPerWeek || 0;
  } else if (action === 're_assessment') {
    limit = limits.reAssessmentPerMonth || 0;
  } else if (action === 'zoom_session') {
    limit = limits.zoomSessionsPerMonth || 0;
  }
  
  return {
    allowed: usage < limit,
    used: usage,
    limit: limit
  };
}

// 현재 사용량 조회
async function getCurrentUsage(
  userId: string,
  action: 'video_feedback' | 're_assessment' | 'zoom_session'
): Promise<number> {
  const supabase = getServerSupabase();
  
  // 기간 설정
  let startDate: Date;
  if (action === 'video_feedback') {
    // 주간 계산
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else {
    // 월간 계산
    startDate = new Date();
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
  }
  
  // 사용량 조회
  if (action === 'video_feedback') {
    const { count } = await supabase
      .from('feedbacks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('feedback_type', 'video')
      .gte('created_at', startDate.toISOString());
    return count || 0;
  }
  
  if (action === 're_assessment') {
    const { count } = await supabase
      .from('assessments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('assessment_type', 're_assessment')
      .gte('created_at', startDate.toISOString());
    return count || 0;
  }
  
  if (action === 'zoom_session') {
    const { count } = await supabase
      .from('schedules')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('meeting_type', 'zoom')
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString());
    return count || 0;
  }
  
  return 0;
}

// 권한 미들웨어
export async function requirePlanTier(
  userId: string,
  requiredTier: PlanTier
): Promise<boolean> {
  const supabase = getServerSupabase();
  
  const { data: user } = await supabase
    .from('users')
    .select('plan_tier, plan_status')
    .eq('id', userId)
    .single();
  
  if (!user || user.plan_status !== 'active') {
    return false;
  }
  
  const tierOrder = ['free', 'basic', 'standard', 'premium', 'vip'];
  const userTierIndex = tierOrder.indexOf(user.plan_tier);
  const requiredTierIndex = tierOrder.indexOf(requiredTier);
  
  return userTierIndex >= requiredTierIndex;
}
```

### 5.2 API 엔드포인트 권한 예시

```typescript
// app/api/feedback/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requirePlanTier, checkUsageLimit, hasFeature } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  
  // 1. 기능 접근 권한 체크
  const userPlan = await getUserPlan(userId);
  if (!hasFeature(userPlan, 'video_feedback')) {
    return NextResponse.json({
      error: '이 기능은 Basic 등급 이상에서 사용 가능합니다.',
      upgrade_required: true,
      required_plan: 'basic'
    }, { status: 403 });
  }
  
  // 2. 사용량 제한 체크
  const usageCheck = await checkUsageLimit(userId, userPlan, 'video_feedback');
  if (!usageCheck.allowed) {
    return NextResponse.json({
      error: `주간 영상 피드백 한도를 초과했습니다. (${usageCheck.used}/${usageCheck.limit})`,
      upgrade_recommended: true,
      next_reset: getNextResetDate('weekly')
    }, { status: 429 });
  }
  
  // 3. 파일 업로드 처리
  const formData = await req.formData();
  const file = formData.get('video') as File;
  
  // ... 업로드 로직
  
  return NextResponse.json({ success: true });
}
```

---

## 6. 결제 시스템 설계

### 6.1 결제 흐름도

```
┌─────────────────────────────────────────────────────────────┐
│                    사용자: 플랜 선택                          │
└────────────────────────┬────────────────────────────────────┘
                         ↓
                 ┌───────┴───────┐
                 ↓               ↓
         ┌──────────────┐  ┌──────────────┐
         │  단건 결제    │  │  구독 결제    │
         │ (Basic/Std)  │  │ (Premium/VIP)│
         └──────┬───────┘  └──────┬───────┘
                ↓                  ↓
         ┌──────────────┐  ┌──────────────┐
         │ Toss 결제창  │  │ Toss 빌링키  │
         │   (일반)     │  │   (자동결제)  │
         └──────┬───────┘  └──────┬───────┘
                ↓                  ↓
         ┌──────────────┐  ┌──────────────┐
         │ 결제 승인     │  │ 빌링키 발급  │
         └──────┬───────┘  └──────┬───────┘
                ↓                  ↓
         ┌──────────────┐  ┌──────────────┐
         │ 구독 생성     │  │ 구독 생성     │
         │ (1회성)      │  │ (반복)       │
         └──────┬───────┘  └──────┬───────┘
                ↓                  ↓
         ┌──────────────┐  ┌──────────────┐
         │ 서비스 활성화 │  │ 월 자동 갱신  │
         └──────────────┘  └──────────────┘
```

### 6.2 결제 API 구현

```typescript
// app/api/payments/checkout/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { planId, successUrl, failUrl } = await req.json();
  const userId = await getCurrentUserId(req);
  
  // 1. 플랜 정보 조회
  const supabase = getServerSupabase();
  const { data: plan } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();
  
  if (!plan) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }
  
  // 2. 주문 ID 생성
  const orderId = `order_${userId}_${Date.now()}`;
  
  // 3. Payment 레코드 생성
  const { data: payment } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      amount: plan.price,
      order_id: orderId,
      payment_method: 'card',
      status: 'pending'
    })
    .select()
    .single();
  
  // 4. Toss Payments 결제창 URL 생성
  if (plan.billing_type === 'one_time') {
    // 일반 결제
    const tossPaymentUrl = `https://api.tosspayments.com/v1/payments`;
    // ... Toss SDK 호출
  } else {
    // 구독 결제 (빌링키)
    const tossBillingUrl = `https://api.tosspayments.com/v1/billing/authorizations/card`;
    // ... Toss Billing SDK 호출
  }
  
  return NextResponse.json({
    orderId,
    paymentId: payment.id,
    checkoutUrl: tossPaymentUrl,
    amount: plan.price
  });
}
```

```typescript
// app/api/payments/confirm/route.ts

export async function POST(req: NextRequest) {
  const { orderId, paymentKey, amount } = await req.json();
  
  const supabase = getServerSupabase();
  
  // 1. Toss Payments 승인 API 호출
  const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ orderId, paymentKey, amount })
  });
  
  const tossData = await tossResponse.json();
  
  if (tossResponse.ok) {
    // 2. Payment 상태 업데이트
    const { data: payment } = await supabase
      .from('payments')
      .update({
        payment_key: paymentKey,
        status: 'completed',
        paid_at: new Date().toISOString()
      })
      .eq('order_id', orderId)
      .select()
      .single();
    
    // 3. Subscription 생성
    const { data: plan } = await supabase
      .from('plans')
      .select('*')
      .eq('id', payment.plan_id)
      .single();
    
    const endDate = plan.billing_type === 'subscription' 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30일 후
      : null;
    
    const { data: subscription } = await supabase
      .from('subscriptions')
      .insert({
        user_id: payment.user_id,
        plan_id: payment.plan_id,
        status: 'active',
        billing_type: plan.billing_type,
        start_date: new Date().toISOString(),
        end_date: endDate?.toISOString(),
        next_billing_date: endDate?.toISOString(),
        auto_renew: plan.billing_type === 'subscription'
      })
      .select()
      .single();
    
    // 4. User plan_tier 업데이트
    await supabase
      .from('users')
      .update({
        plan_tier: plan.tier,
        plan_status: 'active'
      })
      .eq('id', payment.user_id);
    
    // 5. 알림 발송
    await sendNotification(payment.user_id, {
      type: 'payment_success',
      title: '결제가 완료되었습니다',
      message: `${plan.name} 플랜이 활성화되었습니다.`
    });
    
    return NextResponse.json({
      success: true,
      subscription: subscription
    });
  } else {
    // 결제 실패
    await supabase
      .from('payments')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: tossData.message
      })
      .eq('order_id', orderId);
    
    return NextResponse.json({
      success: false,
      error: tossData.message
    }, { status: 400 });
  }
}
```

### 6.3 구독 자동 갱신 (Cron Job)

```typescript
// app/api/cron/renew-subscriptions/route.ts

export async function GET(req: NextRequest) {
  // Vercel Cron Job에서 호출 (매일 00:00)
  
  const supabase = getServerSupabase();
  
  // 오늘 갱신 예정인 구독 조회
  const today = new Date().toISOString().split('T')[0];
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('*, users(*), plans(*)')
    .eq('status', 'active')
    .eq('auto_renew', true)
    .lte('next_billing_date', `${today}T23:59:59`);
  
  for (const sub of subscriptions || []) {
    try {
      // 1. 빌링키로 자동 결제
      const billingKey = await getBillingKey(sub.user_id);
      
      const tossResponse = await fetch('https://api.tosspayments.com/v1/billing/' + billingKey, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerKey: sub.user_id,
          amount: sub.plans.price,
          orderId: `renewal_${sub.id}_${Date.now()}`,
          orderName: `${sub.plans.name} 월 구독료`
        })
      });
      
      if (tossResponse.ok) {
        // 2. Payment 레코드 생성
        await supabase.from('payments').insert({
          user_id: sub.user_id,
          subscription_id: sub.id,
          amount: sub.plans.price,
          order_id: `renewal_${sub.id}_${Date.now()}`,
          payment_method: 'card',
          status: 'completed',
          paid_at: new Date().toISOString()
        });
        
        // 3. 구독 기간 연장
        const newEndDate = new Date(sub.end_date);
        newEndDate.setMonth(newEndDate.getMonth() + 1);
        
        await supabase
          .from('subscriptions')
          .update({
            end_date: newEndDate.toISOString(),
            next_billing_date: newEndDate.toISOString(),
            usage_stats: {}  // 사용량 초기화
          })
          .eq('id', sub.id);
        
        // 4. 알림 발송
        await sendNotification(sub.user_id, {
          type: 'subscription_renewal',
          title: '구독이 갱신되었습니다',
          message: `${sub.plans.name} 플랜이 ${newEndDate.toLocaleDateString()}까지 연장되었습니다.`
        });
      } else {
        // 결제 실패 - 구독 일시정지
        await supabase
          .from('subscriptions')
          .update({ status: 'paused' })
          .eq('id', sub.id);
        
        await sendNotification(sub.user_id, {
          type: 'payment_failed',
          title: '결제에 실패했습니다',
          message: '구독이 일시정지되었습니다. 결제 수단을 확인해주세요.'
        });
      }
    } catch (error) {
      console.error(`구독 갱신 실패: ${sub.id}`, error);
    }
  }
  
  return NextResponse.json({ success: true, processed: subscriptions?.length || 0 });
}
```

---

## 7. API 엔드포인트 설계

### 7.1 인증 API

```
POST   /api/auth/signup          # 회원가입
POST   /api/auth/login           # 로그인
POST   /api/auth/logout          # 로그아웃
POST   /api/auth/refresh         # 토큰 갱신
POST   /api/auth/forgot-password # 비밀번호 재설정 요청
POST   /api/auth/reset-password  # 비밀번호 재설정
GET    /api/auth/verify-email    # 이메일 인증
```

### 7.2 사용자 API

```
GET    /api/users/me             # 내 정보 조회
PATCH  /api/users/me             # 내 정보 수정
GET    /api/users/me/profile     # 프로필 조회
PATCH  /api/users/me/profile     # 프로필 수정
GET    /api/users/me/subscription # 구독 정보 조회
```

### 7.3 플랜 API

```
GET    /api/plans                # 전체 플랜 목록
GET    /api/plans/:tier          # 특정 플랜 상세
GET    /api/plans/compare        # 플랜 비교
```

### 7.4 결제 API

```
POST   /api/payments/checkout    # 결제 시작
POST   /api/payments/confirm     # 결제 승인
GET    /api/payments/history     # 결제 내역
POST   /api/payments/refund      # 환불 요청
POST   /api/payments/billing-key # 빌링키 등록
```

### 7.5 구독 API

```
GET    /api/subscriptions/current      # 현재 구독 조회
POST   /api/subscriptions/upgrade      # 플랜 업그레이드
POST   /api/subscriptions/cancel       # 구독 취소
POST   /api/subscriptions/reactivate   # 구독 재활성화
GET    /api/subscriptions/usage        # 사용량 조회
```

### 7.6 평가 API

```
POST   /api/assessments/create         # 새 평가 생성
POST   /api/assessments/:id/upload     # 사진 업로드
GET    /api/assessments/:id            # 평가 조회
GET    /api/assessments/history        # 평가 히스토리
POST   /api/assessments/:id/request-reassessment # 재평가 요청
```

### 7.7 피드백 API

```
GET    /api/feedbacks/:assessmentId    # 피드백 조회
POST   /api/feedbacks/:assessmentId/rate # 피드백 평가
GET    /api/feedbacks/history          # 피드백 히스토리
```

### 7.8 스케줄 API (Premium/VIP)

```
GET    /api/schedules                  # 내 일정 목록
POST   /api/schedules/book             # 일정 예약
PATCH  /api/schedules/:id              # 일정 수정
DELETE /api/schedules/:id              # 일정 취소
GET    /api/schedules/available-slots  # 예약 가능 시간
POST   /api/schedules/:id/zoom-link    # Zoom 링크 생성
```

### 7.9 운동 기록 API (Standard 이상)

```
POST   /api/workout-logs               # 운동 기록 추가
GET    /api/workout-logs               # 운동 기록 조회
GET    /api/workout-logs/stats         # 운동 통계
DELETE /api/workout-logs/:id           # 기록 삭제
```

### 7.10 파일 API

```
POST   /api/files/upload               # 파일 업로드
GET    /api/files/:id                  # 파일 조회 (signed URL)
DELETE /api/files/:id                  # 파일 삭제
```

---

## 8. 확장 가능성 고려사항

### 8.1 마이크로서비스 전환 준비

현재는 모놀리식 구조이지만, 향후 확장을 위해 다음과 같이 분리 가능:

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway (Next.js)                    │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
         ┌────────────────┼────────────────┐
         ↓                ↓                ↓
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Auth Service   │ │ Payment Service │ │ Content Service │
│  (Supabase)     │ │  (Toss + DB)    │ │ (S3 + Zoom)     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 8.2 캐싱 전략

```typescript
// Redis 캐싱 레이어 추가
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN
});

// 플랜 정보 캐싱 (1시간)
export async function getCachedPlan(planId: string) {
  const cacheKey = `plan:${planId}`;
  
  // 캐시 확인
  const cached = await redis.get(cacheKey);
  if (cached) return cached;
  
  // DB 조회
  const plan = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();
  
  // 캐시 저장
  await redis.setex(cacheKey, 3600, JSON.stringify(plan.data));
  
  return plan.data;
}

// 사용자 권한 캐싱 (5분)
export async function getCachedUserPermissions(userId: string) {
  const cacheKey = `permissions:${userId}`;
  
  const cached = await redis.get(cacheKey);
  if (cached) return cached;
  
  const permissions = await calculateUserPermissions(userId);
  await redis.setex(cacheKey, 300, JSON.stringify(permissions));
  
  return permissions;
}
```

### 8.3 이벤트 기반 아키텍처

```typescript
// lib/events.ts

type EventType = 
  | 'user.created'
  | 'payment.completed'
  | 'subscription.activated'
  | 'assessment.completed'
  | 'feedback.created';

interface Event {
  type: EventType;
  userId: string;
  data: any;
  timestamp: Date;
}

// 이벤트 발행
export async function publishEvent(event: Event) {
  // 1. DB에 이벤트 저장
  await supabase.from('events').insert(event);
  
  // 2. 이벤트 핸들러 트리거
  await triggerEventHandlers(event);
}

// 이벤트 핸들러
async function triggerEventHandlers(event: Event) {
  switch (event.type) {
    case 'payment.completed':
      await handlePaymentCompleted(event);
      break;
    case 'subscription.activated':
      await handleSubscriptionActivated(event);
      break;
    case 'assessment.completed':
      await handleAssessmentCompleted(event);
      break;
    // ...
  }
}

async function handlePaymentCompleted(event: Event) {
  // 1. 구독 활성화
  // 2. 환영 이메일 발송
  // 3. Slack 알림
  // 4. 분석 이벤트 전송
}
```

### 8.4 글로벌 확장

```typescript
// 다국어 지원
export const SUPPORTED_LANGUAGES = ['ko', 'en', 'ja', 'zh'];

// 지역별 가격 설정
export const REGIONAL_PRICING = {
  KR: { currency: 'KRW', multiplier: 1 },
  US: { currency: 'USD', multiplier: 0.00076 },
  JP: { currency: 'JPY', multiplier: 0.11 },
};

// 시간대 고려
export function getLocalizedSchedule(userId: string, schedule: Schedule) {
  const userTimezone = await getUserTimezone(userId);
  return {
    ...schedule,
    scheduled_at: convertToTimezone(schedule.scheduled_at, userTimezone)
  };
}
```

### 8.5 AI/ML 통합 준비

```typescript
// AI 분석 파이프라인
export async function analyzePosture(photoUrls: string[]) {
  // 1. 이미지 전처리
  const processedImages = await preprocessImages(photoUrls);
  
  // 2. AI 모델 호출 (예: AWS SageMaker, Google Vertex AI)
  const analysis = await callAIModel({
    model: 'posture-analyzer-v2',
    images: processedImages
  });
  
  // 3. 결과 후처리
  return {
    forwardHead: analysis.scores.forward_head,
    roundedShoulder: analysis.scores.rounded_shoulder,
    anteriorPelvicTilt: analysis.scores.apt,
    confidence: analysis.confidence,
    keypoints: analysis.keypoints
  };
}
```

---

## 9. 보안 및 컴플라이언스

### 9.1 데이터 보호

```typescript
// 개인정보 암호화
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

export function encryptPII(data: string): string {
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export function decryptPII(encrypted: string): string {
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### 9.2 파일 자동 삭제

```typescript
// app/api/cron/cleanup-files/route.ts

export async function GET() {
  const supabase = getServerSupabase();
  
  // 1. 만료된 파일 조회 (24시간 경과)
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() - 24);
  
  const { data: expiredFiles } = await supabase
    .from('files')
    .select('*')
    .lte('expires_at', expiryDate.toISOString())
    .is('deleted_at', null);
  
  // 2. 스토리지에서 삭제
  for (const file of expiredFiles || []) {
    try {
      await supabase.storage
        .from(file.storage_bucket)
        .remove([file.storage_path]);
      
      // 3. DB에서 soft delete
      await supabase
        .from('files')
        .update({
          deleted_at: new Date().toISOString(),
          deletion_reason: 'auto_cleanup_expired'
        })
        .eq('id', file.id);
    } catch (error) {
      console.error(`파일 삭제 실패: ${file.id}`, error);
    }
  }
  
  return NextResponse.json({
    success: true,
    deleted_count: expiredFiles?.length || 0
  });
}
```

### 9.3 Rate Limiting

```typescript
// lib/rate-limit.ts

import { Redis } from '@upstash/redis';

const redis = new Redis({ /* ... */ });

export async function rateLimit(
  identifier: string,  // userId or IP
  limit: number,       // 요청 제한
  window: number       // 시간 윈도우 (초)
): Promise<{ success: boolean; remaining: number }> {
  const key = `rate_limit:${identifier}`;
  
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, window);
  }
  
  if (current > limit) {
    return {
      success: false,
      remaining: 0
    };
  }
  
  return {
    success: true,
    remaining: limit - current
  };
}

// 사용 예시
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  
  // 사용자당 분당 10회 제한
  const { success, remaining } = await rateLimit(userId, 10, 60);
  
  if (!success) {
    return NextResponse.json({
      error: '요청 횟수 제한을 초과했습니다. 잠시 후 다시 시도해주세요.'
    }, {
      status: 429,
      headers: {
        'X-RateLimit-Remaining': remaining.toString(),
        'Retry-After': '60'
      }
    });
  }
  
  // ... 정상 처리
}
```

### 9.4 GDPR 준수

```typescript
// app/api/users/export-data/route.ts

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  const supabase = getServerSupabase();
  
  // 사용자 모든 데이터 수집
  const [user, profile, subscriptions, assessments, feedbacks, logs] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('user_profiles').select('*').eq('user_id', userId).single(),
    supabase.from('subscriptions').select('*').eq('user_id', userId),
    supabase.from('assessments').select('*').eq('user_id', userId),
    supabase.from('feedbacks').select('*').eq('user_id', userId),
    supabase.from('workout_logs').select('*').eq('user_id', userId)
  ]);
  
  const exportData = {
    user: user.data,
    profile: profile.data,
    subscriptions: subscriptions.data,
    assessments: assessments.data,
    feedbacks: feedbacks.data,
    workout_logs: logs.data,
    exported_at: new Date().toISOString()
  };
  
  // JSON 파일로 반환
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="user_data_${userId}.json"`
    }
  });
}

// 계정 삭제 (GDPR Right to be Forgotten)
// app/api/users/delete-account/route.ts

export async function DELETE(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  const supabase = getServerSupabase();
  
  // 1. 구독 취소
  await supabase
    .from('subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('user_id', userId);
  
  // 2. 파일 삭제
  const { data: files } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', userId);
  
  for (const file of files || []) {
    await supabase.storage
      .from(file.storage_bucket)
      .remove([file.storage_path]);
  }
  
  // 3. 개인정보 익명화
  await supabase
    .from('users')
    .update({
      email: `deleted_${userId}@example.com`,
      password_hash: null
    })
    .eq('id', userId);
  
  await supabase
    .from('user_profiles')
    .update({
      full_name: '[삭제됨]',
      phone: null,
      birth_date: null
    })
    .eq('user_id', userId);
  
  return NextResponse.json({ success: true, message: '계정이 삭제되었습니다.' });
}
```

---

## 10. 구현 우선순위

### Phase 1: MVP (1-2개월)
- [x] 사용자 인증 (Supabase Auth)
- [x] Free 플랜 (설문 + PDF)
- [x] Basic 플랜 (단건 결제)
- [ ] 결제 시스템 (Toss Payments)
- [ ] 파일 업로드 (Supabase Storage)
- [ ] 관리자 대시보드

### Phase 2: 확장 (2-3개월)
- [ ] Standard 플랜
- [ ] 구독 결제
- [ ] 사용량 추적
- [ ] 운동 기록
- [ ] 이메일 알림

### Phase 3: 프리미엄 기능 (3-4개월)
- [ ] Premium/VIP 플랜
- [ ] Zoom 통합
- [ ] 일정 관리
- [ ] 전담 트레이너 배정
- [ ] 실시간 Q&A

### Phase 4: 최적화 (4-5개월)
- [ ] AI 자동 분석
- [ ] 캐싱 레이어
- [ ] 성능 최적화
- [ ] 모바일 앱

---

## 📚 참고 자료

### 기술 문서
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Toss Payments API](https://docs.tosspayments.com)
- [Zoom API Documentation](https://marketplace.zoom.us/docs/api-reference)

### 컴플라이언스
- [개인정보보호법](https://www.pipc.go.kr)
- [GDPR Compliance](https://gdpr.eu)
- [PCI DSS Standards](https://www.pcisecuritystandards.org)

---

**작성 완료일:** 2026-01-29  
**다음 리뷰 예정:** 2026-02-29  
**문의:** dev@posturelab.com

