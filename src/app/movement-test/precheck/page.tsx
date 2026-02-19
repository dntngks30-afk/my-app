'use client';

/**
 * movement-test precheck 페이지 (PR3-2 PATCH)
 * 프로필 입력 메인 + 디스클레이머 상단 + 1분 자가 테스트 모달
 */
import { useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

const KEY = 'movementTestSession:v2';

/** 모달용 압축 자가 체크(4가지) */
const MODAL_CHECKS = [
  {
    icon: '🧱',
    title: '벽 정렬 체크 (10초)',
    steps: ['벽에 뒤꿈치·엉덩이·등 가볍게 붙이기', '턱 들지 말고 정면 보기', '10초 호흡 유지'],
    checkPoints: ['뒤통수 자연스럽게 벽에 닿나?', '목·어깨 불편하나?'],
  },
  {
    icon: '🪽',
    title: '벽 천사(팔 올리기) 5회',
    steps: ['등·엉덩이 벽에 붙이기', '팔 90도, 천천히 5회'],
    checkPoints: ['허리만 꺾이거나 갈비뼈 들리나?', '어깨 앞·겨드랑이 걸리나?'],
  },
  {
    icon: '🦶',
    title: '한발서기 좌/우 10초',
    steps: ['벽/의자 옆에서 한발 10초', '좌우 비교'],
    checkPoints: ['더 흔들리는 쪽?', '무릎 안쪽 말림 느낌?'],
  },
  {
    icon: '🌬️',
    title: '30초 호흡/긴장 체크',
    steps: ['어깨 힘 빼기', '코로 들이마시고 길게 내쉬기', '30초 몸 긴장 관찰'],
    checkPoints: ['턱·목·어깨 힘 들어가나?', '숨이 얕게 느껴지나?'],
  },
];

const EXP_OPTIONS = [
  { value: 0, label: '거의 없음', desc: '규칙적 운동 없음' },
  { value: 1, label: '가끔', desc: '주 1~2회' },
  { value: 2, label: '꾸준히', desc: '주 3회 이상' },
] as const;

const inputClass = `
  w-full min-h-[44px]
  rounded-[var(--radius)]
  bg-[var(--surface)]
  border border-[color:var(--border)]
  px-3 py-2
  text-sm sm:text-base text-[var(--text)]
  placeholder:text-[var(--muted)]
  shadow-[var(--shadow-0)]
  focus:outline-none
  focus:ring-2 focus:ring-[var(--brand)]
`;

export default function PrecheckPage() {
  const router = useRouter();
  const [guideOpen, setGuideOpen] = useState(false);
  const [profile, setProfile] = useState({
    age: '',
    gender: '',
    height: '',
    weight: '',
    expLevel: '' as '' | '0' | '1' | '2',
    mbti: '',
  });

  useEffect(() => {
    if (!guideOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [guideOpen]);

  useEffect(() => {
    if (!guideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGuideOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guideOpen]);

  const handleNext = useCallback(() => {
    const session = {
      version: 'v2' as const,
      isCompleted: false,
      startedAt: new Date().toISOString(),
      profile: {
        age: profile.age || undefined,
        gender: profile.gender || undefined,
        height: profile.height ? Number(profile.height) : undefined,
        weight: profile.weight ? Number(profile.weight) : undefined,
        expLevel: profile.expLevel !== '' ? Number(profile.expLevel) : undefined,
        mbti: profile.mbti || undefined,
      },
      answersById: {} as Record<string, 0 | 1 | 2 | 3 | 4>,
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(session));
    } catch (e) {
      console.error('session save failed:', e);
    }
    router.push('/movement-test/survey');
  }, [profile, router]);

  return (
    <div className="min-h-screen bg-[var(--bg)] overflow-x-hidden">
      {/* Hero/Header */}
      <section className="py-10 sm:py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--text)] mb-3"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              무료 움직임 테스트
            </h1>

            <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed whitespace-normal break-keep mb-6">
              본 테스트는 의학적 진단이 아닌, 움직임의 경향도를 체크하는 테스트입니다.
            </p>

            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="
                inline-flex items-center justify-center
                w-full sm:w-auto
                min-h-[44px]
                rounded-[var(--radius)]
                bg-[var(--brand)] text-white
                px-6 py-3 font-semibold
                shadow-[var(--shadow-0)]
                transition-all duration-200
                hover:opacity-95
                whitespace-normal break-keep
              "
            >
              정확도를 높이기 위한 1분 자가 테스트 방법
            </button>

            <p className="mt-3 text-xs text-[var(--muted)]">
              클릭하면 팝업으로 열려요.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-10 sm:pb-12 md:pb-16">
        <div className="max-w-2xl md:max-w-4xl mx-auto">
          {/* 프로필 입력 메인 카드 */}
          <section className="mb-8">
            <div
              className="
                rounded-[var(--radius)]
                bg-[var(--surface)]
                border border-[color:var(--border)]
                shadow-[var(--shadow-0)]
                p-4 sm:p-6 md:p-8
              "
            >
              <h2 className="text-lg sm:text-xl font-semibold text-[var(--text)] mb-4 sm:mb-6">
                프로필 <span className="text-[var(--muted)] text-xs sm:text-sm font-normal">(선택)</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm md:text-base text-[var(--text)] font-semibold mb-1">
                    나이 <span className="text-[var(--muted)] font-normal">(선택)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="예: 30"
                    value={profile.age}
                    onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm md:text-base text-[var(--text)] font-semibold mb-1">
                    성별 <span className="text-[var(--muted)] font-normal">(선택)</span>
                  </label>
                  <select
                    value={profile.gender}
                    onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">선택 안 함</option>
                    <option value="male">남성</option>
                    <option value="female">여성</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm md:text-base text-[var(--text)] font-semibold mb-1">
                    키 (cm) <span className="text-[var(--muted)] font-normal">(선택)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="예: 170"
                    value={profile.height}
                    onChange={(e) => setProfile((p) => ({ ...p, height: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm md:text-base text-[var(--text)] font-semibold mb-1">
                    체중 (kg) <span className="text-[var(--muted)] font-normal">(선택)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="예: 65"
                    value={profile.weight}
                    onChange={(e) => setProfile((p) => ({ ...p, weight: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm md:text-base text-[var(--text)] font-semibold mb-1">
                    운동경험 <span className="text-[var(--muted)] font-normal">(선택)</span>
                  </label>
                  <div className="space-y-2">
                    {EXP_OPTIONS.map((o) => (
                      <label
                        key={o.value}
                        className="flex items-center gap-3 min-h-[44px] p-3 rounded-[var(--radius)] border border-[color:var(--border)] bg-[var(--surface)] cursor-pointer hover:border-[color:var(--brand)]"
                      >
                        <input
                          type="radio"
                          name="expLevel"
                          value={o.value}
                          checked={profile.expLevel === String(o.value)}
                          onChange={() =>
                            setProfile((p) => ({
                              ...p,
                              expLevel: String(o.value) as '0' | '1' | '2',
                            }))
                          }
                          className="rounded-full border-[color:var(--border)] text-[var(--brand)] focus:ring-[var(--brand)]"
                        />
                        <span className="text-sm sm:text-base text-[var(--text)] font-medium whitespace-normal break-keep">
                          {o.label}
                        </span>
                        <span className="text-xs sm:text-sm text-[var(--muted)] whitespace-normal break-keep">
                          {o.desc}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm md:text-base text-[var(--text)] font-semibold mb-1">
                    MBTI <span className="text-[var(--muted)] font-normal">(선택)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="예: INFP"
                    value={profile.mbti}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, mbti: e.target.value.toUpperCase() }))
                    }
                    className={inputClass}
                    maxLength={4}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="text-center">
            <button
              type="button"
              onClick={handleNext}
              className="
                w-full sm:w-auto min-h-[44px]
                inline-flex items-center justify-center
                rounded-[var(--radius)]
                bg-[var(--brand)] text-white
                px-8 py-4
                text-sm sm:text-base font-bold
                shadow-[var(--shadow-0)]
                transition-all duration-200
                hover:opacity-95
              "
            >
              다음
            </button>
          </section>
        </div>
      </div>

      {/* 모달 */}
      {guideOpen && (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="닫기"
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setGuideOpen(false)}
            onKeyDown={(e) => e.key === 'Enter' && setGuideOpen(false)}
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            aria-modal
            aria-labelledby="modal-title"
          >
            <div
              className="
                pointer-events-auto
                max-w-lg w-[92%] sm:w-full
                max-h-[80vh] overflow-auto
                rounded-[var(--radius)]
                bg-[var(--surface)]
                border border-[color:var(--border)]
                shadow-[var(--shadow-0)]
                relative
              "
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex justify-end p-3 bg-[var(--surface)] border-b border-[color:var(--border)]">
                <button
                  type="button"
                  onClick={() => setGuideOpen(false)}
                  className="
                    min-w-[44px] min-h-[44px]
                    flex items-center justify-center
                    rounded-[var(--radius)]
                    text-[var(--muted)] hover:text-[var(--text)]
                  "
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <h2 id="modal-title" className="text-lg font-bold text-[var(--text)] mb-4 whitespace-normal break-keep">
                  정확도를 높이기 위한 1분 자가 테스트 방법
                </h2>
                <div className="space-y-4">
                  {MODAL_CHECKS.map((item) => (
                    <details
                      key={item.title}
                      className="rounded-[var(--radius)] border border-[color:var(--border)] overflow-hidden"
                    >
                      <summary className="flex items-center gap-2 p-3 cursor-pointer list-none bg-[var(--bg)] hover:bg-[var(--surface)]">
                        <span className="text-xl">{item.icon}</span>
                        <span className="font-semibold text-[var(--text)] whitespace-normal break-keep">
                          {item.title}
                        </span>
                      </summary>
                      <div className="p-3 pt-0 space-y-2">
                        <p className="text-xs sm:text-sm font-medium text-[var(--text)]">따라하기:</p>
                        <ul className="text-xs sm:text-sm text-[var(--muted)] list-disc list-inside space-y-0.5 whitespace-normal break-keep">
                          {item.steps.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                        <p className="text-xs sm:text-sm font-medium text-[var(--text)] pt-1">
                          체크 포인트:
                        </p>
                        <ul className="text-xs sm:text-sm text-[var(--muted)] space-y-1 whitespace-normal break-keep">
                          {item.checkPoints.map((c, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="shrink-0">☐</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  ))}
                </div>
                <p className="mt-4 text-xs sm:text-sm text-[var(--muted)] text-center whitespace-normal break-keep">
                  방금 느낀 감각을 기억한 채로 다음 설문을 진행해요.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
