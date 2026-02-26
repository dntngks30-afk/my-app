'use client';

/**
 * movement-test 평가 설문 (PR1-FEEDBACK SIMPLIFY)
 * 4단 흐름, 존댓말/친절 톤, Q2=NO 시 Q3/Q4 숨김
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { calculateScoresV2 } from '@/features/movement-test/v2';
import { NeoButton, NeoCard, NeoPageLayout } from '@/components/neobrutalism';

const KEY = 'movementTestSession:v2';

const ACCURACY_OPTIONS = [
  { code: 'YES', label: '네, 꽤 잘 맞아요' },
  { code: 'MAYBE', label: '음… 애매해요' },
  { code: 'NO', label: '아니요, 제 느낌과 달라요' },
];

const WANTS_PRECISION_OPTIONS = [
  { code: 'YES', label: '네, 꼭 이용해보고 싶어요' },
  { code: 'MAYBE', label: '있으면 이용해볼 것 같아요' },
  { code: 'UNKNOWN', label: '아직 잘 모르겠어요' },
  { code: 'NO', label: '아니요, 지금은 필요 없어요' },
];

const PRECISION_FEATURE_OPTIONS = [
  { code: 'PHOTO_ANALYSIS', label: '사진/영상 업로드 분석 (자세를 라인/각도로 확인)' },
  { code: 'RETEST_REPORT', label: '2주 단위 재테스트 + 변화 추적 리포트 (개선 정도를 숫자로 확인)' },
  { code: 'ROUTINE_ALARM', label: '7일 루틴 + 알림 (따라만 해도 진행되는 플랜)' },
  { code: 'EXPERT_COMMENT', label: '전문가 코멘트 1회 (제 케이스에 맞춘 조언)' },
];

const PRICE_OPTIONS = [
  { code: 'UNDER_9', label: '9,900원 이하' },
  { code: '9_19', label: '9,900 ~ 19,900원' },
  { code: '19_39', label: '19,900 ~ 39,900원' },
  { code: '39_PLUS', label: '39,900원 이상 (기능/코멘트 포함이면)' },
];

const inputClass = `
  w-full min-h-[44px]
  rounded-2xl
  bg-white
  border-2 border-slate-900
  px-3 py-2 text-sm sm:text-base text-slate-800
  placeholder:text-slate-400
  shadow-[2px_2px_0_0_rgba(15,23,42,1)]
  focus:outline-none focus:ring-2 focus:ring-orange-400
`;

interface SessionV2 {
  version: string;
  isCompleted: boolean;
  answersById: Record<string, 0 | 1 | 2 | 3 | 4>;
}

function loadSession(): SessionV2 | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 'v2') return null;
    return {
      version: 'v2',
      isCompleted: data.isCompleted ?? false,
      answersById: data.answersById ?? {},
    };
  } catch {
    return null;
  }
}

export default function FeedbackPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accuracyFeel, setAccuracyFeel] = useState<string | null>(null);
  const [wantsPrecision, setWantsPrecision] = useState<string | null>(null);
  const [precisionFeature, setPrecisionFeature] = useState<string | null>(null);
  const [precisionFeatureOther, setPrecisionFeatureOther] = useState('');
  const [priceRange, setPriceRange] = useState<string | null>(null);
  const [priceOther, setPriceOther] = useState('');

  const [context, setContext] = useState<{
    mainAnimal: string | null;
    resultType: string | null;
    axisScores: Record<string, number> | null;
  }>({ mainAnimal: null, resultType: null, axisScores: null });

  useEffect(() => {
    const session = loadSession();
    if (!session?.answersById || Object.keys(session.answersById).length === 0) return;
    try {
      const result = calculateScoresV2(
        session.answersById as Record<string, 0 | 1 | 2 | 3 | 4>
      );
      setContext({
        mainAnimal: result.mainAnimal ?? result.baseType ?? null,
        resultType: result.resultType ?? null,
        axisScores: result.axisScores ?? null,
      });
    } catch {
      // ignore
    }
  }, []);

  const showQ3Q4 = wantsPrecision !== 'NO';
  const needPrecision =
    showQ3Q4 &&
    precisionFeature != null &&
    (precisionFeature !== 'other' || precisionFeatureOther.trim() !== '');
  const needPrice =
    showQ3Q4 &&
    priceRange != null &&
    (priceRange !== 'other' || priceOther.trim() !== '');
  const canSubmit =
    accuracyFeel != null &&
    wantsPrecision != null &&
    (showQ3Q4 ? needPrecision && needPrice : true);

  const handleSubmit = useCallback(async () => {
    if (!accuracyFeel || !wantsPrecision) {
      setError('필수 질문에 답변해 주세요.');
      return;
    }
    if (showQ3Q4 && (!precisionFeature || !priceRange)) {
      setError('모든 질문에 답변해 주세요.');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/movement-test/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movementTestVersion: 'v2',
          resultMainAnimal: context.mainAnimal,
          resultType: context.resultType,
          axisScores: context.axisScores,
          accuracyFeel,
          wantsPrecision,
          precisionFeature: showQ3Q4 ? precisionFeature : null,
          precisionFeatureOther: showQ3Q4 && precisionFeature === 'other' ? precisionFeatureOther || null : null,
          priceRange: showQ3Q4 ? priceRange : null,
          priceOther: showQ3Q4 && priceRange === 'other' ? priceOther || null : null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? '제출에 실패했습니다.');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [
    accuracyFeel,
    wantsPrecision,
    precisionFeature,
    precisionFeatureOther,
    priceRange,
    priceOther,
    showQ3Q4,
    context,
  ]);

  if (submitted) {
    return (
      <NeoPageLayout maxWidth="md">
        <div className="py-12 sm:py-14 md:py-16">
          <NeoCard className="p-6 sm:p-8 text-center">
            <div className="text-4xl mb-4">🙌</div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2 whitespace-normal break-keep">
              소중한 의견 감사합니다!
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mb-6 whitespace-normal break-keep">
              덕분에 다음 버전이 더 정확하고 편해질 수 있어요.
            </p>
            <NeoButton variant="orange" className="w-full sm:w-auto min-h-[44px] px-8 py-4" onClick={() => router.push('/')}>
              홈으로
            </NeoButton>
          </NeoCard>
        </div>
      </NeoPageLayout>
    );
  }

  const optionBtn = (code: string, label: string, selected: boolean, onChange: () => void) => (
    <button
      key={code}
      type="button"
      onClick={onChange}
      className={`
        w-full min-h-[44px] text-left px-4 py-3 rounded-2xl
        border-2 transition-all
        ${
          selected
            ? 'border-slate-900 bg-orange-100 text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)]'
            : 'border-slate-900 bg-white text-slate-800 shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:border-orange-400'
        }
      `}
    >
      <span className="text-sm sm:text-base whitespace-normal break-keep">{label}</span>
    </button>
  );

  return (
    <NeoPageLayout maxWidth="md">
      <section className="mb-8 text-center py-10 sm:py-12 md:py-16">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-800 mb-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          테스트 평가하기
        </h1>
        <p className="text-sm sm:text-base text-slate-600 whitespace-normal break-keep">
          짧은 설문만 완료해 주시면 다음 버전 개선에 큰 도움이 됩니다
        </p>
      </section>

      <NeoCard className="p-4 sm:p-6 md:p-8">
            {/* Q1 */}
            <div className="mb-8">
              <label className="block text-sm sm:text-base font-semibold text-slate-800 mb-3">
                결과가 현재 상태와 어느 정도 잘 맞는다고 느끼셨나요?
              </label>
              <div className="space-y-2">
                {ACCURACY_OPTIONS.map((o) =>
                  optionBtn(o.code, o.label, accuracyFeel === o.code, () => setAccuracyFeel(o.code))
                )}
              </div>
            </div>

            {/* Q2 */}
            <div className="mb-8">
              <label className="block text-sm sm:text-base font-semibold text-slate-800 mb-3">
                조금 더 정확하게 확인할 수 있는 &apos;정밀 버전&apos;이 있다면 이용해보고 싶으신가요?
              </label>
              <p className="text-xs text-slate-500 mb-2">(예: 사진/영상 분석, 변화 추적 리포트 등)</p>
              <div className="space-y-2">
                {WANTS_PRECISION_OPTIONS.map((o) =>
                  optionBtn(o.code, o.label, wantsPrecision === o.code, () => setWantsPrecision(o.code))
                )}
              </div>
            </div>

            {/* Q3 - 숨김 when wants_precision === NO */}
            {showQ3Q4 && (
              <>
                <div className="mb-8">
                  <label className="block text-sm sm:text-base font-semibold text-slate-800 mb-3">
                    정밀 버전이 나온다면, 어떤 기능이 가장 끌리시나요?
                  </label>
                  <div className="space-y-2">
                    {PRECISION_FEATURE_OPTIONS.map((o) =>
                      optionBtn(o.code, o.label, precisionFeature === o.code, () => setPrecisionFeature(o.code))
                    )}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setPrecisionFeature('other')}
                        className={`
                          w-full min-h-[44px] text-left px-4 py-3 rounded-2xl
                          border-2 transition-all
                          ${
                            precisionFeature === 'other'
                              ? 'border-slate-900 bg-orange-100 shadow-[2px_2px_0_0_rgba(15,23,42,1)]'
                              : 'border-slate-900 bg-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:border-orange-400'
                          }
                        `}
                      >
                        <span className="text-sm">기타(직접입력)</span>
                      </button>
                      {precisionFeature === 'other' && (
                        <input
                          type="text"
                          placeholder="직접 입력해 주세요"
                          value={precisionFeatureOther}
                          onChange={(e) => setPrecisionFeatureOther(e.target.value)}
                          className={inputClass}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Q4 */}
                <div className="mb-8">
                  <label className="block text-sm sm:text-base font-semibold text-slate-800 mb-3">
                    방금 선택하신 기능이라면, 어느 정도 가격까지는 괜찮다고 느끼실까요?
                  </label>
                  <div className="space-y-2">
                    {PRICE_OPTIONS.map((o) =>
                      optionBtn(o.code, o.label, priceRange === o.code, () => setPriceRange(o.code))
                    )}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setPriceRange('other')}
                        className={`
                          w-full min-h-[44px] text-left px-4 py-3 rounded-2xl
                          border-2 transition-all
                          ${
                            priceRange === 'other'
                              ? 'border-slate-900 bg-orange-100 shadow-[2px_2px_0_0_rgba(15,23,42,1)]'
                              : 'border-slate-900 bg-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:border-orange-400'
                          }
                        `}
                      >
                        <span className="text-sm">기타(직접입력)</span>
                      </button>
                      {priceRange === 'other' && (
                        <input
                          type="text"
                          placeholder="직접 입력해 주세요"
                          value={priceOther}
                          onChange={(e) => setPriceOther(e.target.value)}
                          className={inputClass}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {error && (
              <p className="mb-4 text-sm text-slate-600">{error}</p>
            )}

            <div className="text-center">
              <NeoButton
                variant="orange"
                className="w-full sm:w-auto min-h-[44px] px-8 py-4"
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
              >
                {submitting ? '전송 중...' : '의견 보내기'}
              </NeoButton>
            </div>
      </NeoCard>
    </NeoPageLayout>
  );
}
