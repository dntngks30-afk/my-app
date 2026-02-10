"use client";

import { useState } from "react";

export default function AdminReportUploaderPage() {
  const [adminKey, setAdminKey] = useState("");
  const [payload, setPayload] = useState(`{
  "requestId": "",
  "userId": "",
  "diagnoses": ["거북목", "라운드숄더"],
  "inhibitContent": "예: 흉근/상부승모 억제",
  "lengthenContent": "예: 흉근 스트레칭",
  "activateContent": "예: 하부승모/전거근 활성화",
  "integrateContent": "예: 월슬라이드 + 호흡",
  "expertNotes": "예: 7일 루틴부터 진행하세요"
}`);
  const [result, setResult] = useState<string>("");

  const send = async () => {
    setResult("전송 중...");

    try {
      const res = await fetch("/api/admin/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: payload,
      });

      const json = await res.json();
      setResult(JSON.stringify({ status: res.status, json }, null, 2));
    } catch (e: any) {
      setResult(e?.message ?? "에러");
    }
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <h1 className="text-xl font-bold mb-4">관리자 리포트 POST 테스트</h1>

      <label className="block text-sm font-medium mb-1">ADMIN_API_KEY</label>
      <input
        value={adminKey}
        onChange={(e) => setAdminKey(e.target.value)}
        className="w-full border rounded p-2 mb-4"
        placeholder="env.local의 ADMIN_API_KEY 값을 그대로 붙여넣기"
      />

      <label className="block text-sm font-medium mb-1">POST Body (JSON)</label>
      <textarea
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        className="w-full border rounded p-2 font-mono text-xs h-64 mb-4"
      />

      <button
        onClick={send}
        className="px-4 py-2 rounded bg-black text-white"
      >
        /api/admin/report 로 POST 보내기
      </button>

      <pre className="mt-4 whitespace-pre-wrap bg-gray-100 p-3 rounded text-xs">
        {result}
      </pre>

      <p className="mt-4 text-sm">
        성공(200)이면 바로 <b>/my-report</b> 들어가서 조회 확인.
      </p>
    </div>
  );
}
