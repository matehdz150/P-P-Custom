// app/page.tsx
// Landing page — P&P (Next.js 14+ App Router)
// Drop this file at app/page.tsx and add the fonts in app/layout.tsx (see bottom).

"use client";

import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const tokens = {
  bg: "#FAF5EC",
  bg2: "#F2EADB",
  ink: "#1A1410",
  ink2: "#5C4F45",
  paper: "#FFFDF8",
  accent: "#FF5A1F",
  lilac: "#C9B8FF",
  pink: "#F1A7B8",
  green: "#2F7D5B",
};

const STITCH = { strokeDasharray: "3.5 3", strokeWidth: 1.2, fill: "none" } as const;

// ─────────────────────────────────────────────────────────────────────────────
// LOGO
// ─────────────────────────────────────────────────────────────────────────────
function Logo({ size = 28, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width={size * 1.1} height={size} viewBox="0 0 44 40" fill="none">
        <circle cx="20" cy="20" r="17" stroke={color} strokeWidth="2" strokeDasharray="2.5 2.5" />
        <rect x="36" y="17.5" width="6" height="5" rx="1" fill={color} />
        <path d="M14 12h7.2a4.8 4.8 0 0 1 0 9.6H17v6.4h-3V12z M17 14.8v4h4.2a2 2 0 0 0 0-4H17z" fill={color} />
      </svg>
      <span className="display" style={{ fontSize: size * 1.05, lineHeight: 1, letterSpacing: "-0.04em", color }}>
        P&amp;P
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMBROIDERED OBJECTS
// ─────────────────────────────────────────────────────────────────────────────
function CapObject({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 220 180" width="100%" height="100%">
      <defs>
        <pattern id="capDots" patternUnits="userSpaceOnUse" width="6" height="6">
          <circle cx="3" cy="3" r="0.7" fill="#1A1410" opacity=".25" />
        </pattern>
      </defs>
      <path d="M30 110 Q30 50 110 50 Q190 50 190 110 L190 120 L30 120 Z" fill="#1A1410" />
      <path d="M30 110 Q30 50 110 50 Q190 50 190 110 L190 120 L30 120 Z" fill="url(#capDots)" />
      <path d="M14 120 Q14 138 110 142 Q206 138 206 120 L190 120 L30 120 Z" fill="#1A1410" />
      <path d="M82 60 Q82 52 110 50 Q138 52 138 60 L138 120 L82 120 Z" fill="#2A2018" />
      <g transform="translate(110 86)">
        <circle r="22" fill={accent} />
        <circle r="22" fill="none" stroke="#1A1410" strokeWidth="1.2" strokeDasharray="3 2.5" />
        <path d="M0 -11 L3 -3 L11 -3 L4.5 2 L7 10 L0 5 L-7 10 L-4.5 2 L-11 -3 L-3 -3 Z" fill="#1A1410" />
      </g>
      <path d="M22 126 Q110 134 198 126" stroke="#FAF5EC" {...STITCH} />
      <circle cx="110" cy="50" r="3.5" fill="#1A1410" />
    </svg>
  );
}

function ToteObject({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 220 220" width="100%" height="100%">
      <path d="M40 60 L180 60 L188 200 L32 200 Z" fill="#F2EADB" stroke="#1A1410" strokeWidth="2" />
      <path d="M40 60 L180 60 L188 200 L32 200 Z" fill="none" stroke="#1A1410" strokeWidth="0.4" opacity=".15" strokeDasharray="2 3" />
      <path d="M70 60 Q70 14 110 14 Q150 14 150 60" fill="none" stroke="#1A1410" strokeWidth="6" strokeLinecap="round" />
      <g transform="translate(110 130)">
        <rect x="-58" y="-26" width="116" height="52" rx="6" fill={accent} />
        <rect x="-58" y="-26" width="116" height="52" rx="6" fill="none" stroke="#1A1410" strokeWidth="1.2" strokeDasharray="3 2.5" />
        <text x="0" y="8" textAnchor="middle" fontFamily="Archivo Black, sans-serif" fontSize="30" fill="#1A1410" letterSpacing="-1">
          ¡HOLA!
        </text>
      </g>
      <path d="M36 188 L184 188" stroke="#1A1410" {...STITCH} />
    </svg>
  );
}

function ShirtObject({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 240 220" width="100%" height="100%">
      <path
        d="M40 50 L80 30 Q90 50 120 50 Q150 50 160 30 L200 50 L210 90 L180 100 L180 200 L60 200 L60 100 L30 90 Z"
        fill="#1A1410"
      />
      <path d="M60 100 L60 200 L180 200 L180 100" fill="none" stroke="#FAF5EC" opacity=".08" strokeWidth="1" strokeDasharray="2 3" />
      <path d="M80 30 Q120 70 160 30" fill="none" stroke="#FAF5EC" strokeWidth="2" />
      <line x1="120" y1="50" x2="120" y2="80" stroke="#FAF5EC" strokeWidth="1.5" />
      <circle cx="120" cy="58" r="1.6" fill="#FAF5EC" />
      <circle cx="120" cy="72" r="1.6" fill="#FAF5EC" />
      <g transform="translate(155 95)">
        <circle r="14" fill={accent} />
        <circle r="14" fill="none" stroke="#FAF5EC" strokeWidth="0.8" strokeDasharray="2 2" />
        <path d="M0 -7 L2 -2 L7 -2 L3 1 L4.5 6 L0 3 L-4.5 6 L-3 1 L-7 -2 L-2 -2 Z" fill="#1A1410" />
      </g>
      <path d="M40 50 L60 100" stroke="#FAF5EC" opacity=".5" {...STITCH} />
      <path d="M200 50 L180 100" stroke="#FAF5EC" opacity=".5" {...STITCH} />
    </svg>
  );
}

function PatchObject({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%">
      <g>
        {Array.from({ length: 36 }).map((_, i) => {
          const a = (i / 36) * Math.PI * 2;
          const cx = 100 + Math.cos(a) * 88;
          const cy = 100 + Math.sin(a) * 88;
          return <circle key={i} cx={cx} cy={cy} r="6" fill="#FAF5EC" stroke="#1A1410" strokeWidth="1" />;
        })}
      </g>
      <circle cx="100" cy="100" r="82" fill={accent} />
      <circle cx="100" cy="100" r="82" fill="none" stroke="#1A1410" strokeWidth="1.2" strokeDasharray="3 2.5" />
      <circle cx="100" cy="100" r="68" fill="none" stroke="#1A1410" strokeWidth="1" strokeDasharray="2 2" />
      <defs>
        <path id="arcTop" d="M 38 100 A 62 62 0 0 1 162 100" fill="none" />
        <path id="arcBot" d="M 162 100 A 62 62 0 0 1 38 100" fill="none" />
      </defs>
      <text fontFamily="Archivo Black, sans-serif" fontSize="14" fill="#1A1410" letterSpacing="2">
        <textPath href="#arcTop" startOffset="50%" textAnchor="middle">HECHO A MANO</textPath>
      </text>
      <text fontFamily="Archivo Black, sans-serif" fontSize="14" fill="#1A1410" letterSpacing="2">
        <textPath href="#arcBot" startOffset="50%" textAnchor="middle">· EST. P&amp;P ·</textPath>
      </text>
      <path
        d="M100 70 Q88 88 92 102 Q86 98 88 110 Q90 124 100 128 Q110 124 112 110 Q114 98 108 102 Q112 88 100 70 Z"
        fill="#1A1410"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
      <span style={{ width: 32, height: 1.5, background: tokens.ink }} />
      <span className="mono" style={{ fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase" }}>
        {children}
      </span>
      <span style={{ flex: 1, height: 1.5, borderTop: `1.5px dashed ${tokens.ink}` }} />
    </div>
  );
}

function CheckPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 500 }}>
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2.4 2" />
        <path d="M5.5 10.5 L8.5 13.5 L14.5 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV
// ─────────────────────────────────────────────────────────────────────────────
function Nav() {
  const links = [
    { name: "Catálogo", href: "/catalogo" },
    { name: "Cómo funciona", href: "#how" },
    { name: "Editor", href: "#editor" },
    { name: "Para empresas", href: "#" },
    { name: "Soporte", href: "#" },
  ];
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 36px",
        background: "rgba(250,245,236,.85)",
        backdropFilter: "blur(12px)",
        borderBottom: `1.5px dashed ${tokens.ink}`,
      }}
    >
      <Logo size={28} />
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {links.map((l) => (
          <a
            key={l.name}
            href={l.href}
            style={{ padding: "8px 14px", fontSize: 15, fontWeight: 500, borderRadius: 8, color: tokens.ink, textDecoration: "none" }}
          >
            {l.name}
          </a>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn btn-ghost" style={{ padding: "10px 18px", fontSize: 14 }}>
          Entrar
        </button>
        <button className="btn" style={{ padding: "10px 18px", fontSize: 14, boxShadow: `3px 3px 0 ${tokens.ink}` }}>
          Empezar
        </button>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ position: "relative", padding: "80px 36px 60px", overflow: "hidden" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <span className="tag">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <circle cx="5" cy="5" r="4" fill={tokens.accent} />
            </svg>
            Bordados a medida, hechos por talleres reales
          </span>
        </div>

        <h1 className="display" style={{ fontSize: "clamp(56px, 11vw, 168px)", textAlign: "center", margin: "0 auto", maxWidth: "14ch" }}>
          Borda lo que <span style={{ color: tokens.accent }}>quieras</span>
        </h1>

        <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 32, flexWrap: "wrap" }}>
          <CheckPill>Editor visual en vivo</CheckPill>
          <CheckPill>Sin mínimos de unidades</CheckPill>
          <CheckPill>Proveedores cerca de ti</CheckPill>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 36 }}>
          <button className="btn" style={{ fontSize: 19, padding: "20px 36px" }}>
            Diseña tu primer bordado
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10 L16 10 M11 5 L16 10 L11 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="mono" style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: tokens.ink2, letterSpacing: ".06em" }}>
          GRATIS · COTIZACIÓN EN 24H · ENVÍO A TODO MÉXICO
        </p>

        {/* Floating objects */}
        <div style={{ position: "relative", marginTop: 60, height: 420 }}>
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 380, height: 380 }}>
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                border: `3px solid ${tokens.ink}`,
                background: tokens.bg2,
                boxShadow: `inset 0 0 0 8px ${tokens.bg}, inset 0 0 0 9px ${tokens.ink}`,
                display: "grid",
                placeItems: "center",
              }}
            >
              <PatchObject accent={tokens.accent} />
            </div>
            <div style={{ position: "absolute", right: -22, top: "50%", transform: "translateY(-50%)", width: 38, height: 30, background: tokens.ink, borderRadius: 6 }}>
              <div style={{ position: "absolute", left: 8, right: 8, top: 13, height: 4, background: tokens.bg }} />
            </div>
          </div>
          <div style={{ position: "absolute", left: "4%", top: "5%", width: 240, transform: "rotate(-10deg)" }}>
            <CapObject accent={tokens.accent} />
          </div>
          <div style={{ position: "absolute", left: "12%", bottom: "-5%", width: 230, transform: "rotate(8deg)" }}>
            <ToteObject accent={tokens.accent} />
          </div>
          <div style={{ position: "absolute", right: "5%", top: "-2%", width: 240, transform: "rotate(6deg)" }}>
            <ShirtObject accent={tokens.accent} />
          </div>

          <div style={{ position: "absolute", right: "12%", bottom: "4%", transform: "rotate(-6deg)" }}>
            <div className="stitched" style={{ background: tokens.paper, padding: "14px 18px", boxShadow: `4px 4px 0 ${tokens.ink}` }}>
              <div className="mono" style={{ fontSize: 10, color: tokens.ink2, marginBottom: 4 }}>HILO DMC · 12 COLORES</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["#FF5A1F", "#1A1410", "#2F7D5B", "#C9B8FF", "#F1A7B8", "#FAF5EC"].map((c) => (
                  <span key={c} style={{ width: 16, height: 16, borderRadius: "50%", background: c, border: `1px solid ${tokens.ink}` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOW IT WORKS
// ─────────────────────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Sube o diseña",
      body: "Arrastra tu logo, dibujo o foto al editor. O empieza desde una plantilla y ajústala al objeto.",
      vis: (
        <div style={{ position: "relative", height: "100%" }}>
          <div style={{ position: "absolute", inset: 14, borderRadius: 12, background: tokens.bg2, border: `2px dashed ${tokens.ink}`, display: "grid", placeItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <path d="M22 10 L22 30 M14 18 L22 10 L30 18" stroke={tokens.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="8" y="32" width="28" height="4" rx="2" fill={tokens.ink} />
              </svg>
              <div className="mono" style={{ fontSize: 11, marginTop: 8, color: tokens.ink2 }}>.PNG .SVG .JPG .AI</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      n: "02",
      title: "Vista previa del bordado",
      body: "Mira tu diseño con textura de hilo real, conteo de puntadas y colores DMC. Ajusta antes de enviar.",
      vis: (
        <div style={{ position: "relative", height: "100%", padding: 14 }}>
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: tokens.paper, border: `2px solid ${tokens.ink}`, position: "relative", overflow: "hidden", boxShadow: `inset 0 0 0 6px ${tokens.bg2}` }}>
            <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              <g transform="translate(50 50)">
                <path d="M0 -22 L4.5 -8 L19 -7 L7.5 1.5 L11 15 L0 7 L-11 15 L-7.5 1.5 L-19 -7 L-4.5 -8 Z" fill={tokens.accent} />
                <path d="M0 -22 L4.5 -8 L19 -7 L7.5 1.5 L11 15 L0 7 L-11 15 L-7.5 1.5 L-19 -7 L-4.5 -8 Z" fill="none" stroke={tokens.ink} strokeWidth="0.5" strokeDasharray="1.5 1" />
              </g>
            </svg>
            <div className="mono" style={{ position: "absolute", left: 8, bottom: 8, fontSize: 9, color: tokens.ink2, lineHeight: 1.4 }}>
              4,820 puntadas
              <br />
              3 hilos · 22 min
            </div>
          </div>
        </div>
      ),
    },
    {
      n: "03",
      title: "Recibe en tu casa",
      body: "Asignamos un taller cerca de ti. Cotiza, paga y recibe tu bordado real en 3–7 días.",
      vis: (
        <div style={{ position: "relative", height: "100%" }}>
          <div style={{ position: "absolute", left: "50%", top: "55%", transform: "translate(-50%,-50%)", width: "75%", height: "60%", background: "#D9C7A7", border: `2px solid ${tokens.ink}`, borderRadius: 6, boxShadow: `4px 4px 0 ${tokens.ink}` }}>
            <div style={{ position: "absolute", left: "50%", top: -6, bottom: -6, width: 32, transform: "translateX(-50%)", background: tokens.paper, borderLeft: `1.5px dashed ${tokens.ink}`, borderRight: `1.5px dashed ${tokens.ink}` }} />
            <div style={{ position: "absolute", left: 12, top: 10, padding: "4px 8px", background: tokens.paper, border: `1.2px dashed ${tokens.ink}`, borderRadius: 4 }}>
              <div className="mono" style={{ fontSize: 8, letterSpacing: ".1em" }}>P&amp;P · CDMX</div>
            </div>
          </div>
          <div style={{ position: "absolute", right: 18, top: 14, transform: "rotate(12deg)", padding: "6px 10px", background: tokens.accent, border: `1.5px solid ${tokens.ink}`, borderRadius: 4 }}>
            <div className="mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".1em" }}>3–7 DÍAS</div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="how" style={{ padding: "100px 36px", background: tokens.bg }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <SectionEyebrow>Cómo funciona</SectionEyebrow>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40, flexWrap: "wrap", marginBottom: 60 }}>
          <h2 className="display" style={{ fontSize: "clamp(40px, 6vw, 88px)", maxWidth: "14ch" }}>
            De idea a bordado en <span style={{ color: tokens.accent }}>tres pasos</span>
          </h2>
          <p style={{ maxWidth: 420, fontSize: 17, color: tokens.ink2, lineHeight: 1.5 }}>
            Nuestra plataforma hace lo difícil: digitaliza tu diseño, lo asigna al taller correcto y te avisa en cada paso.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {steps.map((s) => (
            <div key={s.n} className="stitched" style={{ background: tokens.paper, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="mono" style={{ fontSize: 14, fontWeight: 600, letterSpacing: ".1em" }}>PASO {s.n}</span>
                <span style={{ width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${tokens.ink}`, display: "grid", placeItems: "center" }}>
                  <span className="display" style={{ fontSize: 14 }}>{s.n.replace("0", "")}</span>
                </span>
              </div>
              <div style={{ height: 220, position: "relative" }}>{s.vis}</div>
              <h3 className="display" style={{ fontSize: 28, lineHeight: 1.05, marginTop: 6 }}>{s.title}</h3>
              <p style={{ fontSize: 15, color: tokens.ink2, lineHeight: 1.5 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR DEMO
// ─────────────────────────────────────────────────────────────────────────────
function EditorDemo() {
  const tools = [
    { icon: "T", label: "Texto" },
    { icon: "↗", label: "Subir" },
    { icon: "★", label: "Formas" },
    { icon: "✿", label: "Plantillas" },
    { icon: "◐", label: "Colores" },
    { icon: "⤢", label: "Tamaño" },
  ];
  const threads = ["#FF5A1F", "#1A1410", "#FAF5EC", "#2F7D5B", "#C9B8FF", "#F1A7B8", "#FFD23F", "#BDD9FF"];

  return (
    <section id="editor" style={{ padding: "100px 36px", background: tokens.ink, color: tokens.bg, position: "relative", overflow: "hidden" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <span style={{ width: 32, height: 1.5, background: tokens.bg }} />
          <span className="mono" style={{ fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase", color: tokens.bg }}>El editor</span>
          <span style={{ flex: 1, height: 1.5, borderTop: `1.5px dashed ${tokens.bg}`, opacity: 0.4 }} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40, flexWrap: "wrap", marginBottom: 48 }}>
          <h2 className="display" style={{ fontSize: "clamp(40px, 6vw, 88px)", maxWidth: "14ch", color: tokens.bg }}>
            Diseñar bordados <span style={{ color: tokens.accent }}>nunca fue así</span>
          </h2>
          <p style={{ maxWidth: 420, fontSize: 17, color: "rgba(250,245,236,.7)", lineHeight: 1.5 }}>
            Vista previa con textura de hilo real. Cambia colores, escala, mueve y obtén el conteo de puntadas al instante.
          </p>
        </div>

        <div style={{ background: "#2A2018", borderRadius: 18, border: "1.5px solid #3D2E22", boxShadow: "0 30px 60px rgba(0,0,0,.4)", overflow: "hidden" }}>
          {/* top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #3D2E22", background: "#1F1812" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#FF5A1F" }} />
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#FFD23F" }} />
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#2F7D5B" }} />
              <span className="mono" style={{ fontSize: 11, opacity: 0.6, marginLeft: 14 }}>proyecto · gorra-snapback-negra.pp</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ padding: "6px 12px", fontSize: 12, background: "transparent", color: tokens.bg, border: "1px solid #3D2E22", borderRadius: 6 }}>Guardar</button>
              <button style={{ padding: "6px 14px", fontSize: 12, background: tokens.accent, color: tokens.ink, border: "none", borderRadius: 6, fontWeight: 600 }}>Cotizar →</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 240px", minHeight: 480 }}>
            {/* tool rail */}
            <div style={{ borderRight: "1px solid #3D2E22", padding: "14px 0", display: "flex", flexDirection: "column", gap: 6, background: "#1F1812" }}>
              {tools.map((t, i) => (
                <button
                  key={i}
                  style={{
                    margin: "0 10px",
                    padding: "12px 0",
                    background: i === 2 ? tokens.accent : "transparent",
                    color: i === 2 ? tokens.ink : tokens.bg,
                    border: "none",
                    borderRadius: 8,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 18, fontWeight: 600 }}>{t.icon}</span>
                  <span className="mono" style={{ fontSize: 9, opacity: i === 2 ? 1 : 0.6 }}>{t.label}</span>
                </button>
              ))}
            </div>

            {/* canvas */}
            <div style={{ padding: 32, position: "relative", background: "radial-gradient(circle at 50% 50%, #3D2E22 0%, #2A2018 70%)" }}>
              <div style={{ width: "100%", height: "100%", minHeight: 380, background: tokens.bg, borderRadius: 10, position: "relative", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,.3)" }}>
                <svg viewBox="0 0 400 320" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                  <rect x="60" y="50" width="280" height="220" fill="none" stroke="#1A1410" strokeWidth="1" strokeDasharray="3 3" opacity=".25" />
                  <g transform="translate(200 165)">
                    <path d="M-130 -20 Q-130 -80 0 -80 Q130 -80 130 -20 L130 0 L-130 0 Z" fill="#1A1410" />
                    <path d="M-150 0 Q-150 25 0 30 Q150 25 150 0 L130 0 L-130 0 Z" fill="#0F0A06" />
                    <g transform="translate(0 -42)">
                      <rect x="-46" y="-30" width="92" height="60" fill="none" stroke="#FF5A1F" strokeWidth="1.5" strokeDasharray="4 3" />
                      {[[-46, -30], [46, -30], [-46, 30], [46, 30]].map(([x, y], i) => (
                        <rect key={i} x={x - 4} y={y - 4} width="8" height="8" fill={tokens.bg} stroke="#FF5A1F" strokeWidth="1.5" />
                      ))}
                      <g>
                        <path d="M0 -20 L5 -6 L20 -5 L8 3 L12 18 L0 9 L-12 18 L-8 3 L-20 -5 L-5 -6 Z" fill="#FF5A1F" />
                        <path d="M0 -20 L5 -6 L20 -5 L8 3 L12 18 L0 9 L-12 18 L-8 3 L-20 -5 L-5 -6 Z" fill="none" stroke="#1A1410" strokeWidth="0.6" strokeDasharray="1.4 1" />
                      </g>
                    </g>
                  </g>
                </svg>

                <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 18, borderBottom: "1px solid rgba(26,20,16,.1)", display: "flex" }}>
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} style={{ flex: 1, borderLeft: "1px solid rgba(26,20,16,.15)", height: i % 5 === 0 ? 12 : 6, marginTop: 6 }} />
                  ))}
                </div>

                <div style={{ position: "absolute", left: 16, bottom: 16, background: tokens.ink, color: tokens.bg, padding: "8px 12px", borderRadius: 8, display: "flex", gap: 14 }}>
                  <div>
                    <div className="mono" style={{ fontSize: 9, opacity: 0.6 }}>PUNTADAS</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>4,820</div>
                  </div>
                  <div style={{ width: 1, background: "rgba(250,245,236,.2)" }} />
                  <div>
                    <div className="mono" style={{ fontSize: 9, opacity: 0.6 }}>TIEMPO</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>~22min</div>
                  </div>
                  <div style={{ width: 1, background: "rgba(250,245,236,.2)" }} />
                  <div>
                    <div className="mono" style={{ fontSize: 9, opacity: 0.6 }}>HILOS</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>3</div>
                  </div>
                </div>
              </div>
            </div>

            {/* right panel */}
            <div style={{ borderLeft: "1px solid #3D2E22", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 22, background: "#1F1812" }}>
              <div>
                <div className="mono" style={{ fontSize: 10, opacity: 0.5, letterSpacing: ".1em", marginBottom: 10 }}>SELECCIÓN</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Estrella · forma</div>
                <div className="mono" style={{ fontSize: 10, opacity: 0.5 }}>92 × 60 mm</div>
              </div>

              <div>
                <div className="mono" style={{ fontSize: 10, opacity: 0.5, letterSpacing: ".1em", marginBottom: 10 }}>HILO DMC</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                  {threads.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        aspectRatio: "1",
                        borderRadius: 8,
                        background: c,
                        border: c === "#FF5A1F" ? `2px solid ${tokens.bg}` : "1px solid #3D2E22",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="mono" style={{ fontSize: 10, opacity: 0.5, letterSpacing: ".1em", marginBottom: 10 }}>TIPO DE PUNTADA</div>
                {["Satin", "Tatami", "Contorno"].map((s, i) => (
                  <div
                    key={s}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: 6,
                      marginBottom: 4,
                      background: i === 0 ? "rgba(255,90,31,.15)" : "transparent",
                      border: i === 0 ? `1px solid ${tokens.accent}` : "1px solid transparent",
                      fontSize: 13,
                    }}
                  >
                    <span>{s}</span>
                    {i === 0 && <span style={{ color: tokens.accent }}>✓</span>}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "auto", padding: 14, borderRadius: 10, background: "#0F0A06", border: "1px dashed #3D2E22" }}>
                <div className="mono" style={{ fontSize: 10, opacity: 0.5, marginBottom: 6 }}>COTIZACIÓN ESTIMADA</div>
                <div className="display" style={{ fontSize: 32, color: tokens.accent }}>
                  $185 <span style={{ fontSize: 13, color: tokens.bg, opacity: 0.6 }}>/ pieza</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GALLERY
// ─────────────────────────────────────────────────────────────────────────────
type GalleryItem = { name: string; price: string; obj: React.ReactNode };

function Gallery() {
  const [active, setActive] = React.useState<string>("Gorras");
  const tabs = ["Gorras", "Playeras", "Mochilas", "Parches", "Toallas", "Pants"];

  const items: Record<string, GalleryItem[]> = {
    Gorras: [
      { name: "Snapback negra", price: "$185", obj: <CapObject accent={tokens.accent} /> },
      { name: "Trucker beige", price: "$210", obj: <CapObject accent={tokens.lilac} /> },
      { name: "Dad cap mostaza", price: "$170", obj: <CapObject accent={tokens.pink} /> },
      { name: "5-panel pro", price: "$240", obj: <CapObject accent={tokens.green} /> },
    ],
    Playeras: [
      { name: "Polo piqué", price: "$320", obj: <ShirtObject accent={tokens.accent} /> },
      { name: "T-shirt heavy", price: "$220", obj: <ShirtObject accent={tokens.lilac} /> },
      { name: "Camisa oxford", price: "$420", obj: <ShirtObject accent={tokens.green} /> },
      { name: "Sudadera", price: "$390", obj: <ShirtObject accent={tokens.pink} /> },
    ],
    Mochilas: [
      { name: "Tote canvas", price: "$160", obj: <ToteObject accent={tokens.accent} /> },
      { name: "Tote orgánica", price: "$190", obj: <ToteObject accent={tokens.green} /> },
      { name: "Tote XL", price: "$220", obj: <ToteObject accent={tokens.lilac} /> },
      { name: "Tote dual", price: "$240", obj: <ToteObject accent={tokens.pink} /> },
    ],
    Parches: [
      { name: "Redondo 7cm", price: "$45", obj: <PatchObject accent={tokens.accent} /> },
      { name: "Redondo 10cm", price: "$65", obj: <PatchObject accent={tokens.lilac} /> },
      { name: "Iron-on velcro", price: "$80", obj: <PatchObject accent={tokens.pink} /> },
      { name: "Forma libre", price: "$95", obj: <PatchObject accent={tokens.green} /> },
    ],
    Toallas: [
      { name: "Toalla mano", price: "$140", obj: <PatchObject accent={tokens.lilac} /> },
      { name: "Toalla baño", price: "$310", obj: <PatchObject accent={tokens.accent} /> },
      { name: "Bata rizo", price: "$520", obj: <PatchObject accent={tokens.green} /> },
      { name: "Toalla deporte", price: "$180", obj: <PatchObject accent={tokens.pink} /> },
    ],
    Pants: [
      { name: "Sweatpants", price: "$340", obj: <ShirtObject accent={tokens.lilac} /> },
      { name: "Shorts canvas", price: "$280", obj: <ShirtObject accent={tokens.accent} /> },
      { name: "Joggers", price: "$320", obj: <ShirtObject accent={tokens.pink} /> },
      { name: "Cargo", price: "$410", obj: <ShirtObject accent={tokens.green} /> },
    ],
  };

  return (
    <section style={{ padding: "100px 36px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <SectionEyebrow>Catálogo</SectionEyebrow>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40, flexWrap: "wrap", marginBottom: 32 }}>
          <h2 className="display" style={{ fontSize: "clamp(40px, 6vw, 88px)", maxWidth: "16ch" }}>
            Bordamos sobre <span style={{ color: tokens.accent }}>casi todo</span>
          </h2>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                background: active === t ? tokens.ink : tokens.paper,
                color: active === t ? tokens.bg : tokens.ink,
                border: `1.5px solid ${tokens.ink}`,
                cursor: "pointer",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          {items[active].map((it, i) => (
            <div key={i} className="stitched" style={{ background: tokens.paper, padding: 18, display: "flex", flexDirection: "column", transition: "transform .15s" }}>
              <div style={{ aspectRatio: "1", background: tokens.bg2, borderRadius: 10, display: "grid", placeItems: "center", padding: 18 }}>
                {it.obj}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{it.name}</div>
                  <div className="mono" style={{ fontSize: 10, color: tokens.ink2, marginTop: 2 }}>DESDE</div>
                </div>
                <div className="display" style={{ fontSize: 22 }}>{it.price}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA + FOOTER
// ─────────────────────────────────────────────────────────────────────────────
function CTAFooter() {
  return (
    <>
      <section style={{ padding: "40px 36px 0" }}>
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            background: tokens.accent,
            border: `2px solid ${tokens.ink}`,
            borderRadius: 24,
            padding: "80px 60px",
            position: "relative",
            overflow: "hidden",
            boxShadow: `8px 8px 0 ${tokens.ink}`,
          }}
        >
          <div style={{ position: "absolute", inset: 12, borderRadius: 16, border: `1.5px dashed ${tokens.ink}`, pointerEvents: "none" }} />

          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 560 }}>
              <h2 className="display" style={{ fontSize: "clamp(40px, 5vw, 80px)" }}>
                ¿Listo para <span style={{ fontStyle: "italic" }}>bordar</span>?
              </h2>
              <p style={{ fontSize: 18, marginTop: 18, lineHeight: 1.5, maxWidth: 440 }}>
                Empieza gratis. Sin tarjeta. Cotizamos en menos de 24 horas con un taller cerca de ti.
              </p>
            </div>
            <button className="btn btn-paper" style={{ fontSize: 19, padding: "22px 36px", background: tokens.paper }}>
              Diseña tu bordado
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10 L16 10 M11 5 L16 10 L11 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div style={{ position: "absolute", right: -30, bottom: -30, width: 160, height: 160, transform: "rotate(15deg)", opacity: 0.6 }}>
            <PatchObject accent={tokens.bg} />
          </div>
        </div>
      </section>

      <footer style={{ padding: "80px 36px 40px", marginTop: 60 }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ borderTop: `1.5px dashed ${tokens.ink}`, paddingTop: 40, display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 40 }}>
            <div>
              <Logo size={32} />
              <p style={{ marginTop: 16, fontSize: 14, color: tokens.ink2, lineHeight: 1.5, maxWidth: 300 }}>
                Plataforma de bordado a medida que conecta a clientes con talleres reales. Hecho en CDMX.
              </p>
            </div>
            {[
              { h: "Producto", l: ["Editor", "Catálogo", "Plantillas", "Para empresas"] },
              { h: "Compañía", l: ["Sobre P&P", "Talleres aliados", "Empleo", "Prensa"] },
              { h: "Ayuda", l: ["FAQ", "Envíos", "Devoluciones", "Contacto"] },
            ].map((c) => (
              <div key={c.h}>
                <div className="mono" style={{ fontSize: 11, letterSpacing: ".1em", marginBottom: 14, fontWeight: 600 }}>{c.h.toUpperCase()}</div>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, padding: 0, margin: 0 }}>
                  {c.l.map((x) => (
                    <li key={x}>
                      <a href="#" style={{ fontSize: 14, color: tokens.ink2, textDecoration: "none" }}>
                        {x}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(26,20,16,.1)" }}>
            <div className="mono" style={{ fontSize: 11, color: tokens.ink2 }}>© 2026 P&amp;P — TODOS LOS DERECHOS RESERVADOS</div>
            <div className="mono" style={{ fontSize: 11, color: tokens.ink2, display: "flex", gap: 18 }}>
              <a href="#" style={{ color: tokens.ink2, textDecoration: "none" }}>PRIVACIDAD</a>
              <a href="#" style={{ color: tokens.ink2, textDecoration: "none" }}>TÉRMINOS</a>
              <a href="#" style={{ color: tokens.ink2, textDecoration: "none" }}>COOKIES</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <>
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=JetBrains+Mono:wght@400;500&display=swap");

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          background: ${tokens.bg};
          color: ${tokens.ink};
          font-family: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        body { overflow-x: hidden; }
        a { color: inherit; text-decoration: none; }
        button { font-family: inherit; cursor: pointer; }

        .display {
          font-family: "Archivo Black", "Bricolage Grotesque", sans-serif;
          letter-spacing: -0.02em;
          line-height: 0.92;
          text-transform: uppercase;
        }
        .mono { font-family: "JetBrains Mono", ui-monospace, monospace; }

        .stitched {
          border: 1.5px dashed ${tokens.ink};
          border-radius: 18px;
        }

        .tag {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 10px; border-radius: 999px;
          background: ${tokens.paper}; border: 1px solid ${tokens.ink};
          font-family: "JetBrains Mono", monospace; font-size: 11px;
          text-transform: uppercase; letter-spacing: .04em;
        }

        .btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          padding: 18px 28px; border-radius: 14px; border: 2px solid ${tokens.ink};
          font-family: "Bricolage Grotesque", sans-serif; font-weight: 700; font-size: 17px;
          background: ${tokens.accent}; color: ${tokens.ink};
          box-shadow: 4px 4px 0 ${tokens.ink};
          transition: transform .08s ease, box-shadow .08s ease;
        }
        .btn:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 ${tokens.ink}; }
        .btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 ${tokens.ink}; }
        .btn-ghost { background: transparent; color: ${tokens.ink}; box-shadow: none; }
        .btn-ghost:hover { background: ${tokens.ink}; color: ${tokens.bg}; transform: none; box-shadow: none; }
        .btn-paper { background: ${tokens.paper}; }
      `}</style>

      <Nav />
      <Hero />
      <HowItWorks />
      <EditorDemo />
      <Gallery />
      <CTAFooter />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
INSTALACIÓN (Next.js 14+ App Router)

1. Guarda este archivo en:    app/page.tsx
2. Asegúrate de tener:        app/layout.tsx
   con un <html lang="es"><body>{children}</body></html>
3. Las fuentes se cargan vía Google Fonts dentro de <style jsx global>.
   Si prefieres next/font, importa Archivo_Black, Bricolage_Grotesque y
   JetBrains_Mono desde "next/font/google" en layout.tsx.

DEPENDENCIAS: ninguna fuera de React + Next.js. Todo SVG es inline.
──────────────────────────────────────────────────────────────────────────── */
