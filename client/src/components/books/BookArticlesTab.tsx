import React, { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Bookmark, BookmarkCheck, Eye, MessageCircle } from "lucide-react";

type ArticleTag = { id: string; axis: string; name: string; slug: string };

type ArticleAuthor = {
  id: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
};

type BookLinkMeta = { role: "primary" | "in_list" | "mentioned"; sortOrder: number };

type ArticleCard = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  section: string | null;
  format: string | null;
  lang: string;
  views: number;
  commentsCount: number;
  publishedAt: string | null;
  createdAt: string;
  author?: ArticleAuthor;
  tags: ArticleTag[];
  isReadLater?: boolean;
  bookLink?: BookLinkMeta;
};

type ApiResult = {
  articles: ArticleCard[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function BookArticlesTab({ bookId, onTotalChange }: { bookId: string; onTotalChange?: (total: number) => void }) {
  const [role, setRole] = useState<"all" | "primary" | "in_list" | "mentioned">("all");
  const [sortBy, setSortBy] = useState<"publishedAt" | "views" | "sortOrder">("publishedAt");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const [page, setPage] = useState(1);
  const [limit] = useState(12);

  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);

  const authToken = localStorage.getItem("authToken") || "";
  
  const headers = useMemo(() => {
    return authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
  }, [authToken]);

  // If chose role=in_list — it makes sense to sort by sortOrder asc
  useEffect(() => {
    if (role === "in_list") {
      setSortBy("sortOrder");
      setSortOrder("asc");
    } else if (sortBy === "sortOrder") {
      // if leaving in_list, revert to publishedAt desc
      setSortBy("publishedAt");
      setSortOrder("desc");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // When filters change — reset page
  useEffect(() => {
    setPage(1);
  }, [role, sortBy, sortOrder]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("page", String(page));
        qs.set("limit", String(limit));
        qs.set("sortBy", sortBy);
        qs.set("sortOrder", sortOrder);
        if (role !== "all") qs.set("role", role);

        const res = await fetch(`/api/books/${bookId}/articles?${qs.toString()}`, { headers });
        if (!res.ok) throw new Error(`Failed: ${res.status}`);

        const json = (await res.json()) as ApiResult;
        setData(json);
        onTotalChange?.(json.total ?? 0);
      } catch (e) {
        console.error(e);
        // Don't reset the counter to 0 on error - keep previous value
        // setData({ articles: [], total: 0, page, limit, totalPages: 1 });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [bookId, page, limit, role, sortBy, sortOrder, authToken, onTotalChange]);

  const toggleReadLater = async (article: ArticleCard) => {
    // Optimistically
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        articles: prev.articles.map(a =>
          a.id === article.id ? { ...a, isReadLater: !a.isReadLater } : a
        ),
      };
    });

    try {
      const endpoint = `/api/articles/${article.id}/read-later`;
      const method = article.isReadLater ? "DELETE" : "POST"; // was true → remove
      const res = await fetch(endpoint, { method, headers: headers ?? {} });
      if (!res.ok) throw new Error(`ReadLater failed: ${res.status}`);
    } catch (e) {
      console.error(e);
      // rollback
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          articles: prev.articles.map(a =>
            a.id === article.id ? { ...a, isReadLater: article.isReadLater } : a
          ),
        };
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={role} onValueChange={(v) => setRole(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Роль" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="primary">Основные</SelectItem>
              <SelectItem value="in_list">В подборках</SelectItem>
              <SelectItem value="mentioned">Упоминания</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Сортировка" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="publishedAt">По дате публикации</SelectItem>
              <SelectItem value="views">По просмотрам</SelectItem>
              <SelectItem value="sortOrder">По порядку в списке</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Порядок" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">По убыванию</SelectItem>
              <SelectItem value="asc">По возрастанию</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground">
          {data ? `Найдено: ${data.total}` : " "}
        </div>
      </div>

      {/* List */}
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка…
        </div>
      )}

      {!loading && data && data.articles.length === 0 && (
        <div className="text-sm text-muted-foreground">Пока нет статей по этой книге.</div>
      )}

      <div className="grid gap-3">
        {data?.articles.map((a) => {
          const authorName = a.author?.fullName || a.author?.username || "Reader";
          const chips = (a.tags || []).slice(0, 4);

          return (
            <Card key={a.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/articles/${a.slug}`}>
                      <a className="font-semibold leading-snug hover:underline line-clamp-2">
                        {a.title}
                      </a>
                    </Link>

                    {a.excerpt && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {a.excerpt}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleReadLater(a)}
                    title={a.isReadLater ? "Убрать из читать позже" : "Добавить в читать позже"}
                    disabled={!authToken}
                  >
                    {a.isReadLater ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Автор: {authorName}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {a.views ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {a.commentsCount ?? 0}
                  </span>

                  {a.bookLink?.role && (
                    <>
                      <span>•</span>
                      <Badge variant="secondary" className="text-xs">
                        {a.bookLink.role === "primary"
                          ? "Основная"
                          : a.bookLink.role === "in_list"
                            ? `В подборке #${a.bookLink.sortOrder ?? 0}`
                            : "Упоминание"}
                      </Badge>
                    </>
                  )}
                </div>

                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {chips.map((t) => (
                      <Badge key={t.slug} variant="outline" className="text-xs">
                        {t.name}
                      </Badge>
                    ))}
                    {(a.tags?.length ?? 0) > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{(a.tags.length - 4)}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={loading || page <= 1}
          >
            Назад
          </Button>

          <div className="text-sm text-muted-foreground">
            Страница {page} из {data.totalPages}
          </div>

          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            disabled={loading || page >= data.totalPages}
          >
            Вперёд
          </Button>
        </div>
      )}
    </div>
  );
}