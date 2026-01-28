 "use client";

import { useEffect, useState } from "react";

type RequestRow = {
  id: string;
  user_id: string;
  front_url?: string;
  side_url?: string;
  status?: string;
  created_at?: string;
};

export default function AdminPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagnoses, setDiagnoses] = useState<Record<string, boolean>>({
    turtle: false,
    rounded: false,
    lordosis: false,
  });

  const fetchRequests = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/requests");
    const json = await res.json();
    setRows(json.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const openDetail = (row: RequestRow) => {
    setSelected(row);
    setDiagnoses({ turtle: false, rounded: false, lordosis: false });
  };

  const toggleDiag = (key: string) => {
    setDiagnoses((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const confirmSolution = async () => {
    if (!selected) return;
    setLoading(true);
    const res = await fetch("/api/admin/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: selected.id,
        diagnoses: Object.entries(diagnoses)
          .filter(([, v]) => v)
          .map(([k]) =>
            k === "turtle" ? "거북목" : k === "rounded" ? "라운드숄더" : "요추전만"
          ),
      }),
    });
    const json = await res.json();
    if (json.ok) {
      // 새로고침
      await fetchRequests();
      setSelected(null);
    } else {
      alert("에러: " + (json.error || "unknown"));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">관리자 대시보드</h1>
          <button
            onClick={fetchRequests}
            className="rounded bg-[#f97316] px-4 py-2 font-medium text-slate-950"
          >
            새로고침
          </button>
        </header>

        <section className="rounded bg-slate-900/80 p-4">
          <h2 className="mb-3 text-lg font-semibold">요청 목록 (최신순)</h2>
          {loading && <p className="text-sm text-slate-400">로딩 중...</p>}
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex cursor-pointer items-center justify-between rounded border border-slate-700/60 p-3 hover:bg-slate-800/60"
                onClick={() => openDetail(r)}
              >
                <div>
                  <div className="text-sm font-medium">요청 ID: {r.id}</div>
                  <div className="text-xs text-slate-400">사용자: {r.user_id}</div>
                </div>
                <div className="text-xs text-slate-400">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {selected && (
          <section className="rounded bg-slate-900/80 p-4">
            <h2 className="mb-3 text-lg font-semibold">요청 상세</h2>
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="flex-1 space-y-2">
                <div className="rounded bg-slate-800 p-3 text-center">
                  <p className="mb-2 text-sm font-medium">정면 사진</p>
                  {selected.front_url ? (
                    // 이미지가 크도록 표시
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.front_url}
                      alt="front"
                      className="mx-auto max-h-96 w-auto rounded"
                    />
                  ) : (
                    <div className="h-48 rounded bg-slate-700/50" />
                  )}
                </div>

                <div className="rounded bg-slate-800 p-3 text-center">
                  <p className="mb-2 text-sm font-medium">측면 사진</p>
                  {selected.side_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.side_url}
                      alt="side"
                      className="mx-auto max-h-96 w-auto rounded"
                    />
                  ) : (
                    <div className="h-48 rounded bg-slate-700/50" />
                  )}
                </div>
              </div>

              <aside className="w-full max-w-xs space-y-4">
                <div className="rounded border border-slate-700/60 p-3">
                  <p className="mb-2 font-medium">진단 체크</p>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={diagnoses.turtle}
                      onChange={() => toggleDiag("turtle")}
                    />
                    <span className="text-sm">거북목</span>
                  </label>
                  <label className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={diagnoses.rounded}
                      onChange={() => toggleDiag("rounded")}
                    />
                    <span className="text-sm">라운드숄더</span>
                  </label>
                  <label className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={diagnoses.lordosis}
                      onChange={() => toggleDiag("lordosis")}
                    />
                    <span className="text-sm">요추전만</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={confirmSolution}
                    className="w-full rounded bg-[#f97316] px-4 py-2 font-semibold text-slate-950"
                  >
                    솔루션 확정
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="w-full rounded border border-slate-700/60 px-4 py-2 text-sm"
                  >
                    닫기
                  </button>
                </div>
              </aside>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

