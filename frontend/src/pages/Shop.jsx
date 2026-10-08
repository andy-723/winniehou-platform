import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, Check, FileDown, Mail } from "lucide-react";
import { toast } from "sonner";
import { api, fmt } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { Spinner, PageHeader, Empty } from "@/components/Shared";
import { PUBLIC_PRICING } from "@/lib/config";

export default function Shop() {
  const [products, setProducts] = useState(null);
  const cart = useCart();
  useEffect(() => { api.get("/products").then((r) => setProducts(r.data)).catch(() => setProducts([])); }, []);

  const add = (p) => {
    cart.add({ type: "product", id: p.id, title: p.title, price: p.price, image: p.image_url });
    toast.success(`${p.title} added to cart`);
  };

  return (
    <div className="bg-[#0A192F] min-h-screen" data-testid="shop-page">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <PageHeader eyebrow="Digital workbooks" title="Tools that travel with you." sub="Downloadable PDFs designed to complement the courses. Buy once, keep forever, open on any device." />
        {products === null ? <Spinner /> : products.length === 0 ? <Empty title="No products yet" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid="shop-grid">
            {products.map((p, i) => (
              <div key={p.id} className="card-dark flex flex-col rise hover:border-[#D4AF37]/50 hover:-translate-y-1 transition-[border-color,transform] duration-300" style={{ animationDelay: `${i * 80}ms` }} data-testid={`product-card-${p.id}`}>
                <div className="aspect-[4/3] overflow-hidden bg-[#050E1E] relative">
                  <img src={p.image_url} alt={p.title} className="w-full h-full object-cover opacity-90" />
                  <span className="absolute top-3 left-3 gold-badge"><FileDown size={12} className="mr-1" /> PDF</span>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-serif text-xl text-[#F9F8F3]">{p.title}</h3>
                  <p className="text-sm text-slate-400 mt-2 flex-1 leading-relaxed">{p.description}</p>
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                    {PUBLIC_PRICING ? (
                      <>
                        <span className="font-serif text-2xl text-[#F9F8F3]">{fmt(p.price)}</span>
                        <button onClick={() => add(p)} disabled={cart.has(p.id)} data-testid={`add-product-${p.id}`}
                          className="btn-gold !py-2 !px-4 !text-sm disabled:opacity-50">
                          {cart.has(p.id) ? <><Check size={14} /> In cart</> : <><ShoppingBag size={14} /> Add</>}
                        </button>
                      </>
                    ) : (
                      <Link to={`/contact?subject=${encodeURIComponent(p.title)}`} className="btn-gold-outline !py-2 !px-4 !text-sm ml-auto" data-testid={`enquire-product-${p.id}`}>
                        <Mail size={14} /> Enquire
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
