import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, BookOpen, Users, Receipt, Ticket, Package, Newspaper, ExternalLink, HeartHandshake, UserCog, Timer, BarChart3, Contact2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import TimerBar from "@/components/TimerBar";

const items = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/courses", label: "Courses", icon: BookOpen },
  { to: "/admin/services", label: "Services", icon: HeartHandshake },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/prospects", label: "Prospects", icon: Contact2 },
  { to: "/admin/clients", label: "Clients", icon: UserCog },
  { to: "/admin/time", label: "Time", icon: Timer },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/orders", label: "Orders & refunds", icon: Receipt },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/products", label: "Shop products", icon: Package },
  { to: "/admin/blog", label: "Blog", icon: Newspaper },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex bg-[#F3F3EE]" data-testid="admin-layout">
      <aside className="w-64 shrink-0 bg-[#0A192F] text-slate-300 flex flex-col sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="font-serif tracking-[0.25em] text-amber-400">WINNIE HOU</div>
          <div className="text-[11px] uppercase tracking-widest text-slate-500 mt-1">Admin CMS</div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} data-testid={`admin-nav-${i.label.split(" ")[0].toLowerCase()}`}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? "bg-amber-500/15 text-amber-300" : "hover:bg-white/5 hover:text-white"}`}>
              <i.icon size={16} /> {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-5 border-t border-white/10 text-xs">
          <div className="text-white truncate">{user?.name}</div>
          <div className="text-slate-500 truncate">{user?.email}</div>
          <div className="flex gap-3 mt-3">
            <Link to="/" className="flex items-center gap-1 hover:text-white" data-testid="admin-view-site"><ExternalLink size={12} /> View site</Link>
            <button onClick={logout} className="hover:text-white" data-testid="admin-logout">Sign out</button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col"><TimerBar /><div className="p-8 lg:p-12 flex-1"><Outlet /></div></main>
    </div>
  );
}

export const AdminHeader = ({ title, sub, right }) => (
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
    <div><h1 className="font-serif text-3xl text-[#0A192F]">{title}</h1>{sub && <p className="text-sm text-slate-500 mt-1">{sub}</p>}</div>
    {right}
  </div>
);

export const Table = ({ cols, rows, render, testId, empty = "Nothing here yet." }) => (
  <div className="card-lux overflow-x-auto">
    <table className="w-full text-sm" data-testid={testId}>
      <thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-slate-500">
        <tr>{cols.map((c) => <th key={c} className="text-left px-4 py-3 font-semibold">{c}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.length === 0 ? <tr><td colSpan={cols.length} className="px-4 py-10 text-center text-slate-400">{empty}</td></tr> : rows.map(render)}
      </tbody>
    </table>
  </div>
);

export const Modal = ({ open, onClose, title, children, wide }) => open ? (
  <div className="fixed inset-0 z-50 bg-[#0A192F]/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className={`bg-white rounded-xl shadow-2xl w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto`} data-testid="modal">
      <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center"><h2 className="font-serif text-xl text-[#0A192F]">{title}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none" data-testid="modal-close">×</button></div>
      <div className="p-6">{children}</div>
    </div>
  </div>
) : null;
