import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuthStore } from "../store/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Chemical {
  id: string;
  name: string;
  category: string;
  commonNames: string[];
  isActive: boolean;
  alternatives: Alternative[];
}

interface Alternative {
  id: string;
  name: string;
  type: string;
  efficacyRating: number;
  preparationSteps: string[];
  pros: string[];
  cons: string[];
}

interface BRC {
  id: string;
  name: string;
  operatorType: string;
  address: string;
  contactNumber: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

interface Scan {
  id: string;
  status: string;
  matchedChemical: string | null;
  confidence: number | null;
  createdAt: string;
  user?: { name: string; email: string };
  errorMessage?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TABS = ["Stats", "Chemicals", "BRC Centers", "Scans"] as const;
type Tab = (typeof TABS)[number];

const statusColor: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  PENDING: "bg-yellow-100 text-yellow-800",
};

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={3}
      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none"
    />
  );
}

function SubmitBtn({
  loading,
  label,
}: {
  loading: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-green-700 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors"
    >
      {loading ? "Saving..." : label}
    </button>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab() {
  const { data: chemicals } = useQuery<Chemical[]>({
    queryKey: ["admin-chemicals"],
    queryFn: () => apiClient.get("/api/v1/admin/chemicals").then((r) => r.data),
  });
  const { data: scansData } = useQuery<{ data: Scan[]; total: number }>({
    queryKey: ["admin-scans", { limit: 200 }],
    queryFn: () =>
      apiClient.get("/api/v1/admin/scans?limit=200").then((r) => r.data),
  });
  const { data: brcs } = useQuery<BRC[]>({
    queryKey: ["admin-brc"],
    queryFn: () => apiClient.get("/api/v1/admin/brc").then((r) => r.data),
  });

  const scans = scansData?.data ?? [];
  const byStatus = scans.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  const stats = [
    { label: "Chemicals", value: chemicals?.length ?? "—", color: "bg-green-50 text-green-700" },
    { label: "BRC Centers", value: brcs?.length ?? "—", color: "bg-blue-50 text-blue-700" },
    { label: "Total Scans", value: scansData?.total ?? "—", color: "bg-purple-50 text-purple-700" },
    { label: "Completed", value: byStatus["COMPLETED"] ?? 0, color: "bg-emerald-50 text-emerald-700" },
    { label: "Failed", value: byStatus["FAILED"] ?? 0, color: "bg-red-50 text-red-700" },
    { label: "Pending / Processing", value: (byStatus["PENDING"] ?? 0) + (byStatus["PROCESSING"] ?? 0), color: "bg-amber-50 text-amber-700" },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-800">Overview</h2>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={`${s.color} rounded-2xl p-4`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs mt-1 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chemicals Tab ────────────────────────────────────────────────────────────

function ChemicalsTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [altFormId, setAltFormId] = useState<string | null>(null);

  const { data: chemicals = [], isLoading } = useQuery<Chemical[]>({
    queryKey: ["admin-chemicals"],
    queryFn: () => apiClient.get("/api/v1/admin/chemicals").then((r) => r.data),
  });

  const addChemical = useMutation({
    mutationFn: (body: { name: string; category: string; commonNames: string[] }) =>
      apiClient.post("/api/v1/admin/chemicals", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-chemicals"] });
      setShowAdd(false);
    },
  });

  const addAlt = useMutation({
    mutationFn: ({ chemId, body }: { chemId: string; body: Record<string, unknown> }) =>
      apiClient.post(`/api/v1/admin/chemicals/${chemId}/alternatives`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-chemicals"] });
      setAltFormId(null);
    },
  });

  const handleAddChemical = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    addChemical.mutate({
      name: f.get("name") as string,
      category: f.get("category") as string,
      commonNames: (f.get("commonNames") as string)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    e.currentTarget.reset();
  };

  const handleAddAlt = (e: React.FormEvent<HTMLFormElement>, chemId: string) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const split = (key: string) =>
      (f.get(key) as string)
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    addAlt.mutate({
      chemId,
      body: {
        name: f.get("name") as string,
        type: f.get("type") as string,
        efficacyRating: parseFloat(f.get("efficacyRating") as string),
        preparationSteps: split("preparationSteps"),
        pros: split("pros"),
        cons: split("cons"),
      },
    });
    e.currentTarget.reset();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          Chemicals ({chemicals.length})
        </h2>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-sm bg-green-700 text-white px-4 py-2 rounded-xl font-medium hover:bg-green-800 transition-colors"
        >
          {showAdd ? "Cancel" : "+ Add Chemical"}
        </button>
      </div>

      {showAdd && (
        <SectionCard>
          <p className="text-sm font-semibold text-gray-700 mb-3">New Chemical</p>
          <form onSubmit={handleAddChemical} className="space-y-3">
            <div>
              <Label>Name (e.g. IMIDACLOPRID)</Label>
              <Input name="name" required placeholder="IMIDACLOPRID" />
            </div>
            <div>
              <Label>Category</Label>
              <Input name="category" required placeholder="Insecticide" />
            </div>
            <div>
              <Label>Common Brand Names (comma-separated)</Label>
              <Input name="commonNames" placeholder="Confidor, Gaucho" />
            </div>
            <SubmitBtn loading={addChemical.isPending} label="Add Chemical" />
            {addChemical.isError && (
              <p className="text-red-500 text-xs">
                {(addChemical.error as any)?.response?.data?.detail ?? "Failed to add chemical"}
              </p>
            )}
          </form>
        </SectionCard>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

      <div className="space-y-3">
        {chemicals.map((chem) => (
          <SectionCard key={chem.id}>
            {/* Chemical header */}
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setExpandedId(expandedId === chem.id ? null : chem.id)}
            >
              <div className="text-left">
                <p className="font-semibold text-gray-800">{chem.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {chem.category} · {chem.alternatives?.length ?? 0} alternatives
                </p>
              </div>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  expandedId === chem.id ? "rotate-180" : ""
                }`}
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Expanded: alternatives + add form */}
            {expandedId === chem.id && (
              <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                {chem.alternatives?.map((alt) => (
                  <div key={alt.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-800">{alt.name}</p>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {alt.type}
                      </span>
                    </div>
                    <div className="flex gap-0.5 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className={
                            i < Math.round(alt.efficacyRating)
                              ? "text-yellow-400 text-xs"
                              : "text-gray-200 text-xs"
                          }
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Add Alternative */}
                {altFormId === chem.id ? (
                  <form
                    onSubmit={(e) => handleAddAlt(e, chem.id)}
                    className="space-y-3 bg-green-50 rounded-xl p-4"
                  >
                    <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">
                      New Alternative
                    </p>
                    <div>
                      <Label>Name</Label>
                      <Input name="name" required placeholder="Neem Oil" />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Input name="type" required placeholder="Botanical / Microbial / Mineral" />
                    </div>
                    <div>
                      <Label>Efficacy Rating (0–5)</Label>
                      <Input name="efficacyRating" type="number" step="0.5" min="0" max="5" required placeholder="4.0" />
                    </div>
                    <div>
                      <Label>Preparation Steps (one per line)</Label>
                      <Textarea name="preparationSteps" required placeholder={"Mix 5ml per litre of water\nSpray at dusk"} />
                    </div>
                    <div>
                      <Label>Pros (one per line)</Label>
                      <Textarea name="pros" required placeholder={"Safe for bees\nNo residue"} />
                    </div>
                    <div>
                      <Label>Cons (one per line)</Label>
                      <Textarea name="cons" required placeholder={"Degrades in rain\nNeeds repeat application"} />
                    </div>
                    <div className="flex gap-2">
                      <SubmitBtn loading={addAlt.isPending} label="Add Alternative" />
                      <button
                        type="button"
                        onClick={() => setAltFormId(null)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {addAlt.isError && (
                      <p className="text-red-500 text-xs">Failed to add alternative.</p>
                    )}
                  </form>
                ) : (
                  <button
                    onClick={() => setAltFormId(chem.id)}
                    className="w-full py-2 border-2 border-dashed border-green-300 rounded-xl text-sm text-green-700 hover:bg-green-50 transition-colors"
                  >
                    + Add Alternative
                  </button>
                )}
              </div>
            )}
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

// ─── BRC Tab ─────────────────────────────────────────────────────────────────

function BRCTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: brcs = [], isLoading } = useQuery<BRC[]>({
    queryKey: ["admin-brc"],
    queryFn: () =>
      apiClient
        .get("/api/v1/admin/brc?include_inactive=true")
        .then((r) => r.data),
  });

  const addBRC = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post("/api/v1/admin/brc", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-brc"] });
      setShowAdd(false);
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.put(`/api/v1/admin/brc/${id}`, { isActive }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-brc"] }),
  });

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    addBRC.mutate({
      name: f.get("name") as string,
      operatorType: f.get("operatorType") as string,
      address: f.get("address") as string,
      contactNumber: f.get("contactNumber") as string,
      latitude: parseFloat(f.get("latitude") as string),
      longitude: parseFloat(f.get("longitude") as string),
    });
    e.currentTarget.reset();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          BRC Centers ({brcs.length})
        </h2>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-sm bg-green-700 text-white px-4 py-2 rounded-xl font-medium hover:bg-green-800 transition-colors"
        >
          {showAdd ? "Cancel" : "+ Add BRC"}
        </button>
      </div>

      {showAdd && (
        <SectionCard>
          <p className="text-sm font-semibold text-gray-700 mb-3">New BRC Center</p>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <Label>Center Name</Label>
              <Input name="name" required placeholder="Pune District BRC" />
            </div>
            <div>
              <Label>Operator Type</Label>
              <select
                name="operatorType"
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="Government">Government</option>
                <option value="Cooperative">Cooperative</option>
                <option value="NGO">NGO</option>
              </select>
            </div>
            <div>
              <Label>Address</Label>
              <Input name="address" required placeholder="Survey No 45, Hadapsar, Pune" />
            </div>
            <div>
              <Label>Contact Number</Label>
              <Input name="contactNumber" required placeholder="+91 98765 43210" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Latitude</Label>
                <Input name="latitude" type="number" step="0.000001" required placeholder="18.5204" />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input name="longitude" type="number" step="0.000001" required placeholder="73.8567" />
              </div>
            </div>
            <SubmitBtn loading={addBRC.isPending} label="Add BRC Center" />
            {addBRC.isError && (
              <p className="text-red-500 text-xs">
                {(addBRC.error as any)?.response?.data?.detail ?? "Failed to add BRC"}
              </p>
            )}
          </form>
        </SectionCard>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

      <div className="space-y-3">
        {brcs.map((brc) => (
          <SectionCard key={brc.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 truncate">{brc.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{brc.address}</p>
                <p className="text-xs text-green-700 mt-1">📞 {brc.contactNumber}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {brc.latitude.toFixed(4)}, {brc.longitude.toFixed(4)} · {brc.operatorType}
                </p>
              </div>
              <button
                onClick={() => toggleActive.mutate({ id: brc.id, isActive: !brc.isActive })}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  brc.isActive
                    ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700"
                    : "bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700"
                }`}
              >
                {brc.isActive ? "Active" : "Inactive"}
              </button>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

// ─── Scans Tab ────────────────────────────────────────────────────────────────

function ScansTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<{ data: Scan[]; total: number; limit: number }>({
    queryKey: ["admin-scans", page, status],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(status ? { status } : {}),
      });
      return apiClient.get(`/api/v1/admin/scans?${params}`).then((r) => r.data);
    },
  });

  const totalPages = Math.ceil((data?.total ?? 0) / (data?.limit ?? 20));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          Scans {data?.total !== undefined ? `(${data.total})` : ""}
        </h2>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="PROCESSING">Processing</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

      <div className="space-y-3">
        {data?.data.map((scan) => (
          <SectionCard key={scan.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 truncate">
                  {scan.matchedChemical ?? "Unknown Chemical"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {scan.user?.name} · {scan.user?.email}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(scan.createdAt).toLocaleString("en-IN")}
                </p>
                {scan.confidence != null && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Confidence: {Math.round(scan.confidence * 100)}%
                  </p>
                )}
                {scan.errorMessage && (
                  <p className="text-xs text-red-500 mt-1 truncate">{scan.errorMessage}</p>
                )}
              </div>
              <span
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  statusColor[scan.status] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {scan.status}
              </span>
            </div>
          </SectionCard>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-sm px-4 py-2 border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-sm px-4 py-2 border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main AdminPage ───────────────────────────────────────────────────────────

export function AdminPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<Tab>("Stats");

  // Hard guard — shouldn't be reachable, but safety net
  if (!user || user.role !== "ADMIN") {
    navigate("/scan", { replace: true });
    return null;
  }

  return (
    <div className="p-4 space-y-5 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage chemicals, BRCs and audit scans</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 min-w-max py-2 px-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab
                ? "bg-white shadow text-green-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Stats" && <StatsTab />}
      {activeTab === "Chemicals" && <ChemicalsTab />}
      {activeTab === "BRC Centers" && <BRCTab />}
      {activeTab === "Scans" && <ScansTab />}
    </div>
  );
}
