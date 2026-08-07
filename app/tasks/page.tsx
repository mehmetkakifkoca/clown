"use client";

import { useState, useEffect } from "react";

interface Task {
  id: string;
  title: string;
  completed: boolean;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (Array.isArray(data)) setTasks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    
    // optimistic update
    const tempId = crypto.randomUUID();
    const taskObj = { id: tempId, title: newTask.trim(), completed: false };
    setTasks(prev => [taskObj, ...prev]);
    setNewTask("");
    
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskObj.title })
      });
      loadTasks();
    } catch (e) {
      console.error(e);
      loadTasks();
    }
  };

  const handleToggle = async (task: Task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, completed: !task.completed })
      });
    } catch (e) {
      console.error(e);
      loadTasks();
    }
  };

  const handleDelete = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
    } catch (e) {
      console.error(e);
      loadTasks();
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className="flex-1 bg-surface h-full overflow-hidden flex flex-col md:pl-[280px]">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold font-headline-lg text-primary tracking-tight">
            Görevler
          </h1>
          <p className="text-sm text-secondary font-medium mt-1">
            {tasks.length - completedCount} açık görev
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-24 max-w-3xl">
        <form onSubmit={handleAddTask} className="mb-6 relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-outline-variant/30 flex items-center justify-center group-focus-within:border-primary/50 transition-colors">
             <span className="material-symbols-outlined text-[14px] text-primary/0 group-focus-within:text-primary/50 transition-colors">add</span>
          </div>
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Yeni Görev Ekle..."
            className="w-full pl-12 pr-4 py-4 text-sm bg-surface-container-lowest border border-outline-variant/30 rounded-2xl focus:outline-none focus:border-primary/50 focus:shadow-sm text-on-surface font-medium transition-all"
          />
        </form>

        <div className="space-y-2">
          {tasks.map(task => (
            <div 
              key={task.id} 
              className={`flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl border transition-all group hover:border-primary/20 hover:shadow-xs ${task.completed ? 'border-outline-variant/20 opacity-70' : 'border-outline-variant/30'}`}
            >
              <div className="flex items-center space-x-4 flex-1 cursor-pointer" onClick={() => handleToggle(task)}>
                <button 
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    task.completed 
                      ? 'bg-primary border-primary text-white' 
                      : 'border-outline/40 group-hover:border-primary/60'
                  }`}
                >
                  {task.completed && <span className="material-symbols-outlined text-[14px] font-bold">check</span>}
                </button>
                <span className={`text-[15px] font-medium select-none transition-all ${task.completed ? 'text-secondary line-through' : 'text-on-surface'}`}>
                  {task.title}
                </span>
              </div>
              <button 
                onClick={() => handleDelete(task.id)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-secondary hover:bg-error-container hover:text-error opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
          {tasks.length === 0 && !loading && (
            <div className="text-center py-12 px-4 border-2 border-dashed border-outline-variant/40 rounded-3xl">
              <span className="material-symbols-outlined text-4xl text-outline/30 mb-2">task_alt</span>
              <p className="text-sm font-semibold text-secondary">Harika! Tüm görevleri tamamladınız.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
