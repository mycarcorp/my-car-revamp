import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/app-client";
import { APP_SUPABASE_URL } from "@/integrations/supabase/runtime-config";

const BUCKET = "logo";
const OBJECT = "mycar-logo.png";
const PUBLIC_URL = `${APP_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${OBJECT}`;

function preload(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * MyCar wordmark. Loads mycar-logo.png from Storage: public URL first, then a
 * signed URL if the bucket is private. Falls back to the text wordmark while
 * loading or if the file can't be read.
 */
export function BrandLogo({ className = "h-9 w-auto" }: { className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (await preload(PUBLIC_URL)) {
        if (active) setSrc(PUBLIC_URL);
        return;
      }
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(OBJECT, 60 * 60);
      const signed = data?.signedUrl;
      if (signed && (await preload(signed)) && active) setSrc(signed);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!src) {
    return (
      <span className="rounded bg-primary px-2 py-1 font-display text-lg font-extrabold tracking-tight text-primary-foreground">
        My<span className="text-accent">Car</span>
      </span>
    );
  }

  return <img src={src} alt="MyCar" className={className} />;
}
