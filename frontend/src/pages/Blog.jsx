import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fmtDate } from "@/lib/api";
import { Spinner, PageHeader, Empty } from "@/components/Shared";

export default function Blog() {
  const [posts, setPosts] = useState(null);
  useEffect(() => { api.get("/blog").then((r) => setPosts(r.data)).catch(() => setPosts([])); }, []);
  return (
    <div className="max-w-6xl mx-auto px-6 py-16" data-testid="blog-page">
      <PageHeader eyebrow="Journal" title="Notes on language & leadership" sub="Short, practical articles and course announcements from Winnie." />
      {posts === null ? <Spinner /> : posts.length === 0 ? <Empty title="No posts yet" /> : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {posts.map((p, i) => (
            <Link key={p.id} to={`/blog/${p.slug}`} data-testid={`post-card-${p.slug}`}
              className={`card-lux group rise ${i === 0 ? "md:col-span-12 md:grid md:grid-cols-2" : "md:col-span-6"}`} style={{ animationDelay: `${i * 90}ms` }}>
              <div className={`${i === 0 ? "aspect-[4/3] md:aspect-auto" : "aspect-[16/9]"} overflow-hidden bg-stone-100`}>
                <img src={p.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="p-8 flex flex-col justify-center">
                <div className="flex gap-2 mb-3">{p.tags.map((t) => <span key={t} className="gold-badge">{t}</span>)}</div>
                <h2 className={`font-serif text-[#0A192F] group-hover:text-amber-700 transition-colors ${i === 0 ? "text-3xl" : "text-xl"}`}>{p.title}</h2>
                <p className="text-sm text-slate-500 mt-3 leading-relaxed line-clamp-3">{p.excerpt}</p>
                <div className="text-xs text-slate-400 mt-5">{fmtDate(p.published_at)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  useEffect(() => { api.get(`/blog/${slug}`).then((r) => setPost(r.data)).catch(() => setPost(false)); }, [slug]);
  if (post === null) return <Spinner />;
  if (post === false) return <div className="text-center py-32 font-serif text-2xl">Post not found.</div>;
  return (
    <article className="max-w-3xl mx-auto px-6 py-16" data-testid="blog-post-page">
      <Link to="/blog" className="text-sm text-slate-500 hover:text-slate-800">← All posts</Link>
      <div className="flex gap-2 mt-8 mb-4">{post.tags.map((t) => <span key={t} className="gold-badge">{t}</span>)}</div>
      <h1 className="font-serif text-4xl sm:text-5xl text-[#0A192F] leading-tight" data-testid="post-title">{post.title}</h1>
      <div className="text-sm text-slate-400 mt-4">By Winnie Hou · {fmtDate(post.published_at)}</div>
      {post.cover_url && <img src={post.cover_url} alt="" className="w-full aspect-[2/1] object-cover rounded-xl mt-10 shadow-lg" />}
      <div className="prose-lux mt-10 text-lg" dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}
