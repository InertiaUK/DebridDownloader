import { useState } from "react";
import * as searchApi from "../api/search";
import * as torrentsApi from "../api/torrents";
import type { SearchResult, TrackerStatus } from "../types";

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "movies", label: "Movies" },
  { value: "tv", label: "TV Shows" },
  { value: "games", label: "Games" },
  { value: "software", label: "Software" },
  { value: "music", label: "Music" },
  { value: "other", label: "Other" },
];

const SORT_OPTIONS = [
  { value: "seeders", label: "Most Seeders" },
  { value: "size", label: "Largest" },
  { value: "date", label: "Newest" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState("seeders");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const handleSearch = async (newPage?: number) => {
    const searchPage = newPage ?? 1;
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setSearched(true);
    setPage(searchPage);

    try {
      const response = await searchApi.searchTorrents(
        query.trim(),
        category || undefined,
        sortBy,
        searchPage
      );
      setResults(response.results);
      setTrackerStatus(response.tracker_status);
    } catch (e) {
      setError(String(e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (result: SearchResult) => {
    setAddingId(result.info_hash);
    try {
      const added = await torrentsApi.addMagnet(result.magnet);
      await torrentsApi.selectTorrentFiles(added.id, "all");
      setAddedIds((prev) => new Set(prev).add(result.info_hash));
    } catch (e) {
      setError(`Failed to add "${result.title}": ${e}`);
    } finally {
      setAddingId(null);
    }
  };

  const seedersColor = (seeders: number) => {
    if (seeders >= 10) return "text-green-400";
    if (seeders >= 1) return "text-yellow-400";
    return "text-red-400";
  };

  const failedTrackers = trackerStatus.filter((t) => !t.ok);

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-zinc-100 tracking-tight mb-6">Search</h2>

      {/* Search bar */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search for torrents..."
            className="w-full pl-12 pr-4 py-3 bg-rd-card border border-rd-border rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-rd-green focus:shadow-[var(--shadow-glow-green)] text-sm transition-all"
          />
        </div>
        <button
          onClick={() => handleSearch()}
          disabled={loading || !query.trim()}
          className="px-6 py-3 bg-rd-green text-black font-semibold rounded-xl hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-all shadow-lg shadow-rd-green/20"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-4 py-2.5 bg-rd-card border border-rd-border rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-rd-green transition-colors"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2.5 bg-rd-card border border-rd-border rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-rd-green transition-colors"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Tracker warnings */}
      {failedTrackers.length > 0 && (
        <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-sm text-orange-400 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {failedTrackers.map((t) => t.name).join(", ")} unavailable — showing results from other sources
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-20 w-full" />
          ))}
        </div>
      ) : !searched ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-rd-card border border-rd-border flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p className="text-zinc-400 font-medium mb-1">Search for torrents</p>
          <p className="text-zinc-600 text-sm">Find content across public trackers</p>
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <p className="text-zinc-400 font-medium mb-1">No results found</p>
          <p className="text-zinc-600 text-sm">Try a different search term or category</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {results.map((result) => (
              <div
                key={result.info_hash || result.title}
                className="card-base flex items-center gap-4 px-5 py-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{result.title}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-xs text-zinc-400">{result.size_display}</span>
                    <span className={`text-xs font-medium ${seedersColor(result.seeders)}`}>
                      ↑{result.seeders}
                    </span>
                    <span className="text-xs text-zinc-600">↓{result.leechers}</span>
                    <span className="bg-rd-green/10 text-rd-green text-[11px] px-2 py-0.5 rounded-full font-medium">
                      {result.source}
                    </span>
                    {result.date && (
                      <span className="text-xs text-zinc-600">{result.date}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleAdd(result)}
                  disabled={addingId === result.info_hash || addedIds.has(result.info_hash)}
                  className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    addedIds.has(result.info_hash)
                      ? "bg-green-500/20 text-green-400 border border-green-500/30 cursor-default"
                      : "bg-rd-green text-black hover:bg-green-400 shadow-lg shadow-rd-green/20 disabled:opacity-40"
                  }`}
                >
                  {addedIds.has(result.info_hash)
                    ? "Added"
                    : addingId === result.info_hash
                      ? "Adding..."
                      : "Add"}
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              disabled={page <= 1}
              onClick={() => handleSearch(page - 1)}
              className="px-4 py-2 bg-rd-card border border-rd-border rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <span className="text-sm text-zinc-500 tabular-nums">Page {page}</span>
            <button
              disabled={results.length === 0}
              onClick={() => handleSearch(page + 1)}
              className="px-4 py-2 bg-rd-card border border-rd-border rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
