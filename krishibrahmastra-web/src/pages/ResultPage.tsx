import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alternative {
  name: string;
  type: string;
  efficacyRating: number;
  preparationSteps: string[];
  pros: string[];
  cons: string[];
}

interface ScanResult {
  id: string;
  status: string;
  matchedChemical: string | null;
  confidence: number | null;
  imageUrl: string | null;
  createdAt: string;
}

interface AlternativesData {
  chemical: string;
  category: string;
  alternatives: Alternative[];
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
  );
}

function ResultSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

// ─── Share helper ─────────────────────────────────────────────────────────────

async function shareResults(chemical: string, alts: Alternative[]) {
  const altList = alts.map((a) => `• ${a.name} (${a.type})`).join("\n");
  const text = `Krishi Brahmastra identified: ${chemical}\n\nBio-alternatives:\n${altList}\n\nTry the app: ${window.location.origin}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: `Bio-swap for ${chemical}`, text });
    } catch {
      /* user cancelled */
    }
  } else {
    await navigator.clipboard.writeText(text);
    alert("Results copied to clipboard!");
  }
}

// ─── Alternative card ─────────────────────────────────────────────────────────

function AlternativeCard({ alt, index }: { alt: Alternative; index: number }) {
  const typeColors: Record<string, string> = {
    Botanical: "bg-green-100 text-green-700",
    Microbial: "bg-blue-100 text-blue-700",
    Mineral: "bg-amber-100 text-amber-700",
  };
  const tagColor = typeColors[alt.type] ?? "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Card header */}
      <div className="p-5 pb-4 border-b border-gray-50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-full bg-green-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
                {index + 1}
              </span>
              <h3 className="text-base font-semibold text-gray-900">{alt.name}</h3>
            </div>
            <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full ${tagColor}`}>
              {alt.type}
            </span>
          </div>
          {/* Efficacy stars */}
          <div className="shrink-0 text-right">
            <div className="flex gap-0.5 justify-end">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={
                    i < Math.round(alt.efficacyRating)
                      ? "text-yellow-400 text-sm"
                      : "text-gray-200 text-sm"
                  }
                >
                  ★
                </span>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">efficacy</p>
          </div>
        </div>
      </div>

      {/* Preparation steps — numbered timeline */}
      <div className="px-5 pt-4 pb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          How to prepare
        </p>
        <ol className="space-y-3">
          {alt.preparationSteps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-green-50 border border-green-200 text-green-700 text-[11px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Pros & Cons */}
      <div className="px-5 pt-2 pb-5 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-green-700 mb-2">Pros</p>
          <div className="space-y-1.5">
            {alt.pros.map((p, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-green-500 text-xs mt-0.5 shrink-0">✓</span>
                <p className="text-xs text-gray-600 leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-red-600 mb-2">Cons</p>
          <div className="space-y-1.5">
            {alt.cons.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-red-400 text-xs mt-0.5 shrink-0">✗</span>
                <p className="text-xs text-gray-600 leading-relaxed">{c}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ResultPage ──────────────────────────────────────────────────────────

export function ResultPage() {
  const { id: scanId } = useParams<{ id: string }>();

  const { data: scan, isLoading: isScanLoading } = useQuery<ScanResult>({
    queryKey: ["scan", scanId],
    queryFn: () => apiClient.get(`/api/v1/scan/${scanId}`).then((r) => r.data),
  });

  const { data: altsData, isLoading: isAltLoading } = useQuery<AlternativesData>({
    queryKey: ["alternatives", scan?.matchedChemical],
    queryFn: () =>
      apiClient
        .get(`/api/v1/alternatives/${scan!.matchedChemical}`)
        .then((r) => r.data),
    enabled:
      !!scan?.matchedChemical && scan.matchedChemical !== "UNKNOWN",
  });

  const isLoading =
    isScanLoading ||
    (isAltLoading &&
      !!scan?.matchedChemical &&
      scan.matchedChemical !== "UNKNOWN");

  if (isLoading) return <ResultSkeleton />;

  const alternatives = altsData?.alternatives ?? [];

  return (
    <div className="p-4 pb-8 space-y-4">

      {/* ── Scan image ───────────────────────────────────────────────── */}
      {scan?.imageUrl && (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <img
            src={scan.imageUrl}
            alt="Scanned bottle label"
            className="w-full object-cover max-h-56"
            loading="lazy"
          />
          <p className="text-[11px] text-gray-400 px-4 py-2 border-t border-gray-50">
            Scanned on {new Date(scan.createdAt).toLocaleString("en-IN")}
          </p>
        </div>
      )}

      {/* ── Chemical header ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
              Detected Chemical
            </p>
            <h1 className="text-2xl font-bold text-green-900 leading-tight break-words">
              {scan?.matchedChemical ?? "Unknown"}
            </h1>
            {altsData?.category && (
              <span className="inline-block mt-2 text-xs font-medium bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-100">
                {altsData.category}
              </span>
            )}
          </div>

          {/* Share button */}
          {alternatives.length > 0 && (
            <button
              id="share-results-btn"
              onClick={() => shareResults(scan!.matchedChemical!, alternatives)}
              className="shrink-0 flex items-center gap-1.5 bg-green-50 text-green-700 text-sm font-medium px-3 py-2 rounded-xl hover:bg-green-100 active:scale-95 transition-all border border-green-100"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="16 6 12 2 8 6" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="2" x2="12" y2="15" strokeLinecap="round" />
              </svg>
              Share
            </button>
          )}
        </div>

        {/* Confidence bar */}
        {scan?.confidence != null && scan.confidence > 0 && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-xs text-gray-500">Match confidence</p>
              <p className="text-xs font-semibold text-gray-700">
                {Math.round(scan.confidence * 100)}%
              </p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-700"
                style={{ width: `${(scan.confidence ?? 0) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Unknown chemical warning ─────────────────────────────────── */}
      {scan?.matchedChemical === "UNKNOWN" && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth={2} className="w-5 h-5 mt-0.5 shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" />
              <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
            </svg>
            <div>
              <p className="text-amber-900 font-semibold text-sm">Couldn't read the label clearly</p>
              <p className="text-amber-700 text-xs mt-1">
                Try again with a clearer, well-lit photo. Make sure the chemical name is fully visible.
              </p>
            </div>
          </div>
          <Link
            to="/scan"
            className="mt-3 w-full block text-center bg-amber-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            Scan Again
          </Link>
        </div>
      )}

      {/* ── Bio-alternative cards ────────────────────────────────────── */}
      {alternatives.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
              {alternatives.length} Bio-Alternative{alternatives.length !== 1 ? "s" : ""}
            </p>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {alternatives.map((alt, i) => (
            <AlternativeCard key={i} alt={alt} index={i} />
          ))}
        </div>
      )}

      {/* ── No alternatives found ────────────────────────────────────── */}
      {!isAltLoading &&
        alternatives.length === 0 &&
        scan?.matchedChemical &&
        scan.matchedChemical !== "UNKNOWN" && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-center">
            <p className="text-gray-600 font-medium text-sm">
              No alternatives found for {scan.matchedChemical}
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Check back later or contact your local BRC.
            </p>
            <Link
              to="/brc-finder"
              className="inline-block mt-3 bg-green-700 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors"
            >
              Find nearest BRC →
            </Link>
          </div>
        )}

      {/* ── Footer actions ───────────────────────────────────────────── */}
      <div className="flex gap-3 pt-2">
        <Link
          to="/history"
          className="flex-1 text-center py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          View History
        </Link>
        <Link
          to="/scan"
          className="flex-1 text-center py-3 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition-colors"
        >
          New Scan
        </Link>
      </div>
    </div>
  );
}
