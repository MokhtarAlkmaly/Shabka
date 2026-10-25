import { useRef, useState } from "react";
import type { DataSource } from "../lib/towers";

interface Props {
  open: boolean;
  source: DataSource;
  apiKey: string;
  csvInfo: string | null;
  onClose: () => void;
  onApply: (source: DataSource, apiKey: string) => void;
  onCsvFile: (file: File) => Promise<void>;
}

export default function SettingsModal({ open, source, apiKey, csvInfo, onClose, onApply, onCsvFile }: Props) {
  const [src, setSrc] = useState<DataSource>(source);
  const [key, setKey] = useState(apiKey);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const options: { id: DataSource; title: string; desc: string }[] = [
    {
      id: "simulated",
      title: "بيانات تقديرية (تجريبية)",
      desc: "أبراج مولدة بنموذج تقديري لتجربة التطبيق بدون إنترنت أو مفتاح API. لا تمثل مواقع حقيقية.",
    },
    {
      id: "opencellid",
      title: "OpenCellID API (بيانات حقيقية)",
      desc: "جلب مواقع الأبراج الحقيقية من قاعدة OpenCellID المفتوحة حول موقعك. يتطلب مفتاح API مجاني.",
    },
    {
      id: "csv",
      title: "ملف OpenCellID (بدون إنترنت)",
      desc: "رفع ملف اليمن 421.csv.gz من OpenCellID لعرض كل الأبراج المعروفة في اليمن محلياً.",
    },
  ];

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-800">مصدر بيانات الأبراج</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="إغلاق">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-2">
          {options.map((o) => (
            <label
              key={o.id}
              className={`block cursor-pointer rounded-2xl border-2 p-3 transition ${
                src === o.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <input type="radio" name="src" checked={src === o.id} onChange={() => setSrc(o.id)} className="accent-emerald-600" />
                <span className="font-bold text-slate-800">{o.title}</span>
              </div>
              <p className="mt-1 pr-6 text-xs leading-relaxed text-slate-600">{o.desc}</p>
            </label>
          ))}
        </div>

        {src === "opencellid" && (
          <div className="mt-4 space-y-2">
            <label className="text-sm font-semibold text-slate-700">مفتاح OpenCellID API</label>
            <input
              dir="ltr"
              value={key}
              onChange={(e) => setKey(e.target.value.trim())}
              placeholder="pk.xxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
            <p className="text-xs leading-relaxed text-slate-500">
              احصل على مفتاح مجاني من{" "}
              <a href="https://opencellid.org/register.php" target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 underline">
                opencellid.org
              </a>
              . يُحفظ المفتاح في متصفحك فقط.
            </p>
          </div>
        )}

        {src === "csv" && (
          <div className="mt-4 space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.gz,text/csv"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBusy(true);
                setErr(null);
                try {
                  await onCsvFile(f);
                } catch (ex) {
                  setErr((ex as Error).message);
                } finally {
                  setBusy(false);
                  e.target.value = "";
                }
              }}
            />
            <button
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-slate-300 py-4 text-sm font-semibold text-slate-600 hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-60"
            >
              {busy ? "جارٍ قراءة الملف..." : "اختر ملف 421.csv أو 421.csv.gz"}
            </button>
            {csvInfo && <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">{csvInfo}</p>}
            {err && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{err}</p>}
            <p className="text-xs leading-relaxed text-slate-500">
              حمّل ملف اليمن من صفحة{" "}
              <a href="https://opencellid.org/downloads.php" target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 underline">
                التنزيلات في OpenCellID
              </a>{" "}
              (MCC 421).
            </p>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => onApply(src, key)}
            disabled={(src === "opencellid" && !key) || (src === "csv" && !csvInfo)}
            className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-bold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            تطبيق
          </button>
          <button onClick={onClose} className="rounded-xl bg-slate-100 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-200">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
