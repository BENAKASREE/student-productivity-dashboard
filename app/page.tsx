
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

type Priority = "Low" | "Medium" | "High";
type View = "overview" | "tasks";

type Task = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority: Priority;
  category: string;
  dueDate: string;
  createdAt: Timestamp | null;
  completedAt: Timestamp | null;
};

const categories = ["Academic", "Personal", "Projects", "Placement", "Other"];

const todayString = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatDate = (value: string) => {
  if (!value) return "No deadline";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const priorityStyles: Record<Priority, string> = {
  High: "bg-rose-50 text-rose-700 ring-rose-200",
  Medium: "bg-amber-50 text-amber-700 ring-amber-200",
  Low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

function Icon({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${className}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: string;
  tone: "violet" | "green" | "amber" | "rose";
}) {
  const tones = {
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
  };

  return (
    <article className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <Icon className={`${tones[tone]} ring-1`}>{icon}</Icon>
      </div>
      <p className="mt-3 text-xs text-slate-400">{detail}</p>
    </article>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      )}
    </div>
  );
}

export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<View>("overview");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [category, setCategory] = useState("Academic");
  const [dueDate, setDueDate] = useState("");

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("Medium");
  const [editCategory, setEditCategory] = useState("Academic");
  const [editDueDate, setEditDueDate] = useState("");

  // Authentication listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore listener
  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }

    const tasksRef = collection(db, "users", user.uid, "tasks");

    const unsubscribe = onSnapshot(
      tasksRef,
      (snapshot) => {
        const loadedTasks = snapshot.docs.map((item) => {
          const data = item.data();

          return {
            id: item.id,
            title: data.title ?? "",
            description: data.description ?? "",
            completed: data.completed ?? false,
            priority: data.priority ?? "Medium",
            category: data.category ?? "Academic",
            dueDate: data.dueDate ?? "",
            createdAt:
              data.createdAt instanceof Timestamp ? data.createdAt : null,
            completedAt:
              data.completedAt instanceof Timestamp ? data.completedAt : null,
          } as Task;
        });

        loadedTasks.sort(
          (a, b) =>
            (b.createdAt?.toMillis() ?? 0) -
            (a.createdAt?.toMillis() ?? 0)
        );

        setTasks(loadedTasks);
      },
      (snapshotError) => {
        console.error("Firestore error:", snapshotError);
        setError("Unable to load tasks. Please refresh the page.");
      }
    );

    return () => unsubscribe();
  }, [user]);

  const today = todayString();

  // Analytics
  const completedTasks = tasks.filter((task) => task.completed);
  const pendingTasks = tasks.filter((task) => !task.completed);

  const overdueTasks = pendingTasks.filter(
    (task) => task.dueDate && task.dueDate < today
  );

  const dueTodayTasks = pendingTasks.filter(
    (task) => task.dueDate === today
  );

  const highPriorityTasks = pendingTasks.filter(
    (task) => task.priority === "High"
  );

  const completionRate =
    tasks.length === 0
      ? 0
      : Math.round((completedTasks.length / tasks.length) * 100);

  const weeklyActivity = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));

      const count = tasks.filter((task) => {
        if (!task.completed || !task.completedAt) return false;
        const completedDate = task.completedAt.toDate();

        return (
          completedDate.getFullYear() === date.getFullYear() &&
          completedDate.getMonth() === date.getMonth() &&
          completedDate.getDate() === date.getDate()
        );
      }).length;

      return {
        label: date.toLocaleDateString("en-IN", { weekday: "short" }),
        count,
      };
    });
  }, [tasks]);

  const maxActivity = Math.max(
    ...weeklyActivity.map((item) => item.count),
    1
  );

  const filteredTasks = tasks.filter((task) => {
    const query = search.toLowerCase();

    const matchesSearch =
      task.title.toLowerCase().includes(query) ||
      task.category.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Completed" && task.completed) ||
      (statusFilter === "Pending" && !task.completed) ||
      (statusFilter === "Overdue" &&
        !task.completed &&
        Boolean(task.dueDate) &&
        task.dueDate < today);

    const matchesPriority =
      priorityFilter === "All" || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Add task
  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !user || saving) return;

    setSaving(true);
    setError("");

    try {
      await addDoc(collection(db, "users", user.uid, "tasks"), {
        title: title.trim(),
        description: description.trim(),
        completed: false,
        priority,
        category,
        dueDate,
        createdAt: serverTimestamp(),
        completedAt: null,
      });

      setTitle("");
      setDescription("");
      setPriority("Medium");
      setCategory("Academic");
      setDueDate("");
    } catch (err) {
      console.error("Add task error:", err);
      setError("Could not add the task. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Toggle completion
  async function toggleTask(task: Task) {
    if (!user) return;

    try {
      await updateDoc(doc(db, "users", user.uid, "tasks", task.id), {
        completed: !task.completed,
        completedAt: task.completed ? null : Timestamp.now(),
      });
    } catch (err) {
      console.error("Update task error:", err);
      setError("Unable to update task.");
    }
  }

  // Delete task
  async function deleteTask(taskId: string) {
    if (!user) return;

    if (!window.confirm("Are you sure you want to delete this task?")) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "tasks", taskId));
    } catch (err) {
      console.error("Delete task error:", err);
      setError("Unable to delete task.");
    }
  }

  // Edit task
  function openEdit(task: Task) {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditPriority(task.priority);
    setEditCategory(task.category);
    setEditDueDate(task.dueDate);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !editingTask || !editTitle.trim()) return;

    try {
      await updateDoc(
        doc(db, "users", user.uid, "tasks", editingTask.id),
        {
          title: editTitle.trim(),
          description: editDescription.trim(),
          priority: editPriority,
          category: editCategory,
          dueDate: editDueDate,
        }
      );

      setEditingTask(null);
    } catch (err) {
      console.error("Edit task error:", err);
      setError("Unable to save changes.");
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
      setError("Unable to log out.");
    }
  }

  function navigate(nextView: View) {
    setView(nextView);
    setMobileMenuOpen(false);
  }

  const upcomingTasks = pendingTasks
    .filter((task) => task.dueDate && task.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  const userInitial = (user?.email ?? "U")[0].toUpperCase();

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
          <p className="mt-4 text-sm font-medium text-slate-500">
            Preparing your workspace...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-3xl font-bold text-violet-700">
            S
          </div>
          <h1 className="mt-6 text-2xl font-bold text-slate-900">
            StudentFlow
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Sign in to access your personal productivity workspace.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="mt-7 w-full rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white transition hover:bg-violet-700"
          >
            Sign In / Register
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-800">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden w-[258px] shrink-0 flex-col border-r border-slate-800 bg-[#11152a] px-5 py-7 text-white lg:flex">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-bold shadow-lg shadow-violet-950/30">
              S
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">StudentFlow</h1>
              <p className="text-[11px] text-slate-400">
                Productivity workspace
              </p>
            </div>
          </div>

          <div className="mt-12">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Workspace
            </p>

            <button
              onClick={() => navigate("overview")}
              className={`mt-4 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                view === "overview"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-950/30"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-lg">▦</span>
              Overview
            </button>

            <button
              onClick={() => navigate("tasks")}
              className={`mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                view === "tasks"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-950/30"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-lg">✓</span>
              My Tasks
              <span className="ml-auto rounded-lg bg-white/10 px-2 py-0.5 text-xs">
                {pendingTasks.length}
              </span>
            </button>

            <button
              onClick={() => navigate("tasks")}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              <span className="text-lg">▦</span> Calendar
            </button>
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300">
                Overall progress
              </p>
              <span className="text-sm font-bold text-violet-300">
                {completionRate}%
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              {completedTasks.length} of {tasks.length} tasks completed
            </p>
          </div>

          <div className="mt-auto border-t border-white/10 pt-5">
            <div className="mb-4 flex items-center gap-3 px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{user.email}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Personal account
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full rounded-xl px-4 py-3 text-left text-sm text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
            >
              <span className="mr-2">↪</span> Sign out
            </button>
          </div>
        </aside>

        {/* Main area */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
            <div className="flex min-h-[76px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 font-bold text-violet-700 lg:hidden">
                  S
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-400">
                    {new Date().toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <h2 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                    {view === "overview"
                      ? "Productivity overview"
                      : "Task management"}
                  </h2>
                </div>
              </div>

              <div className="hidden items-center gap-3 sm:flex">
                <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Live sync active
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                  {userInitial}
                </div>
              </div>

              <button
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 lg:hidden"
                aria-label="Toggle navigation"
                aria-expanded={mobileMenuOpen}
              >
                ☰
              </button>
            </div>

            {mobileMenuOpen && (
              <div className="border-t border-slate-100 bg-white px-5 py-3 lg:hidden">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate("overview")}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                      view === "overview"
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => navigate("tasks")}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                      view === "tasks"
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    My Tasks ({pendingTasks.length})
                  </button>
                  <button
                    onClick={() => navigate("tasks")}
                    className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600"
                  >
                    Calendar
                  </button>
                  <button
                    onClick={handleLogout}
                    className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </header>

          <div className="mx-auto max-w-[1500px] space-y-7 p-5 sm:p-8">
            {error && (
              <div
                role="alert"
                className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                <span>{error}</span>
                <button
                  onClick={() => setError("")}
                  className="font-bold"
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}

            {view === "overview" ? (
              <>
                {/* Welcome panel */}
                <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-[#27205e] via-[#5143b8] to-[#7866ed] p-6 text-white shadow-xl shadow-violet-200/60 sm:p-9">
                  <div className="pointer-events-none absolute -right-16 -top-28 -z-10 h-72 w-72 rounded-full border-[35px] border-white/5" />
                  <div className="pointer-events-none absolute -bottom-36 right-36 -z-10 h-72 w-72 rounded-full bg-violet-300/10 blur-3xl" />

                  <div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-center">
                    <div className="max-w-xl">
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
                        Your personal workspace
                      </p>
                      <h3 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                        Make today count.
                      </h3>
                      <p className="mt-3 max-w-md text-sm leading-6 text-violet-100">
                        Plan your priorities, stay on top of deadlines and
                        build momentum one task at a time.
                      </p>
                      <button
                        onClick={() => navigate("tasks")}
                        className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-bold text-violet-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-50"
                      >
                        Open my tasks <span className="ml-2">→</span>
                      </button>
                    </div>

                    <div className="hidden h-36 w-36 items-center justify-center rounded-[2rem] border border-white/20 bg-white/10 text-7xl shadow-inner backdrop-blur sm:flex">
                      ◈
                    </div>
                  </div>
                </section>

                {/* Stats */}
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Total tasks"
                    value={tasks.length}
                    detail="Across all categories"
                    icon="▤"
                    tone="violet"
                  />
                  <StatCard
                    label="Completed"
                    value={completedTasks.length}
                    detail="Tasks successfully finished"
                    icon="✓"
                    tone="green"
                  />
                  <StatCard
                    label="Pending"
                    value={pendingTasks.length}
                    detail="Tasks waiting for action"
                    icon="◷"
                    tone="amber"
                  />
                  <StatCard
                    label="Overdue"
                    value={overdueTasks.length}
                    detail="Tasks past their deadline"
                    icon="!"
                    tone="rose"
                  />
                </section>

                {/* Analytics */}
                <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                  <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm xl:col-span-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <SectionHeading
                        eyebrow="Your activity"
                        title="Weekly productivity"
                        description="Completed tasks over the last seven days"
                      />
                      <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                        Last 7 days
                      </span>
                    </div>

                    <div className="mt-8 flex h-52 items-end justify-between gap-3 border-b border-slate-100 pb-3">
                      {weeklyActivity.map((item, index) => {
                        const height =
                          item.count === 0
                            ? 3
                            : Math.max(8, (item.count / maxActivity) * 100);

                        return (
                          <div
                            key={`${item.label}-${index}`}
                            className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                          >
                            <span className="text-xs font-semibold text-slate-500">
                              {item.count}
                            </span>
                            <div className="flex h-36 w-full items-end justify-center">
                              <div
                                className={`w-full max-w-12 rounded-t-lg transition-all duration-500 ${
                                  item.count > 0
                                    ? "bg-gradient-to-t from-violet-700 to-violet-400 hover:from-violet-800 hover:to-violet-500"
                                    : "bg-slate-200"
                                }`}
                                style={{ height: `${height}%` }}
                                title={`${item.count} completed tasks`}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-400">
                              {item.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <SectionHeading
                      eyebrow="Performance"
                      title="Completion rate"
                      description="Your overall task progress"
                    />

                    <div className="mt-7 flex justify-center">
                      <div
                        className="relative flex h-44 w-44 items-center justify-center rounded-full"
                        style={{
                          background: `conic-gradient(#7663ed ${completionRate}%, #edf0f5 0)`,
                        }}
                      >
                        <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white shadow-inner">
                          <span className="text-4xl font-bold tracking-tight text-slate-900">
                            {completionRate}%
                          </span>
                          <span className="mt-1 text-xs font-medium text-slate-400">
                            Completed
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-7 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-slate-500">
                          <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                          Completed
                        </span>
                        <span className="font-bold text-slate-800">
                          {completedTasks.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-slate-500">
                          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                          Remaining
                        </span>
                        <span className="font-bold text-slate-800">
                          {pendingTasks.length}
                        </span>
                      </div>
                    </div>
                  </article>
                </section>

                {/* Attention and upcoming tasks */}
                <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <SectionHeading
                      eyebrow="Stay on track"
                      title="Needs your attention"
                      description="A quick look at your outstanding priorities"
                    />

                    <div className="mt-5 space-y-3">
                      {[
                        {
                          label: "Overdue tasks",
                          value: overdueTasks.length,
                          tone: "bg-rose-50 text-rose-700",
                        },
                        {
                          label: "Due today",
                          value: dueTodayTasks.length,
                          tone: "bg-amber-50 text-amber-700",
                        },
                        {
                          label: "High priority pending",
                          value: highPriorityTasks.length,
                          tone: "bg-violet-50 text-violet-700",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between rounded-xl bg-slate-50/80 px-4 py-3"
                        >
                          <span className="text-sm font-medium text-slate-600">
                            {item.label}
                          </span>
                          <span
                            className={`rounded-lg px-3 py-1 text-sm font-bold ${item.tone}`}
                          >
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setStatusFilter("Overdue");
                        navigate("tasks");
                      }}
                      className="mt-5 text-sm font-bold text-violet-700 transition hover:text-violet-900"
                    >
                      Review overdue tasks <span className="ml-1">→</span>
                    </button>
                  </article>

                  <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <SectionHeading
                        eyebrow="Coming up"
                        title="Upcoming deadlines"
                        description="Your next scheduled tasks"
                      />
                      <button
                        onClick={() => navigate("tasks")}
                        className="shrink-0 text-xs font-bold text-violet-700 hover:text-violet-900"
                      >
                        View all →
                      </button>
                    </div>

                    <div className="mt-5 space-y-1">
                      {upcomingTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="h-9 w-1 shrink-0 rounded-full bg-violet-300" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800">
                                {task.title}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {task.category}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-slate-500">
                            {formatDate(task.dueDate)}
                          </span>
                        </div>
                      ))}

                      {upcomingTasks.length === 0 && (
                        <div className="rounded-xl bg-slate-50 px-4 py-9 text-center">
                          <p className="text-2xl">✦</p>
                          <p className="mt-2 text-sm font-semibold text-slate-600">
                            You're all caught up
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            No upcoming deadlines to show.
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                </section>
              </>
            ) : (
              <>
                {/* Create task */}
                <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7">
                  <div className="mb-6 flex items-start gap-3">
                    <Icon className="bg-violet-100 text-violet-700">＋</Icon>
                    <SectionHeading
                      eyebrow="Task creation"
                      title="Create a new task"
                      description="Capture what needs to get done and organise it."
                    />
                  </div>

                  <form onSubmit={addTask} className="space-y-5">
                    <div>
                      <label
                        htmlFor="task-title"
                        className="mb-2 block text-xs font-bold text-slate-600"
                      >
                        Task title
                      </label>
                      <input
                        id="task-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                        maxLength={120}
                        placeholder="e.g. Complete database assignment"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                      />
                    </div>

                    <div>
                      <label htmlFor="task-description" className="mb-2 block text-xs font-bold text-slate-600">
                        Description <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <textarea
                        id="task-description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        maxLength={500}
                        rows={3}
                        placeholder="Add notes, requirements or context for this task..."
                        className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label
                          htmlFor="task-priority"
                          className="mb-2 block text-xs font-bold text-slate-600"
                        >
                          Priority
                        </label>
                        <select
                          id="task-priority"
                          value={priority}
                          onChange={(event) =>
                            setPriority(event.target.value as Priority)
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                        >
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="task-category"
                          className="mb-2 block text-xs font-bold text-slate-600"
                        >
                          Category
                        </label>
                        <select
                          id="task-category"
                          value={category}
                          onChange={(event) => setCategory(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                        >
                          {categories.map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="task-date"
                          className="mb-2 block text-xs font-bold text-slate-600"
                        >
                          Due date
                        </label>
                        <input
                          id="task-date"
                          type="date"
                          min={today}
                          value={dueDate}
                          onChange={(event) => setDueDate(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                      <p className="text-xs text-slate-400">
                        Your task will sync to your personal workspace.
                      </p>
                      <button
                        type="submit"
                        disabled={!title.trim() || saving}
                        className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? "Saving task..." : "+ Create task"}
                      </button>
                    </div>
                  </form>
                </section>

                {/* Monthly calendar */}
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <SectionHeading eyebrow="Plan ahead" title="Task calendar" description="Your scheduled tasks, organized by due date." />
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50" aria-label="Previous month">‹</button>
                      <span className="min-w-36 text-center text-sm font-bold text-slate-800">{calendarMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
                      <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50" aria-label="Next month">›</button>
                      <button type="button" onClick={() => setCalendarMonth(new Date())} className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100">Today</button>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-7 gap-1 sm:gap-2">
                    { ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:text-xs">{day}</div>) }
                    {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() }, (_, i) => <div key={`empty-${i}`} className="min-h-20 rounded-xl bg-slate-50/50 sm:min-h-24" />)}
                    {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => {
                      const dayNumber = i + 1;
                      const dateKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
                      const dayTasks = tasks.filter((task) => task.dueDate === dateKey);
                      const isToday = dateKey === today;
                      return <div key={dateKey} className={`min-h-20 overflow-hidden rounded-xl border p-1.5 sm:min-h-24 sm:p-2 ${isToday ? "border-violet-300 bg-violet-50/70" : "border-slate-100 bg-white"}`}>
                        <div className={`mb-1 text-xs font-bold ${isToday ? "text-violet-700" : "text-slate-500"}`}>{dayNumber}</div>
                        <div className="space-y-1">
                          {dayTasks.slice(0, 2).map((task) => <button key={task.id} type="button" onClick={() => setSelectedTask(task)} title={task.title} className={`block w-full truncate rounded-md px-1.5 py-1 text-left text-[9px] font-semibold sm:text-[10px] ${task.completed ? "bg-emerald-50 text-emerald-700 line-through" : task.priority === "High" ? "bg-rose-50 text-rose-700" : task.priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}>{task.title}</button>)}
                          {dayTasks.length > 2 && <p className="px-1 text-[9px] font-semibold text-slate-400">+{dayTasks.length - 2} more</p>}
                        </div>
                      </div>;
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-[10px] font-medium text-slate-500 sm:text-xs">
                    <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-rose-400" />High priority</span>
                    <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" />Medium priority</span>
                    <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-sky-400" />Low priority</span>
                    <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-400" />Completed</span>
                  </div>
                </section>

                {/* Task list */}
                <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <SectionHeading
                      eyebrow="Your workspace"
                      title="All tasks"
                      description={`${filteredTasks.length} of ${tasks.length} tasks displayed`}
                    />

                    <div className="relative w-full lg:max-w-xs">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        ⌕
                      </span>
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search tasks or categories..."
                        aria-label="Search tasks"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {["All", "Pending", "Completed", "Overdue"].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setStatusFilter(filter)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                          statusFilter === filter
                            ? "bg-violet-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {filter}
                        {filter === "Pending" && (
                          <span className="ml-1.5 opacity-70">
                            {pendingTasks.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label
                      htmlFor="priority-filter"
                      className="text-xs font-semibold text-slate-500"
                    >
                      Priority:
                    </label>
                    <select
                      id="priority-filter"
                      value={priorityFilter}
                      onChange={(event) => setPriorityFilter(event.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 outline-none focus:border-violet-400"
                    >
                      <option>All</option>
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                    {(search || statusFilter !== "All" || priorityFilter !== "All") && (
                      <button
                        onClick={() => {
                          setSearch("");
                          setStatusFilter("All");
                          setPriorityFilter("All");
                        }}
                        className="text-xs font-semibold text-violet-700 hover:text-violet-900"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>

                  <div className="mt-5 space-y-3">
                    {filteredTasks.map((task) => {
                      const isOverdue =
                        !task.completed &&
                        Boolean(task.dueDate) &&
                        task.dueDate < today;

                      return (
                        <article
                          key={task.id}
                          className={`group rounded-xl border p-4 transition duration-200 hover:shadow-md ${
                            task.completed
                              ? "border-slate-100 bg-slate-50/70"
                              : "border-slate-200 bg-white hover:border-violet-200"
                          }`}
                        >
                          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                            <div className="flex min-w-0 items-start gap-3">
                              <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={() => toggleTask(task)}
                                aria-label={`Mark ${task.title} as ${task.completed ? "pending" : "completed"}`}
                                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-violet-600"
                              />

                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => setSelectedTask(task)}
                                  className={`break-words text-left text-sm font-semibold transition hover:text-violet-700 ${
                                    task.completed
                                      ? "text-slate-400 line-through"
                                      : "text-slate-800"
                                  }`}
                                >
                                  {task.title}
                                </button>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                                    {task.category}
                                  </span>

                                  <span
                                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${priorityStyles[task.priority]}`}
                                  >
                                    {task.priority} priority
                                  </span>

                                  {task.dueDate && (
                                    <span className="text-[11px] text-slate-400">
                                      Due {formatDate(task.dueDate)}
                                    </span>
                                  )}

                                  {isOverdue && (
                                    <span className="rounded-md bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600">
                                      OVERDUE
                                    </span>
                                  )}

                                  {task.completed && (
                                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                                      COMPLETED
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2 pl-8 sm:pl-0">
                              <button
                                onClick={() => setSelectedTask(task)}
                                className="rounded-lg border border-violet-100 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
                              >
                                Details
                              </button>
                              <button
                                onClick={() => openEdit(task)}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="rounded-lg border border-rose-100 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}

                    {filteredTasks.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-2xl text-violet-600">
                          ▤
                        </div>
                        <p className="mt-4 text-sm font-bold text-slate-700">
                          No matching tasks
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Try another search or adjust your filters.
                        </p>
                        <button
                          onClick={() => {
                            setSearch("");
                            setStatusFilter("All");
                            setPriorityFilter("All");
                          }}
                          className="mt-4 text-xs font-bold text-violet-700 hover:text-violet-900"
                        >
                          Reset filters
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            <footer className="border-t border-slate-200/80 py-5 text-center text-[11px] text-slate-400">
              StudentFlow <span className="mx-1.5">·</span> Personal
              Productivity Workspace <span className="mx-1.5">·</span> Powered
              by Firebase
            </footer>
          </div>
        </div>
      </div>

      {/* Edit task modal */}
      {editingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEditingTask(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-task-title"
            className="w-full max-w-lg animate-fade-in rounded-2xl border border-white/60 bg-white p-6 shadow-2xl sm:p-7"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600">
                  Task details
                </p>
                <h3
                  id="edit-task-title"
                  className="mt-1 text-xl font-bold text-slate-900"
                >
                  Edit task
                </h3>
              </div>
              <button
                onClick={() => setEditingTask(null)}
                aria-label="Close edit dialog"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveEdit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="edit-title"
                  className="mb-2 block text-xs font-bold text-slate-600"
                >
                  Task title
                </label>
                <input
                  id="edit-title"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  required
                  maxLength={120}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </div>

              <div>
                <label htmlFor="edit-description" className="mb-2 block text-xs font-bold text-slate-600">
                  Description <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Add notes or context for this task..."
                  className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="edit-priority"
                    className="mb-2 block text-xs font-bold text-slate-600"
                  >
                    Priority
                  </label>
                  <select
                    id="edit-priority"
                    value={editPriority}
                    onChange={(event) =>
                      setEditPriority(event.target.value as Priority)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-violet-400"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="edit-category"
                    className="mb-2 block text-xs font-bold text-slate-600"
                  >
                    Category
                  </label>
                  <select
                    id="edit-category"
                    value={editCategory}
                    onChange={(event) => setEditCategory(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-violet-400"
                  >
                    {categories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="edit-date"
                  className="mb-2 block text-xs font-bold text-slate-600"
                >
                  Due date
                </label>
                <input
                  id="edit-date"
                  type="date"
                  value={editDueDate}
                  onChange={(event) => setEditDueDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-violet-400"
                />
              </div>

              <div className="flex gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task details drawer */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/45 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedTask(null);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-drawer-title"
            className="ml-auto flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl animate-fade-in"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-6 sm:px-8">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600">Task overview</p>
                <h3 id="task-drawer-title" className="mt-2 text-xl font-bold text-slate-900">Task details</h3>
                <p className="mt-1 text-sm text-slate-500">Review the information and manage this task.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                aria-label="Close task details"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="flex-1 space-y-6 px-6 py-7 sm:px-8">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${priorityStyles[selectedTask.priority]}`}>
                    {selectedTask.priority} priority
                  </span>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {selectedTask.category}
                  </span>
                  <span className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${selectedTask.completed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {selectedTask.completed ? "Completed" : "Pending"}
                  </span>
                </div>
                <h4 className={`mt-5 break-words text-2xl font-bold tracking-tight ${selectedTask.completed ? "text-slate-400 line-through" : "text-slate-900"}`}>
                  {selectedTask.title}
                </h4>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Description</p>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                  {selectedTask.description?.trim() || "No description has been added to this task."}
                </p>
              </section>

              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium text-slate-400">Due date</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{formatDate(selectedTask.dueDate)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium text-slate-400">Created on</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {selectedTask.createdAt
                      ? selectedTask.createdAt.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      : "Date unavailable"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
                  <p className="text-xs font-medium text-slate-400">Completion</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {selectedTask.completed
                      ? selectedTask.completedAt
                        ? `Completed on ${selectedTask.completedAt.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                        : "Marked as completed"
                      : "Not completed yet"}
                  </p>
                </div>
              </section>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-slate-100 px-6 py-5 sm:px-8">
              <button
                type="button"
                onClick={() => {
                  const taskToEdit = selectedTask;
                  setSelectedTask(null);
                  openEdit(taskToEdit);
                }}
                className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700"
              >
                Edit task
              </button>
              <button
                type="button"
                onClick={() => {
                  const taskId = selectedTask.id;
                  setSelectedTask(null);
                  void deleteTask(taskId);
                }}
                className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => {
                  void toggleTask(selectedTask);
                  setSelectedTask(null);
                }}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                {selectedTask.completed ? "Reopen task" : "Mark complete"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}