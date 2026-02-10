/**
 * UI Lab 페이지
 * 
 * 개발 모드에서만 접근 가능한 UI 프리셋 테스트 페이지
 */

'use client';

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { THEME_PRESETS, THEME_STORAGE_KEY, getPreset, type ThemePresetId } from '@/lib/themePresets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function UILabPage() {
  const [selectedTheme, setSelectedTheme] = useState<ThemePresetId>('clean');
  const [previewTheme, setPreviewTheme] = useState<ThemePresetId | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 프로덕션에서는 404
    if (process.env.NODE_ENV === 'production') {
      notFound();
      return;
    }

    setMounted(true);

    // 저장된 테마 로드
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    const themeId = saved ? (JSON.parse(saved) as ThemePresetId) : 'clean';
    if (THEME_PRESETS.some((p) => p.id === themeId)) {
      setSelectedTheme(themeId);
      applyTokens(themeId);
    } else {
      applyTokens('clean');
    }
  }, []);

  const applyTokens = (themeId: ThemePresetId) => {
    const preset = getPreset(themeId);
    if (!preset) return;

    const root = document.documentElement;
    const t = preset.tokens;

    // shadcn 토큰 인라인 주입 (HSL 값만, hsl() 함수 없이)
    root.style.setProperty('--radius', t.radius);
    root.style.setProperty('--background', t.background);
    root.style.setProperty('--foreground', t.foreground);
    root.style.setProperty('--card', t.card);
    root.style.setProperty('--card-foreground', t.cardForeground);
    root.style.setProperty('--primary', t.primary);
    root.style.setProperty('--primary-foreground', t.primaryForeground);
    root.style.setProperty('--muted', t.muted);
    root.style.setProperty('--muted-foreground', t.mutedForeground);
    root.style.setProperty('--border', t.border);
    root.style.setProperty('--ring', t.ring);

    // 디버그: 배경색 강제 적용 (확인 후 제거 가능)
    document.body.style.background = `hsl(${t.background})`;
  };

  const handlePresetHover = (themeId: ThemePresetId) => {
    setPreviewTheme(themeId);
    applyTokens(themeId);
  };

  const handlePresetLeave = () => {
    if (previewTheme) {
      setPreviewTheme(null);
      applyTokens(selectedTheme);
    }
  };

  const handlePresetClick = (themeId: ThemePresetId) => {
    setSelectedTheme(themeId);
    setPreviewTheme(null);
    applyTokens(themeId);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeId));
  };

  if (!mounted) {
    return null;
  }

  const currentThemeLabel = THEME_PRESETS.find((p) => p.id === selectedTheme)?.label || '클린';

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">UI Lab</h1>
          <p className="text-muted-foreground mb-2">
            프리셋을 hover하면 미리보기, click하면 적용됩니다
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">현재 테마:</span>
            <Badge variant="secondary">{currentThemeLabel}</Badge>
          </div>
        </div>

        {/* 프리셋 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12">
          {THEME_PRESETS.map((preset) => (
            <Card
              key={preset.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedTheme === preset.id ? 'ring-2 ring-primary' : ''
              }`}
              onMouseEnter={() => handlePresetHover(preset.id)}
              onMouseLeave={handlePresetLeave}
              onClick={() => handlePresetClick(preset.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-lg">{preset.label}</CardTitle>
                  <div
                    className="w-6 h-6 rounded-full border-2"
                    style={{
                      backgroundColor: `hsl(${preset.tokens.primary})`,
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{preset.desc}</p>
              </CardHeader>
              <CardContent>
                {/* 미니 샘플 */}
                <div className="flex gap-2 flex-wrap mb-2">
                  <Button size="sm" variant="default" className="text-xs">
                    버튼
                  </Button>
                  <Badge variant="secondary" className="text-xs">
                    배지
                  </Badge>
                  <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                    칩
                  </span>
                </div>
                {selectedTheme === preset.id && (
                  <div className="text-xs text-primary font-medium">✓ 적용됨</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 실제 서비스 핵심 섹션 샘플 */}
        <div className="border-t pt-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">실제 서비스 샘플</h2>

          {/* 헤더 샘플 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>헤더</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="text-lg font-bold">PostureLab</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">로그인</Button>
                  <Button variant="default" size="sm">회원가입</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 탭 샘플 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>탭</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 border-b">
                <button className="px-4 py-2 border-b-2 border-primary font-medium">움직임 테스트</button>
                <button className="px-4 py-2 text-muted-foreground">심층분석</button>
                <button className="px-4 py-2 text-muted-foreground">아티클</button>
              </div>
            </CardContent>
          </Card>

          {/* 카드 4개 그리드 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>카드 그리드</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <CardTitle className="text-base">카드 {i}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">카드 내용</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 설문 1문항 샘플 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>설문 샘플</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">질문 1</h3>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">선택지 1</Button>
                    <Button variant="outline" className="w-full justify-start">선택지 2</Button>
                    <Button variant="outline" className="w-full justify-start">선택지 3</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 결과 카드 샘플 */}
          <Card>
            <CardHeader>
              <CardTitle>결과 카드</CardTitle>
            </CardHeader>
            <CardContent>
              <Card className="bg-primary/5 border-primary">
                <CardHeader>
                  <CardTitle>결과 제목</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">결과 설명</p>
                  <div className="flex gap-2">
                    <Button variant="default">액션 1</Button>
                    <Button variant="outline">액션 2</Button>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
