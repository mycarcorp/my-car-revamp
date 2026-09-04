import { useEffect, useState } from "react";

const LOGO_URL =
  "https://rpmmlzyeqpvczuuobddt.supabase.co/storage/v1/object/public/logo/mycar-logo.png";

function preload(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * MyCar wordmark. Loads the dealership logo from the dedicated Storage bucket.
 * Falls back to the text wordmark while loading or if the file can't be read.
 */
export function BrandLogo({ className = "h-9 w-auto" }: { className?: string }) {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (await preload(LOGO_URL)) {
        if (active) setOk(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!ok) {
    return (
      <span className="rounded bg-primary px-2 py-1 font-display text-lg font-extrabold tracking-tight text-primary-foreground">
        My<span className="text-accent">Car</span>
      </span>
    );
  }

  return <img src={LOGO_URL} alt="MyCar" className={className} />;
}
