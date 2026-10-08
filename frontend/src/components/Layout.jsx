import { Link, NavLink, useNavigate } from "react-router-dom";
import { ShoppingBag, LogOut, LayoutDashboard, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { PUBLIC_PRICING } from "@/lib/config";

const links = [
  { to: "/about", label: "About" },
  { to: "/courses", label: "Courses" },
  { to: "/services", label: "Services" },
  { to: "/shop", label: "Shop" },
  { to: "/blog", label: "Blog" },
  { to: "/contact", label: "Contact" },
];

export const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();
  const { count } = useCart();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const cls = ({ isActive }) =>
    `text-sm tracking-wide transition-colors ${isActive ? "text-amber-400" : "text-slate-300 hover:text-white"}`;

  return (
    <header className="sticky top-0 z-50 bg-[#0A192F]/95 backdrop-blur-md border-b border-amber-500/20 text-white">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        <Link to="/" data-testid="nav-logo" className="font-serif text-lg tracking-[0.25em] text-amber-400">
          WINNIE HOU
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={cls} data-testid={`nav-${l.label.toLowerCase()}`}>{l.label}</NavLink>
          ))}
          {user && <NavLink to="/dashboard" className={cls} data-testid="nav-my-learning">My Learning</NavLink>}
        </nav>
        <div className="flex items-center gap-3">
          {PUBLIC_PRICING && (
            <Link to="/cart" data-testid="nav-cart" className="relative p-2 rounded-lg hover:bg-white/5 transition-colors">
              <ShoppingBag size={18} />
              {count > 0 && (
                <span data-testid="nav-cart-count" className="absolute -top-0.5 -right-0.5 bg-amber-500 text-[#0A192F] text-[10px] font-bold rounded-full w-4.5 h-4.5 min-w-[18px] px-1 flex items-center justify-center">{count}</span>
              )}
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" data-testid="nav-admin" className="hidden md:inline-flex items-center gap-1.5 text-xs border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition-colors">
              <LayoutDashboard size={14} /> Admin
            </Link>
          )}
          {user ? (
            <button data-testid="nav-logout" onClick={() => { logout(); nav("/"); }} className="hidden md:inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition-colors">
              <LogOut size={15} /> Sign out
            </button>
          ) : (
            <Link to="/login" data-testid="nav-login" className="hidden md:inline-flex bg-amber-500 hover:bg-amber-400 text-[#0A192F] text-sm font-semibold px-4 py-2 rounded-lg transition-colors">Sign in</Link>
          )}
          <button className="md:hidden p-2" onClick={() => setOpen(!open)} data-testid="nav-mobile-toggle">{open ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-white/10 px-6 py-4 flex flex-col gap-3 bg-[#0A192F]">
          {links.map((l) => <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className={cls}>{l.label}</NavLink>)}
          {user && <NavLink to="/dashboard" onClick={() => setOpen(false)} className={cls}>My Learning</NavLink>}
          {isAdmin && <NavLink to="/admin" onClick={() => setOpen(false)} className={cls}>Admin</NavLink>}
          {user ? <button onClick={() => { logout(); nav("/"); }} className="text-left text-sm text-slate-300">Sign out</button>
                : <Link to="/login" onClick={() => setOpen(false)} className="text-sm text-amber-400">Sign in</Link>}
        </div>
      )}
    </header>
  );
};

export const Footer = () => (
  <footer className="bg-[#060F1E] text-slate-400 mt-24">
    <div className="gold-rule" />
    <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-12 gap-10">
      <div className="md:col-span-5">
        <div className="font-serif text-xl tracking-[0.25em] text-amber-400 mb-4">WINNIE HOU</div>
        <p className="text-sm leading-relaxed max-w-sm">Business English mastery for ambitious professionals. Self-paced video courses, practical workbooks, and the language of leadership.</p>
      </div>
      <div className="md:col-span-3">
        <div className="eyebrow mb-4">Explore</div>
        <ul className="space-y-2 text-sm">
          <li><Link to="/about" className="hover:text-white transition-colors">About Winnie</Link></li>
          <li><Link to="/courses" className="hover:text-white transition-colors">All courses</Link></li>
          <li><Link to="/services" className="hover:text-white transition-colors">Coaching services</Link></li>
          <li><Link to="/shop" className="hover:text-white transition-colors">Workbooks</Link></li>
          <li><Link to="/blog" className="hover:text-white transition-colors">Blog & announcements</Link></li>
          <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
        </ul>
      </div>
      <div className="md:col-span-4">
        <div className="eyebrow mb-4">Account</div>
        <ul className="space-y-2 text-sm">
          <li><Link to="/dashboard" className="hover:text-white transition-colors">My learning</Link></li>
          <li><Link to="/dashboard?tab=orders" className="hover:text-white transition-colors">Orders & receipts</Link></li>
          <li><Link to="/login" className="hover:text-white transition-colors">Sign in</Link></li>
        </ul>
      </div>
    </div>
    <div className="border-t border-white/5 py-5 text-center text-xs text-slate-600">© {new Date().getFullYear()} Winnie Hou. All rights reserved.</div>
  </footer>
);
