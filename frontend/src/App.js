import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { Navbar, Footer } from "@/components/Layout";
import { Spinner } from "@/components/Shared";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Services from "@/pages/Services";
import Contact from "@/pages/Contact";
import Start from "@/pages/Start";
import Catalog from "@/pages/Catalog";
import CourseDetail from "@/pages/CourseDetail";
import Player from "@/pages/Player";
import Shop from "@/pages/Shop";
import Cart from "@/pages/Cart";
import { PaymentSuccess, PaymentCancel } from "@/pages/PaymentResult";
import Dashboard, { OrderReceipt } from "@/pages/Dashboard";
import Blog, { BlogPost } from "@/pages/Blog";
import { Terms, Privacy, Disclaimer } from "@/pages/Legal";
import { Login, Register, ForgotPassword, ResetPassword } from "@/pages/Auth";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminCourses from "@/pages/admin/AdminCourses";
import CourseEditor from "@/pages/admin/CourseEditor";
import AdminStudents from "@/pages/admin/AdminStudents";
import AdminServices from "@/pages/admin/AdminServices";
import AdminClients from "@/pages/admin/AdminClients";
import AdminTime from "@/pages/admin/AdminTime";
import AdminReports from "@/pages/admin/AdminReports";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminCoupons from "@/pages/admin/AdminCoupons";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminBlog from "@/pages/admin/AdminBlog";

const Public = () => (
  <div className="flex flex-col min-h-screen">
    <Navbar />
    <main className="flex-1"><Outlet /></main>
    <Footer />
  </div>
);

const Protected = ({ admin = false }) => {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === null) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (admin && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Public />}>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/services" element={<Services />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/start" element={<Start />} />
                <Route path="/courses" element={<Catalog />} />
                <Route path="/courses/:slug" element={<CourseDetail />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/disclaimer" element={<Disclaimer />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/payment/cancel" element={<PaymentCancel />} />
                <Route element={<Protected />}>
                  <Route path="/payment/success" element={<PaymentSuccess />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/orders/:id" element={<OrderReceipt />} />
                </Route>
              </Route>
              <Route path="/learn/:slug" element={<Player />} />
              <Route element={<Protected admin />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="courses" element={<AdminCourses />} />
                  <Route path="courses/:id" element={<CourseEditor />} />
                  <Route path="students" element={<AdminStudents />} />
                  <Route path="services" element={<AdminServices />} />
                  <Route path="clients" element={<AdminClients />} />
                  <Route path="time" element={<AdminTime />} />
                  <Route path="reports" element={<AdminReports />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="coupons" element={<AdminCoupons />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="blog" element={<AdminBlog />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </CartProvider>
      </AuthProvider>
    </div>
  );
}
