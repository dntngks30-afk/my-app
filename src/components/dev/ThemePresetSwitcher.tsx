/**
 * 테마 프리셋 스위처
 * 
 * 개발 모드에서만 표시되는 테마 선택 오버레이
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { THEME_PRESETS, THEME_STORAGE_KEY, getPreset, type ThemePresetId } from '@/lib/themePresets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export default function ThemePresetSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [committedTheme, setCommittedTheme] = useState<ThemePresetId>('clean');
  const [previewTheme, setPreviewTheme] = useState<ThemePresetId | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ input: '', select: '', checkbox: false });
  const [activeTab, setActiveTab] = useState('tab1');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 개발 모드가 아니면 표시하지 않음
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    // 저장된 테마 로드
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    const themeId = saved ? (JSON.parse(saved) as ThemePresetId) : 'clean';
    if (THEME_PRESETS.some((p) => p.id === themeId)) {
      setCommittedTheme(themeId);
      applyTokens(themeId);
    } else {
      applyTokens('clean');
    }
  }, []);

  useEffect(() => {
    // Esc 키로 패널 닫기
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setPreviewTheme(null);
        applyTokens(committedTheme);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, committedTheme]);

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
      applyTokens(committedTheme);
    }
  };

  const handlePresetClick = (themeId: ThemePresetId) => {
    setCommittedTheme(themeId);
    setPreviewTheme(null);
    applyTokens(themeId);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeId));
  };

  const handleToast = () => {
    toast.success('토스트 메시지입니다!');
  };

  const filteredPresets = THEME_PRESETS.filter((preset) =>
    preset.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    preset.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 프로덕션에서는 렌더링하지 않음
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90 transition-all"
      >
        🎨 테마
      </button>

      {/* 패널 오버레이 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            ref={panelRef}
            className="bg-card text-card-foreground rounded-xl border shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* 헤더 */}
            <div className="border-b p-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">테마 프리셋 선택</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  현재 적용: <Badge variant="secondary">{THEME_PRESETS.find((p) => p.id === committedTheme)?.label}</Badge>
                </p>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setPreviewTheme(null);
                  applyTokens(committedTheme);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {/* 검색 */}
            <div className="p-4 border-b">
              <Input
                placeholder="프리셋 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4 mb-6">
                {filteredPresets.map((preset) => (
                  <Card
                    key={preset.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      committedTheme === preset.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onMouseEnter={() => handlePresetHover(preset.id)}
                    onMouseLeave={handlePresetLeave}
                    onClick={() => handlePresetClick(preset.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{preset.label}</CardTitle>
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{
                            backgroundColor: `hsl(${preset.tokens.primary})`,
                          }}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">{preset.desc}</p>
                      <div className="flex gap-2">
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
                      {committedTheme === preset.id && (
                        <div className="mt-2 text-xs text-primary font-medium">✓ 적용됨</div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* 미니 프리뷰 섹션 */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold mb-4">미니 프리뷰</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 버튼 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">버튼</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button variant="default">Primary</Button>
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="outline">Outline</Button>
                    </CardContent>
                  </Card>

                  {/* 카드 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">카드</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Card className="mb-2">
                        <CardHeader>
                          <CardTitle className="text-sm">카드 제목</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">카드 본문 내용</p>
                          <Badge className="mt-2">배지</Badge>
                        </CardContent>
                      </Card>
                    </CardContent>
                  </Card>

                  {/* 탭 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">탭</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                          <TabsTrigger value="tab1">탭 1</TabsTrigger>
                          <TabsTrigger value="tab2">탭 2</TabsTrigger>
                        </TabsList>
                        <TabsContent value="tab1">탭 1 내용</TabsContent>
                        <TabsContent value="tab2">탭 2 내용</TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>

                  {/* 폼 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">폼</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Input
                        placeholder="입력..."
                        value={formData.input}
                        onChange={(e) => setFormData({ ...formData, input: e.target.value })}
                      />
                      <Select
                        value={formData.select}
                        onChange={(e) => setFormData({ ...formData, select: e.target.value })}
                      >
                        <option value="">선택...</option>
                        <option value="1">옵션 1</option>
                        <option value="2">옵션 2</option>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={formData.checkbox}
                          onChange={(e) => setFormData({ ...formData, checkbox: e.target.checked })}
                        />
                        <label className="text-sm">체크박스</label>
                      </div>
                      <Button onClick={() => handleToast()}>제출</Button>
                    </CardContent>
                  </Card>

                  {/* 토스트 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">토스트</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={handleToast}>토스트 표시</Button>
                    </CardContent>
                  </Card>

                  {/* 모달 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">모달</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogTrigger asChild>
                          <Button>모달 열기</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>모달 제목</DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-muted-foreground">
                            이것은 모달 내용입니다.
                          </p>
                          <DialogClose />
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
