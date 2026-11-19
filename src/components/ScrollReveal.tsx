"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** การ์ดค่อยๆ ลอยขึ้นเมื่อเลื่อนเข้ามาในจอ (ไม่ทำงานถ้าผู้ใช้ตั้งลดภาพเคลื่อนไหว หรือเบราว์เซอร์ไม่รองรับ) */
export default function ScrollReveal() {
  const path = usePathname();
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main || !("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("reveal-in"); io.unobserve(e.target); }
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    const scan = () => {
      const fresh = main.querySelectorAll<HTMLElement>(".card:not(.reveal), [data-reveal]:not(.reveal)");
      let i = 0;
      for (const el of fresh) {
        el.classList.add("reveal");
        // ของที่อยู่ในจออยู่แล้วแสดงทันที ไม่ต้องรอภาพเคลื่อนไหว
        if (el.getBoundingClientRect().top < innerHeight) { el.classList.add("reveal-in", "reveal-now"); continue; }
        el.style.transitionDelay = `${Math.min(i++, 4) * 40}ms`;
        io.observe(el);
      }
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(main, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect() };
  }, [path]);
  return null;
}
