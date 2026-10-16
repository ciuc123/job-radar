"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";

export default function SiteHeader({ userName, isAdmin, backHref, backLabel, isLoggedIn: serverLoggedIn }: { userName?: string; isAdmin?: boolean; backHref?: string; backLabel?: React.ReactNode; isLoggedIn?: boolean }) {
  const pathname = usePathname();
  // Clerk is the source of truth for the session, so a page that doesn't pass user props still shows the account.
  // The server-provided flag avoids a signed-out flash before Clerk loads.
  const { isSignedIn, user } = useUser();
  const isLoggedIn = Boolean(serverLoggedIn || isSignedIn);
  const displayName = userName ?? user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Account";
  // The menu remembers the path it was opened on, so navigating closes it without a state-syncing effect.
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const open = openOnPath === pathname;
  const navRef = useRef<HTMLElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const burgerRef = useRef<HTMLButtonElement | null>(null);
  const lastScrollY = useRef(0);
  const [hidden, setHidden] = useState(false);

  const toggle = () => setOpenOnPath((current) => (current === pathname ? null : pathname));
  const close = () => setOpenOnPath(null);

  useEffect(() => {
    function updateHeight() {
      const nav = navRef.current;
      const topBanner = getComputedStyle(document.documentElement).getPropertyValue('--top-banner-height') || '0px';
      const banner = Number((topBanner || '0').replace('px','')) || 0;
      const height = nav ? nav.offsetHeight + banner : banner;
      document.documentElement.style.setProperty('--site-header-height', `${height}px`);
    }
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    if (navRef.current) ro.observe(navRef.current);
    window.addEventListener('resize', updateHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenOnPath(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // close when clicking/tapping outside the nav when mobile menu is open
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!open) return;
      // Clerk portals the account popover outside the nav; using it must not close the menu.
      if (e.target instanceof Element && e.target.closest('[class*="cl-"]')) return;
      const path = (e.composedPath && e.composedPath()) || (e as any).path || [];
      const nav = navRef.current;
      if (nav && !path.includes(nav)) {
        setOpenOnPath(null);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // when menu closes, restore focus to hamburger for accessibility
  useEffect(() => {
    if (!open && burgerRef.current) {
      try { burgerRef.current.focus(); } catch (e) {}
    }
  }, [open]);

  // show/hide header on scroll: hide when scrolling down, show when scrolling up.
  useEffect(() => {
    let raf = 0;
    function onScroll() {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY || window.pageYOffset || 0;
        const delta = y - lastScrollY.current;
        // scrolling down -> hide header
        if (delta > 8 && y > 60) {
          setHidden(true);
          // when scrolling down, also close the mobile menu if open
          if (open) setOpenOnPath(null);
        } else if (delta < -8) {
          // scrolling up -> show header but keep menu closed
          setHidden(false);
          if (open) setOpenOnPath(null);
        }
        lastScrollY.current = y;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [open]);

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/") return pathname === "/" || pathname.startsWith('/jobs') || pathname === '/';
    return pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href + '?');
  };

  return (
    <header className={`topbar ${hidden ? 'hidden' : ''}`} ref={navRef as any}>
      <Link href="/" className="brand"><span className="brand-mark">JR</span><span>job radar<small>PERSONAL EDITION</small></span></Link>
      {backHref ? <Link href={backHref} className="back-link">{backLabel}</Link> : null}
      <nav>
        {!isLoggedIn && <SignInButton mode="modal"><button className="mobile-signin hamburger-only">Sign in</button></SignInButton>}
        <button ref={burgerRef} aria-label="Toggle menu" aria-expanded={open} className="hamburger-only" onClick={toggle}>
          {open ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          )}
        </button>

        <div className={`desktop-nav`}>
          <Link href="/" className={isActive('/') ? 'active' : ''}>Jobs</Link>
          <Link href="/network" className={isActive('/network') ? 'active' : ''}>My network</Link>
          <Link href="/sources" className={isActive('/sources') ? 'active' : ''}>Sources</Link>
          {isLoggedIn && <Link href="/settings" className={isActive('/settings') ? 'active' : ''}><Settings2 size={16}/> Preferences</Link>}
          <Link href="/billing" className={isActive('/billing') ? 'active' : ''}>Plans</Link>
          {isAdmin && <Link href="/admin" className={isActive('/admin') ? 'active' : ''}>Admin</Link>}
          <a href="mailto:andrei@ciuculescu.com?subject=Job%20Radar%20request">Request / support</a>
          {isLoggedIn && <span className="user-chip">{displayName}</span>}
          {isLoggedIn && <UserButton />}
        </div>

        <div className={`mobile-dropdown hamburger-only ${open ? 'open' : ''}`} aria-hidden={!open}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px'}}>
            <div style={{fontWeight:800}}>Menu</div>
            <button aria-label="Close menu" className="mobile-close" onClick={close}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div className="mobile-list">
            <Link href="/" onClick={close} className={isActive('/') ? 'active' : ''}>Jobs</Link>
            <Link href="/network" onClick={close} className={isActive('/network') ? 'active' : ''}>My network</Link>
            <Link href="/sources" onClick={close} className={isActive('/sources') ? 'active' : ''}>Sources</Link>
            {isLoggedIn && <Link href="/settings" onClick={close} className={isActive('/settings') ? 'active' : ''}>Preferences</Link>}
            <Link href="/billing" onClick={close} className={isActive('/billing') ? 'active' : ''}>Plans</Link>
            {isAdmin && <Link href="/admin" onClick={close}>Admin</Link>}
            <a href="mailto:andrei@ciuculescu.com?subject=Job%20Radar%20request" onClick={close}>Request / support</a>
            {isLoggedIn ? <div className="mobile-account">
              <UserButton />
              <span>{displayName}</span>
            </div> : <div className="mobile-auth">
              <SignInButton mode="modal"><button className="button button-primary" onClick={close}>Sign in</button></SignInButton>
              <SignUpButton mode="modal"><button className="button button-secondary" onClick={close}>Create account</button></SignUpButton>
            </div>}
          </div>
        </div>
      </nav>
      <div className={`site-header-backdrop ${open ? 'visible' : ''}`} ref={backdropRef} onClick={close} />
    </header>
  );
}



