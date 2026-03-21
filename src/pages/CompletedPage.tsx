import { useState, useMemo } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import DataTable, { type Column } from "../components/DataTable";
import TableToolbar from "../components/TableToolbar";
import { useDownloadTasks } from "../hooks/useDownloadTasks";
import * as downloadsApi from "../api/downloads";
import type { DownloadTask } from "../types";
import { formatBytes } from "../utils";

export default function CompletedPage() {
  const { tasks, refreshTasks } = useDownloadTasks();
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const completedTasks = useMemo(() => tasks.filter((t) => t.status === "Completed"), [tasks]);

  const filtered = useMemo(() => {
    let result = completedTasks;
    if (filter) {
      const q = filter.toLowerCase();
      result = result.filter((t) => t.filename.toLowerCase().includes(q));
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        if (sortKey === "filename") cmp = a.filename.localeCompare(b.filename);
        else if (sortKey === "total_bytes") cmp = a.total_bytes - b.total_bytes;
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [completedTasks, filter, sortKey, sortDirection]);

  const handleClearAll = async () => {
    try {
      await downloadsApi.clearCompletedDownloads();
      refreshTasks();
    } catch { /* ignore */ }
  };

  const columns: Column<DownloadTask>[] = [
    {
      key: "filename",
      header: "Name",
      width: "1fr",
      sortable: true,
      render: (t) => <div className="text-[15px] font-medium text-[var(--theme-text-primary)] truncate">{t.filename}</div>,
    },
    {
      key: "total_bytes",
      header: "Size",
      width: "100px",
      sortable: true,
      render: (t) => <span className="text-[14px] text-[var(--theme-text-secondary)]">{formatBytes(t.total_bytes)}</span>,
    },
    {
      key: "destination",
      header: "Destination",
      width: "0.5fr",
      render: (t) => <span className="text-[13px] text-[var(--theme-text-muted)] truncate block">{t.destination || "--"}</span>,
    },
    {
      key: "actions",
      header: "",
      width: "160px",
      render: (t) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {t.destination && (
            <button
              onClick={(e) => { e.stopPropagation(); revealItemInDir(t.destination).catch(() => {}); }}
              className="px-3 py-1.5 rounded-md text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--accent-bg-light)] transition-colors"
            >
              Reveal
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadsApi.removeDownload(t.id).then(() => refreshTasks()).catch(() => {});
            }}
            className="px-3 py-1.5 rounded-md text-[13px] font-medium text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] transition-colors"
          >
            Remove
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <TableToolbar
        title="Completed"
        subtitle={`${completedTasks.length} download${completedTasks.length !== 1 ? "s" : ""}`}
        filterPlaceholder="Filter completed..."
        filterValue={filter}
        onFilterChange={setFilter}
        actions={
          completedTasks.length > 0 ? (
            <button
              onClick={handleClearAll}
              className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text-secondary)] text-[14px] transition-colors"
            >
              Clear All
            </button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(t) => t.id}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
        emptyMessage="No completed downloads"
        emptySubtext="Downloads will appear here once they finish."
      />

    </>
  );
}
