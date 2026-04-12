import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "https://api.hriatrengna.in";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://hriatrengna.in";
const CDN = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://cdn.hriatrengna.in";

const PAGE_BG = "linear-gradient(180deg, #FFF7FB 0%, #F8F7F5 24%, #F8F7F5 100%)";
const SURFACE = "#FFFFFF";
const BORDER = "1px solid rgba(219,39,119,0.08)";
const SHADOW = "0 20px 45px rgba(113,36,75,0.08)";

// shellStyle is built inside the component where dynBg/dynFont are available
const shellStyle = {
  minHeight: "100svh",
  background: PAGE_BG,
  fontFamily: "Inter, sans-serif",
  color: "#2C2A28",
};

const centerCardStyle = {
  maxWidth: 560,
  width: "100%",
  background: SURFACE,
  border: BORDER,
  borderRadius: 28,
  boxShadow: SHADOW,
  padding: "2rem",
  textAlign: "center",
};

function isVideoMedia(item) {
  return (
    item?.type === "video" ||
    item?.typeCategory === "video" ||
    item?.mime_type?.startsWith("video/")
  );
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getAlbumLabel(albumLabel) {
  const labels = {
    "pre-wedding": { label: "Pre-Wedding", icon: "PW" },
    "wedding-day": { label: "Wedding Day", icon: "WD" },
    honeymoon: { label: "Honeymoon", icon: "HM" },
    anniversary: { label: "Anniversary", icon: "AN" },
  };
  return labels[albumLabel] || { label: "Album", icon: "AL" };
}

function LoadingState() {
  return (
    <div style={shellStyle}>
      <style>{`
        @keyframes weddingPulse {
          0% { opacity: 0.55; }
          50% { opacity: 1; }
          100% { opacity: 0.55; }
        }
      `}</style>
      <div
        style={{
          height: "58vh",
          minHeight: 400,
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #FCE7F3 0%, #F9D7EA 45%, #F5F3FF 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at top, rgba(255,255,255,0.7), transparent 45%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "2rem",
            transform: "translateX(-50%)",
            width: "min(620px, calc(100% - 2rem))",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 132,
              height: 132,
              margin: "0 auto 1rem",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.78)",
              animation: "weddingPulse 1.4s ease-in-out infinite",
            }}
          />
          <div
            style={{
              width: "68%",
              height: 22,
              margin: "0 auto 0.8rem",
              borderRadius: 999,
              background: "rgba(255,255,255,0.8)",
              animation: "weddingPulse 1.4s ease-in-out infinite",
            }}
          />
          <div
            style={{
              width: "42%",
              height: 14,
              margin: "0 auto",
              borderRadius: 999,
              background: "rgba(255,255,255,0.68)",
              animation: "weddingPulse 1.4s ease-in-out infinite",
            }}
          />
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "-2.5rem auto 0", padding: "0 1rem 4rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
          {[1, 2, 3, 4].map((item) => (
            <div key={item} style={{ background: SURFACE, border: BORDER, borderRadius: 22, boxShadow: SHADOW, padding: "1.1rem" }}>
              <div style={{ width: 70, height: 12, borderRadius: 999, background: "#F3E8FF", marginBottom: "0.9rem", animation: "weddingPulse 1.4s ease-in-out infinite" }} />
              <div style={{ width: "58%", height: 28, borderRadius: 999, background: "#FCE7F3", marginBottom: "0.55rem", animation: "weddingPulse 1.4s ease-in-out infinite" }} />
              <div style={{ width: "80%", height: 12, borderRadius: 999, background: "#F9FAFB", animation: "weddingPulse 1.4s ease-in-out infinite" }} />
            </div>
          ))}
        </div>
        <div style={{ background: SURFACE, border: BORDER, borderRadius: 26, boxShadow: SHADOW, padding: "1.25rem" }}>
          <div style={{ width: 120, height: 12, borderRadius: 999, background: "#F3E8FF", marginBottom: "1rem", animation: "weddingPulse 1.4s ease-in-out infinite" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
            {[1, 2, 3, 4].map((item) => (
              <div key={item} style={{ aspectRatio: "1", borderRadius: 18, background: "#F9FAFB", animation: "weddingPulse 1.4s ease-in-out infinite" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error }) {
  return (
    <div style={{ ...shellStyle, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <div style={centerCardStyle}>
        <div style={{ fontSize: "0.78rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "#BE185D", fontWeight: 700, marginBottom: "0.75rem" }}>
          Wedding Collection
        </div>
        <h1 style={{ fontSize: "1.8rem", marginBottom: "0.75rem", fontFamily: "Manrope, serif", color: "#2C2A28" }}>
          {error}
        </h1>
        <p style={{ color: "#666", lineHeight: 1.7, marginBottom: "1.25rem" }}>
          This page may be unpublished, moved, or temporarily unavailable.
        </p>
        <a
          href={APP_URL}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.8rem 1.25rem",
            borderRadius: 999,
            background: "#DB2777",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
            boxShadow: "0 14px 28px rgba(219,39,119,0.18)",
          }}
        >
          Return to home
        </a>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(10px)",
        border: BORDER,
        borderRadius: 22,
        padding: "1rem 1.1rem",
        boxShadow: SHADOW,
      }}
    >
      <div style={{ fontSize: "0.76rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#9D174D", fontWeight: 700, marginBottom: "0.45rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#2C2A28", marginBottom: "0.3rem" }}>
        {value}
      </div>
      <div style={{ fontSize: "0.82rem", color: "#6B7280", lineHeight: 1.5 }}>{sub}</div>
    </div>
  );
}

function WeddingTributeWidget({ slug, allowWishes, onSubmitted }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (!allowWishes) return null;

  const submit = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/public/album/${slug}/wishes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestName: name.trim() || "Anonymous", message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSent(true);
      onSubmitted?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Leave a Wish"
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            zIndex: 1000,
            minWidth: 54,
            height: 54,
            padding: "0 1rem",
            borderRadius: 999,
            background: "#C9A84C",
            color: "#111",
            border: "none",
            cursor: "pointer",
            fontSize: "0.95rem",
            fontWeight: 700,
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          }}
        >
          Wish
        </button>
      )}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1001,
            background: "#fff",
            borderTop: "1px solid #E8EAED",
            borderRadius: "20px 20px 0 0",
            padding: "1.5rem 1.5rem calc(1.5rem + env(safe-area-inset-bottom))",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
            maxWidth: 520,
            margin: "0 auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a1a" }}>Leave a Wish</div>
            <button
              onClick={() => {
                setOpen(false);
                setSent(false);
              }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "#aaa" }}
            >
              x
            </button>
          </div>
          {sent ? (
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div style={{ fontWeight: 600, color: "#1a1a1a" }}>Your wish has been shared!</div>
            </div>
          ) : (
            <>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                style={{
                  width: "100%",
                  border: "1.5px solid #E8EAED",
                  borderRadius: 10,
                  padding: "0.6rem 0.9rem",
                  fontSize: "0.9rem",
                  outline: "none",
                  marginBottom: "0.5rem",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Wishing you both a lifetime of love..."
                rows={4}
                style={{
                  width: "100%",
                  border: "1.5px solid #E8EAED",
                  borderRadius: 10,
                  padding: "0.6rem 0.9rem",
                  fontSize: "0.9rem",
                  outline: "none",
                  resize: "none",
                  marginBottom: "0.75rem",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              {error && <div style={{ color: "#DC2626", fontSize: "0.82rem", marginBottom: "0.5rem" }}>{error}</div>}
              <button
                onClick={submit}
                disabled={sending || !message.trim()}
                style={{
                  width: "100%",
                  background: "#C9A84C",
                  color: "#111",
                  border: "none",
                  borderRadius: 10,
                  padding: "0.8rem",
                  fontWeight: 700,
                  fontSize: "0.92rem",
                  cursor: "pointer",
                  opacity: sending || !message.trim() ? 0.5 : 1,
                }}
              >
                {sending ? "Sending..." : "Send Wish"}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default function WeddingCollection() {
  const router = useRouter();
  const { slug } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [publicWishes, setPublicWishes] = useState([]);
  const [wishesLoading, setWishesLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    setError(null);

    fetch(`${API}/api/public/wedding/${slug}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server error: ${res.status}`);
        }
        return res.json();
      })
      .then((result) => {
        if (result.error) {
          setError(result.error);
          return;
        }
        setData(result);
      })
      .catch((err) => {
        console.error("Wedding page error:", err);
        setError("Failed to load wedding collection");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const user = data?.user || {};
  const albums = data?.albums || [];
  const primaryAlbum = selectedAlbum || albums[0] || null;

  // ── Apply photographer custom theme if set ───────────────────
  const customConfig  = primaryAlbum?.custom_theme_config || {};
  const customColors  = customConfig.customColors || {};
  const customFont    = customConfig.fontFamily || null;
  // Dynamic style tokens — override defaults when photographer customised
  const dynAccent     = customColors.accent || '#C9607a';
  const dynBg         = customColors.bg     || null;
  const dynText       = customColors.text   || null;
  const dynFont       = customFont ? `'${customFont}', Inter, sans-serif` : 'Inter, sans-serif';
  const dynLayout     = customConfig.layout || 'grid';
  // Computed shell style with dynamic overrides
  const dynShellStyle = { ...shellStyle, background: dynBg || PAGE_BG, fontFamily: dynFont };
  const dynShowDates  = customConfig.showDates !== false;
  const dynShowBio    = customConfig.showBio   !== false;
  const dynShowCaps   = customConfig.showCaptions !== false;
  const wishesSlug = primaryAlbum?.slug || slug;

  const currentMedia = selectedAlbum
    ? [...(selectedAlbum.media?.photos || []), ...(selectedAlbum.media?.videos || [])]
    : albums.flatMap((album) => [...(album.media?.photos || []), ...(album.media?.videos || [])]);

  const currentAlbumName = selectedAlbum ? selectedAlbum.name || "Selected Album" : "All Albums";
  const heroImage = user.cover_photo || (primaryAlbum?.cover_key ? `${CDN}/${primaryAlbum.cover_key}` : null);
  const profileImage = user.profile_photo || (primaryAlbum?.avatar_key ? `${CDN}/${primaryAlbum.avatar_key}` : null);
  const coupleNames =
    user.partner1_name && user.partner2_name
      ? `${user.partner1_name} & ${user.partner2_name}`
      : user.partner1_name || primaryAlbum?.name || "Our Wedding";

  const photoCount = currentMedia.filter((item) => !isVideoMedia(item)).length;
  const videoCount = currentMedia.filter((item) => isVideoMedia(item)).length;
  const totalMoments = currentMedia.length;

  const loadPublicWishes = async (targetSlug) => {
    if (!targetSlug) {
      setPublicWishes([]);
      return;
    }
    setWishesLoading(true);
    try {
      const res = await fetch(`${API}/api/public/album/${targetSlug}/wishes`);
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to load wishes");
      }
      setPublicWishes(result.items || []);
    } catch (wishError) {
      console.error("Failed to load wedding wishes:", wishError);
      setPublicWishes([]);
    } finally {
      setWishesLoading(false);
    }
  };

  useEffect(() => {
    if (!wishesSlug) return;
    loadPublicWishes(wishesSlug);
  }, [wishesSlug]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <>
      <Head>
        <title>{coupleNames} - Wedding</title>
        <meta name="description" content={user.biography || "Our wedding memories"} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#F8F7F5" />
      </Head>

      <div style={dynShellStyle}>
        <div
          style={{
            height: "60vh",
            minHeight: 400,
            position: "relative",
            background: heroImage
              ? `linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.55)), url(${heroImage})`
              : "linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 50%, #F5F3FF 100%)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, transparent 48%, rgba(15,23,42,0.62))",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "2rem",
              left: "50%",
              transform: "translateX(-50%)",
              textAlign: "center",
              color: "white",
              width: "100%",
              maxWidth: 640,
              padding: "0 1rem",
            }}
          >
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: "50%",
                border: "4px solid white",
                margin: "0 auto 1rem",
                overflow: "hidden",
                background: profileImage ? `url(${profileImage})` : "#F9A8D4",
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
            >
              {!profileImage && (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", fontWeight: 700 }}>
                  W
                </div>
              )}
            </div>
            <div style={{ fontSize: "0.78rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, opacity: 0.9, marginBottom: "0.5rem" }}>
              Wedding Collection
            </div>
            <h1 style={{ fontSize: "clamp(1.9rem, 5vw, 2.8rem)", fontWeight: 700, marginBottom: "0.5rem", textShadow: "0 2px 10px rgba(0,0,0,0.3)", fontFamily: "Manrope, serif" }}>
              {coupleNames}
            </h1>
            {user.wedding_date && (
              <div style={{ fontSize: "1.05rem", opacity: 0.92, marginBottom: "0.45rem" }}>
                {formatDate(user.wedding_date)}
              </div>
            )}
            {user.venue && <div style={{ fontSize: "0.95rem", opacity: 0.84 }}>{user.venue}</div>}
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: "-2rem auto 0", padding: "0 1rem", position: "relative", zIndex: 2 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "1rem" }}>
            <StatCard label="Albums" value={albums.length} sub="Moments grouped by chapter" />
            <StatCard label="Moments" value={totalMoments} sub={currentAlbumName} />
            <StatCard label="Photos" value={photoCount} sub="Still memories" />
            <StatCard label="Videos" value={videoCount} sub="Moving memories" />
          </div>
        </div>

        <div style={{ maxWidth: 840, margin: "0 auto", padding: "2rem 1rem 1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.78rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "#BE185D", fontWeight: 700, marginBottom: "0.75rem" }}>
            Their Story
          </div>
          {user.biography ? (
            <div style={{ background: SURFACE, border: BORDER, borderRadius: 28, boxShadow: SHADOW, padding: "1.6rem 1.4rem" }}>
              <p style={{ fontSize: "1.05rem", color: "#4B5563", lineHeight: 1.8, fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                "{user.biography}"
              </p>
            </div>
          ) : (
            <div style={{ background: "rgba(255,255,255,0.72)", border: BORDER, borderRadius: 24, padding: "1.4rem 1.2rem" }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#2C2A28", marginBottom: "0.35rem" }}>
                This love story is still being written
              </div>
              <p style={{ color: "#6B7280", lineHeight: 1.7 }}>
                Photos and videos are already available below, and more story details may be added by the couple later.
              </p>
            </div>
          )}
        </div>

        {albums.length > 0 && (
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 1rem 2rem" }}>
            <div style={{ textAlign: "center", marginBottom: "0.9rem" }}>
              <div style={{ fontSize: "0.78rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "#BE185D", fontWeight: 700, marginBottom: "0.35rem" }}>
                Browse Moments
              </div>
              <div style={{ color: "#6B7280", lineHeight: 1.6 }}>
                Switch between wedding chapters or view everything together in one gallery.
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", padding: "1rem 0", overflowX: "auto", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => setSelectedAlbum(null)}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: 100,
                  border: "none",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  background: !selectedAlbum ? "#DB2777" : "white",
                  color: !selectedAlbum ? "white" : "#4B5563",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  transition: "all 0.2s",
                }}
              >
                All Moments ({currentMedia.length})
              </button>
              {albums.map((album) => {
                const count = (album.media?.photos?.length || 0) + (album.media?.videos?.length || 0);
                const label = getAlbumLabel(album.album_label);
                return (
                  <button
                    key={album.id}
                    onClick={() => setSelectedAlbum(album)}
                    style={{
                      padding: "0.6rem 1.25rem",
                      borderRadius: 100,
                      border: "none",
                      fontSize: "0.9rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      background: selectedAlbum?.id === album.id ? "#DB2777" : "white",
                      color: selectedAlbum?.id === album.id ? "white" : "#4B5563",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      transition: "all 0.2s",
                    }}
                  >
                    {label.icon} {label.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem 4rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.78rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "#BE185D", fontWeight: 700, marginBottom: "0.35rem" }}>
                Gallery
              </div>
              <h2 style={{ fontSize: "1.4rem", color: "#2C2A28", margin: 0, fontFamily: "Manrope, serif" }}>{currentAlbumName}</h2>
            </div>
            <div style={{ color: "#6B7280", fontSize: "0.9rem" }}>
              {totalMoments > 0
                ? `${totalMoments} memory${totalMoments === 1 ? "" : "ies"} ready to explore`
                : "More moments can be added over time"}
            </div>
          </div>

          {currentMedia.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1rem" }}>
              {currentMedia.map((media, idx) => (
                <div
                  key={media.id || idx}
                  onClick={() => setLightboxIndex(idx)}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 18,
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "#F3F4F6",
                    position: "relative",
                    boxShadow: "0 14px 30px rgba(15,23,42,0.08)",
                  }}
                >
                  {isVideoMedia(media) ? (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1rem",
                        fontWeight: 700,
                        background: "linear-gradient(135deg, #F3E8FF, #EDE9FE)",
                        color: "#7C3AED",
                      }}
                    >
                      Video
                    </div>
                  ) : (
                    <img
                      src={media.url}
                      alt={media.file_name || "Photo"}
                      style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s" }}
                      onMouseOver={(e) => {
                        e.target.style.transform = "scale(1.05)";
                      }}
                      onMouseOut={(e) => {
                        e.target.style.transform = "scale(1)";
                      }}
                    />
                  )}
                  {media.caption && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                        color: "white",
                        padding: "2rem 1rem 1rem",
                        fontSize: "0.85rem",
                      }}
                    >
                      {media.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "#6B7280", background: SURFACE, border: BORDER, borderRadius: 28, boxShadow: SHADOW }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 600, color: "#2C2A28", marginBottom: "0.5rem" }}>No gallery items yet</div>
              <p style={{ maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
                {selectedAlbum
                  ? "This album chapter is ready, but the couple has not added photos or videos here yet. You can switch to another chapter above."
                  : "This collection has been created, but the couple has not published any photos or videos yet. Check back soon for new memories."}
              </p>
            </div>
          )}
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 1rem 4rem" }}>
          <div style={{ textAlign: "center", marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.78rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "#BE185D", fontWeight: 700, marginBottom: "0.35rem" }}>
              Guest Wishes
            </div>
            <h2 style={{ fontSize: "1.4rem", color: "#2C2A28", margin: 0, fontFamily: "Manrope, serif" }}>
              Wishes from friends and family
            </h2>
          </div>

          {wishesLoading ? (
            <div style={{ textAlign: "center", padding: "1.5rem", color: "#6B7280" }}>
              Loading wishes...
            </div>
          ) : publicWishes.length > 0 ? (
            <div style={{ display: "grid", gap: "1rem" }}>
              {publicWishes.map((wish) => (
                <div
                  key={wish.id}
                  style={{
                    background: SURFACE,
                    border: BORDER,
                    borderRadius: 22,
                    boxShadow: SHADOW,
                    padding: "1.2rem 1.25rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                    <div style={{ fontWeight: 700, color: "#2C2A28" }}>
                      {wish.guest_name || "Anonymous"}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#6B7280" }}>
                      {formatDate(wish.created_at)}
                    </div>
                  </div>
                  <div style={{ color: "#4B5563", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                    {wish.message}
                  </div>
                </div>
              ))}
            </div>
          ) : primaryAlbum?.allow_public_wishes === false ? (
            <div style={{ textAlign: "center", padding: "2rem 1.5rem", color: "#6B7280", background: SURFACE, border: BORDER, borderRadius: 24, boxShadow: SHADOW }}>
              Wishes are turned off for this album.
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "2rem 1.5rem", color: "#6B7280", background: SURFACE, border: BORDER, borderRadius: 24, boxShadow: SHADOW }}>
              No wishes yet. Be the first guest to leave one.
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", padding: "2rem", borderTop: "1px solid #E5E5E5", color: "#9CA3AF", fontSize: "0.85rem" }}>
          Copyright {new Date().getFullYear()} Digital Wedding
        </div>
      </div>

      {lightboxIndex >= 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.95)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setLightboxIndex(-1)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((lightboxIndex - 1 + currentMedia.length) % currentMedia.length);
            }}
            style={{
              position: "absolute",
              left: "1rem",
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              padding: "1rem",
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: "0.95rem",
              fontWeight: 700,
            }}
          >
            Prev
          </button>

          {isVideoMedia(currentMedia[lightboxIndex]) ? (
            <div style={{ fontSize: "2rem", color: "white" }}>Video preview</div>
          ) : (
            <img
              src={currentMedia[lightboxIndex]?.url}
              alt=""
              style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain" }}
              onClick={(e) => e.stopPropagation()}
            />
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((lightboxIndex + 1) % currentMedia.length);
            }}
            style={{
              position: "absolute",
              right: "1rem",
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              padding: "1rem",
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: "0.95rem",
              fontWeight: 700,
            }}
          >
            Next
          </button>

          <button
            onClick={() => setLightboxIndex(-1)}
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              padding: "0.75rem 1rem",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Close
          </button>

          <div
            style={{
              position: "absolute",
              bottom: "2rem",
              left: "50%",
              transform: "translateX(-50%)",
              color: "white",
              fontSize: "0.9rem",
            }}
          >
            {lightboxIndex + 1} / {currentMedia.length}
          </div>
        </div>
      )}

      <WeddingTributeWidget
        slug={wishesSlug}
        allowWishes={primaryAlbum?.allow_public_wishes !== false}
        onSubmitted={() => loadPublicWishes(wishesSlug)}
      />
    </>
  );
}
