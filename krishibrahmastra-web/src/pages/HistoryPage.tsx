import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { Link } from "react-router-dom";

export function HistoryPage() {
  const { data: scans, isLoading } = useQuery({
    queryKey: ["scan-history"],
    queryFn: () => apiClient.get("/api/v1/scan/history").then((r) => r.data),
  });

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-green-800">Scan History</h1>
          <Link to="/scan" className="text-green-700 hover:text-green-900 font-medium bg-green-100 px-4 py-2 rounded-lg">
            + New Scan
          </Link>
        </div>

        {isLoading && <p className="text-gray-500">Loading history...</p>}
        
        {!isLoading && scans?.length === 0 && (
          <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
            <p className="text-gray-500 mb-4">You haven't scanned any bio-inputs yet.</p>
            <Link to="/scan" className="bg-green-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-800">
              Start Scanning
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {scans?.map((scan: any) => (
            <Link key={scan.id} to={`/results/${scan.id}`} className="block">
              <div className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-lg">
                      {scan.matchedChemical || "Unknown Chemical"}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(scan.createdAt).toLocaleDateString()} at {new Date(scan.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      scan.status === "COMPLETED" ? "bg-green-100 text-green-800" :
                      scan.status === "FAILED" ? "bg-red-100 text-red-800" :
                      "bg-yellow-100 text-yellow-800"
                    }`}>
                      {scan.status}
                    </span>
                    {scan.confidence > 0 && (
                      <p className="text-xs text-gray-400 mt-2">
                        {Math.round(scan.confidence * 100)}% Match
                      </p>
                    )}
                  </div>
                </div>
                {scan.errorMessage && (
                  <p className="text-xs text-red-500 mt-3 bg-red-50 p-2 rounded">
                    Error: {scan.errorMessage}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
