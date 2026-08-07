"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  pageId: string | null;
  page: { id: string; title: string } | null;
  projectId: string | null;
  project: { id: string; name: string; color: string; icon: string } | null;
}

interface ProjectItem {
  id: string;
  name: string;
  color: string;
  icon: string;
  taskCount: number;
}

const PROJECT_COLORS = ["#b61722", "#006765", "#0078d4", "#f59e0b", "#10b981", "#7c3aed", "#ec4899", "#64748b"];

export default function CentralTasksPage() {
  const [view, setView] = useState<"today" | "upcoming" | "overdue" | "completed" | "all">("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(""); // "" = tümü, "none" = projesiz
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [quickTitle, setQuickTitle] = useState("");
  const [quickProjectId, setQuickProjectId] = useState("");
  const [quickPriority, setQuickPriority] = useState("NORMAL");
  const [quickDueDate, setQuickDueDate] = useState("");
  const [adding, setAdding] = useState(false);

  const [showProjectManager, setShowProjectManager] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);

  useEffect(() => {
    loadTasks();
  }, [view, selectedProjectId]);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view });
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) setTasks(data);
    } catch {}
    setLoading(false);
  };

  const loadProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data);
    } catch {}
  };

  const handleToggleTaskStatus = async (task: TaskItem) => {
    const nextStatus = task.status === "DONE" ? "TODO" : "DONE";
    try {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: nextStatus }),
      });
      if (view !== "all") loadTasks();
      loadProjects();
    } catch {
      loadTasks();
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickTitle.trim(),
          priority: quickPriority,
          dueDate: quickDueDate || null,
          projectId: quickProjectId || null,
        }),
      });
      setQuickTitle("");
      setQuickDueDate("");
      await Promise.all([loadTasks(), loadProjects()]);
    } catch {
      alert("Görev eklenemedi.");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteTask = async (task: TaskItem) => {
    if (!confirm(`"${task.title}" görevini silmek istediğinize emin misiniz?`)) return;
    try {
      await fetch(`/api/tasks?id=${task.id}`, { method: "DELETE" });
      await Promise.all([loadTasks(), loadProjects()]);
    } catch {}
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim(), color: newProjectColor }),
      });
      setNewProjectName("");
      loadProjects();
    } catch {}
  };

  const handleDeleteProject = async (project: ProjectItem) => {
    if (!confirm(`"${project.name}" projesini silmek istediğinize emin misiniz? Görevler projesiz kalacak.`)) return;
    try {
      await fetch(`/api/projects?id=${project.id}`, { method: "DELETE" });
      if (selectedProjectId === project.id) setSelectedProjectId("");
      await Promise.all([loadTasks(), loadProjects()]);
    } catch {}
  };

  const priorityColors: Record<string, string> = {
    LOW: "bg-blue-50 text-blue-700 border-blue-200",
    NORMAL: "bg-gray-50 text-gray-700 border-gray-200",
    HIGH: "bg-amber-50 text-amber-700 border-amber-200",
    URGENT: "bg-red-50 text-red-700 border-red-200 animate-pulse",
  };

  const viewTabs = [
    { id: "all" as const, label: "Tüm Görevler", icon: "assignment" },
    { id: "today" as const, label: "Bugün", icon: "today" },
    { id: "upcoming" as const, label: "Yaklaşan", icon: "event" },
    { id: "overdue" as const, label: "Geciken", icon: "warning" },
    { id: "completed" as const, label: "Tamamlanan", icon: "task_alt" },
  ];

  return (
    <div className="min-h-screen bg-background text-on-surface px-6 md:px-12 lg:px-20 pt-6 pb-28 md:pb-8 max-w-4xl mx-auto">
      {/* Header */}
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider font-label-caps block">
              Merkezi Görev Havuzu
            </span>
          </div>
          <h1 className="text-3xl font-bold font-headline-lg text-on-surface tracking-tight mt-1">
            Görev Planlayıcı
          </h1>
          <p className="text-xs text-secondary mt-1">
            Tüm görevlerinizi tek yerde görün, isterseniz projeye göre filtreleyin.
          </p>
        </div>
        <button
          onClick={() => setShowProjectManager(true)}
          className="flex-shrink-0 flex items-center space-x-1.5 px-3.5 py-2 bg-surface-container-low hover:bg-surface-container rounded-xl text-xs font-bold text-secondary border border-outline-variant/20 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">folder_managed</span>
          <span>Projeler</span>
        </button>
      </header>

      {/* Quick Add Task Form */}
      <form
        onSubmit={handleQuickAdd}
        className="flex items-center flex-wrap gap-2 mb-6 p-3.5 bg-surface-container-lowest border border-outline-variant/25 rounded-2xl shadow-xs"
      >
        <span className="material-symbols-outlined text-[18px] text-primary flex-shrink-0">add_task</span>
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Yeni görev ekle..."
          className="flex-1 min-w-[140px] text-xs md:text-sm bg-transparent focus:outline-none text-on-surface"
        />
        <select
          value={quickProjectId}
          onChange={(e) => setQuickProjectId(e.target.value)}
          className="text-[10px] font-bold bg-surface-container-low px-2 py-1.5 rounded-lg border border-outline-variant/20 focus:outline-none text-secondary"
        >
          <option value="">Projesiz</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={quickPriority}
          onChange={(e) => setQuickPriority(e.target.value)}
          className="text-[10px] font-bold bg-surface-container-low px-2 py-1.5 rounded-lg border border-outline-variant/20 focus:outline-none text-secondary"
        >
          <option value="LOW">LOW</option>
          <option value="NORMAL">NORMAL</option>
          <option value="HIGH">HIGH</option>
          <option value="URGENT">URGENT</option>
        </select>
        <input
          type="date"
          value={quickDueDate}
          onChange={(e) => setQuickDueDate(e.target.value)}
          className="text-[10px] font-bold bg-surface-container-low px-2 py-1.5 rounded-lg border border-outline-variant/20 focus:outline-none text-secondary"
        />
        <button
          type="submit"
          disabled={adding || !quickTitle.trim()}
          className="px-3.5 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-lg shadow-sm disabled:opacity-50"
        >
          {adding ? "..." : "Ekle"}
        </button>
      </form>

      {/* Project Filter Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-3 scrollbar-none">
        <button
          onClick={() => setSelectedProjectId("")}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            selectedProjectId === ""
              ? "bg-primary text-on-primary border-primary shadow-xs"
              : "bg-surface-container-low text-secondary border-outline-variant/15 hover:bg-surface-container"
          }`}
        >
          Tüm Projeler
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedProjectId(p.id)}
            className={`flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              selectedProjectId === p.id
                ? "text-on-primary border-transparent shadow-xs"
                : "bg-surface-container-low text-secondary border-outline-variant/15 hover:bg-surface-container"
            }`}
            style={selectedProjectId === p.id ? { backgroundColor: p.color } : {}}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
            <span>{p.name}</span>
            {p.taskCount > 0 && <span className="opacity-75">({p.taskCount})</span>}
          </button>
        ))}
        <button
          onClick={() => setSelectedProjectId("none")}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            selectedProjectId === "none"
              ? "bg-primary text-on-primary border-primary shadow-xs"
              : "bg-surface-container-low text-secondary border-outline-variant/15 hover:bg-surface-container"
          }`}
        >
          Projesiz
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-4 mb-6 border-b border-outline-variant/15 scrollbar-none select-none">
        {viewTabs.map((tab) => {
          const isActive = view === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container-low text-on-surface hover:bg-surface-container border border-outline-variant/10"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 bg-surface-container-low animate-pulse rounded-2xl border border-outline-variant/15" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-6">
          <span className="material-symbols-outlined text-4xl text-outline mb-2">done_all</span>
          <p className="text-sm text-secondary font-medium">Bu sekmede planlanmış görev bulunmuyor</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tasks.map((task) => {
            const isDone = task.status === "DONE";
            const page = task.page;

            return (
              <div
                key={task.id}
                className="flex items-start justify-between p-4 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl hover:border-primary/30 transition-all shadow-xs group"
                style={task.project ? { borderLeftWidth: 3, borderLeftColor: task.project.color } : {}}
              >
                <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                  {/* Status checkbox */}
                  <button
                    onClick={() => handleToggleTaskStatus(task)}
                    className="pt-0.5 text-secondary hover:text-primary transition-colors flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {isDone ? "check_box" : "check_box_outline_blank"}
                    </span>
                  </button>

                  <div className="min-w-0 flex-1">
                    {/* Title */}
                    {page ? (
                      <Link
                        href={`/notes?id=${page.id}&highlightTask=${task.id}`}
                        className={`text-xs md:text-sm font-semibold truncate hover:text-primary transition-colors block ${
                          isDone ? "line-through text-outline font-normal" : "text-on-surface"
                        }`}
                      >
                        {task.title}
                      </Link>
                    ) : (
                      <span
                        className={`text-xs md:text-sm font-semibold truncate block ${
                          isDone ? "line-through text-outline font-normal" : "text-on-surface"
                        }`}
                      >
                        {task.title}
                      </span>
                    )}

                    {/* Source Breadcrumbs path */}
                    <div className="flex items-center space-x-1.5 text-[9px] text-outline font-semibold font-label-caps mt-1.5 select-none">
                      {task.project && (
                        <span className="flex items-center space-x-1 font-bold" style={{ color: task.project.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.project.color }} />
                          <span>{task.project.name}</span>
                        </span>
                      )}
                      {page && <span className="text-secondary font-bold">Sayfa: {page.title}</span>}
                    </div>
                  </div>
                </div>

                {/* Task badges */}
                <div className="flex items-center space-x-2 flex-shrink-0 ml-4 select-none">
                  {/* Priority */}
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${priorityColors[task.priority] || "bg-surface-container"}`}>
                    {task.priority}
                  </span>

                  {/* Due Date */}
                  {task.dueDate && (
                    <span className="inline-flex items-center text-[9px] font-bold text-secondary bg-surface-container px-2 py-0.5 rounded-md border border-outline-variant/15">
                      <span className="material-symbols-outlined text-[13px] mr-1">event</span>
                      {new Date(task.dueDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
                    </span>
                  )}

                  {/* Delete (only standalone tasks) */}
                  {!page && (
                    <button
                      onClick={() => handleDeleteTask(task)}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center text-outline hover:text-error hover:bg-error-container/20 transition-all"
                      title="Görevi Sil"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project Manager Modal */}
      {showProjectManager && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-outline-variant/30 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container-high">
              <h2 className="text-lg font-bold font-headline-lg text-on-surface">Projeler</h2>
              <button
                onClick={() => setShowProjectManager(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3 mb-5">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Yeni proje adı..."
                className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewProjectColor(c)}
                      className={`w-5 h-5 rounded-full border ${newProjectColor === c ? "ring-2 ring-primary scale-110" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={!newProjectName.trim()}
                  className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  Oluştur
                </button>
              </div>
            </form>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {projects.length === 0 ? (
                <p className="text-xs text-outline italic text-center py-4">Henüz proje oluşturulmadı.</p>
              ) : (
                projects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3.5 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/15"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-xs font-semibold text-on-surface truncate">{p.name}</span>
                      <span className="text-[10px] text-outline flex-shrink-0">{p.taskCount} açık görev</span>
                    </div>
                    <button
                      onClick={() => handleDeleteProject(p)}
                      className="text-outline hover:text-error transition-colors flex-shrink-0"
                      title="Projeyi Sil"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
