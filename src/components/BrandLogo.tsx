import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/app-client";
import { APP_SUPABASE_URL } from "@/integrations/supabase/runtime-config";

const BUCKET = "logo";
const OBJECT = "mycar-logo.png";
const PUBLIC_URL = `${APP_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${OBJECT}`;

/**
 * MyCar wordmark. Loads the logo from Storage; if the bucket is private the
 * public URL 4xx's and we fall back to a signed URL from the Supabase client.
 * If neither works, the original text wordmark is shown.
 */
export function BrandLogo({ className = "h-9 w-auto" }: { className?: string }) {
  const [src, setSrc] = useState<string>(PUBLIC_URL);
  const [failed, setFailed] = useState(false);
  const [triedSigned, setTriedSigned] = useState(false);

  useEffect(() => {
    if (!triedSigned) return;
    let active = true;
    void supabase.storage
      .from(BUCKET)
      .createSignedUrl(OBJECT, 60 * 60)
      .then(({ data }) => {
        if (!active) return;
        if (data?.signedUrl) setSrc(data.signedUrl);
        else setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [triedSigned]);

  if (failed) {
    return (
      <span className="rounded bg-primary px-2 py-1 font-display text-lg font-extrabold tracking-tight text-primary-foreground">
        My<span className="text-accent">Car</span>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt="MyCar"
      className={className}
      onError={() => {
        if (triedSigned) setFailed(true);
        else setTriedSigned(true);
      }}
    />
  );
}
