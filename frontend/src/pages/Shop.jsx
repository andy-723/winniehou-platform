import { useEffect, useState } from "react";
import { ShoppingBag, Check, FileDown } from "lucide-react";
import { toast } from "sonner";
import { api, fmt } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { Spinner, PageHeader, Empty } from "@/components/Shared";

export default function Shop() {
  const [products, setProducts] = useState(null);
  const cart = useCart();
  useEffect(() => { api.get("/products").then((r) => setProducts(r.data)).catch(() => setProducts([])); }, []);

  const add = (p) => {
    cart.add({ type: "product", id: p.id, title: p.title, price: p.price, image: p.image_url });
    toast.success(`${p.title} added to cart`);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-16" data-testid="shop-page">
      <PageHeader eyebrow="Digital workbooks" title="Tools that travel with you." sub="Downloadable PDFs designed to complement the courses. Buy once, keep forever, open on any device." />
      {products === null ? <Spinner /> : products.length === 0 ? <Empty title="No products yet" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid="shop-grid">
          {products.map((p, i) => (
            <div key={p.id} className="card-lux flex flex-col rise" style={{ animationDelay: `${i * 80}ms` }} data-testid={`product-card-${p.id}`}>
              <div className="aspect-[4/3] overflow-hidden bg-stone-100 relative">
                <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                <span className="absolute top-3 left-3 gold-badge"><FileDown size={12} className="mr-1" /> PDF</span>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <h3 className="font-serif text-xl text-[#0A192F]">{p.title}</h3>
                <p className="text-sm text-slate-500 mt-2 flex-1 leading-relaxed">{p.description}</p>
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                  <span className="font-serif text-2xl text-[#0A192F]">{fmt(p.price)}</span>
                  <button onClick={() => add(p)} disabled={cart.has(p.id)} data-testid={`add-product-${p.id}`}
                    className="btn-navy !py-2 !px-4 !text-sm disabled:opacity-50">
                    {cart.has(p.id) ? <><Check size={14} /> In cart</> : <><ShoppingBag size={14} /> Add</>}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
