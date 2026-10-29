import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SignatureCapture } from "@/lib/contract-signatures";
import { cn } from "@/lib/utils";

const SCRIPT_FONT = `italic 32px "Brush Script MT", "Segoe Script", cursive`;

/**
 * Pointer-event signature pad (mouse, touch and pen). The drawing stays in this
 * canvas only — it is never uploaded or stored by this component.
 *
 * With `scriptName`, the pad shows Clear and "Adopt Script Signature" instead of
 * the Draw/Type switch, and the script uses exactly that name (it can't be
 * edited, so nobody can adopt another person's name).
 */
export function SignaturePad({
  typedName,
  onChange,
  scriptName,
  onCapture,
  tone = "light",
  label = "Signature area. Draw your signature with a mouse, finger or stylus.",
}: {
  typedName?: string;
  onChange?: (hasSignature: boolean) => void;
  scriptName?: string;
  onCapture?: (capture: SignatureCapture | null) => void;
  tone?: "light" | "dark";
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef<Array<Array<[number, number]>>>([]);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState(typedName ?? "");
  const [state, setState] = useState<"empty" | "drawn" | "script">("empty");
  const compact = scriptName !== undefined;

  const context = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return null;
    return { canvas, ctx };
  }, []);

  // Match the backing store to the displayed size for crisp lines on high-DPI screens.
  useEffect(() => {
    const c = context();
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.canvas.getBoundingClientRect();
    c.canvas.width = Math.round(rect.width * ratio);
    c.canvas.height = Math.round(rect.height * ratio);
    c.ctx.scale(ratio, ratio);
    c.ctx.lineWidth = 2.5;
    c.ctx.lineCap = "round";
    c.ctx.lineJoin = "round";
    c.ctx.strokeStyle = "#10385d";
  }, [context]);

  const report = useCallback(
    (next: "empty" | "drawn" | "script", capture: SignatureCapture | null) => {
      setState(next);
      onChange?.(next !== "empty");
      onCapture?.(capture);
    },
    [onChange, onCapture],
  );

  const wipe = useCallback(() => {
    const c = context();
    if (!c) return;
    c.ctx.save();
    c.ctx.setTransform(1, 0, 0, 1, 0, 0);
    c.ctx.clearRect(0, 0, c.canvas.width, c.canvas.height);
    c.ctx.restore();
    strokes.current = [];
  }, [context]);

  const clear = useCallback(() => {
    wipe();
    report("empty", null);
  }, [wipe, report]);

  function point(event: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.round((event.clientX - rect.left) * 10) / 10,
      Math.round((event.clientY - rect.top) * 10) / 10,
    ];
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const c = context();
    if (!c || mode !== "draw") return;
    // Drawing replaces a script signature rather than mixing with it.
    if (state === "script") wipe();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety (keeps strokes going past the edge); drawing works without it.
    }
    drawing.current = true;
    const p = point(event);
    strokes.current.push([p]);
    c.ctx.beginPath();
    c.ctx.moveTo(p[0], p[1]);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const c = context();
    if (!c || !drawing.current) return;
    const p = point(event);
    strokes.current[strokes.current.length - 1]?.push(p);
    c.ctx.lineTo(p[0], p[1]);
    c.ctx.stroke();
  }

  function onPointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    const c = context();
    const points = strokes.current.reduce((n, s) => n + s.length, 0);
    if (!c || points < 2) return;
    const rect = c.canvas.getBoundingClientRect();
    report("drawn", {
      kind: "drawn",
      width: rect.width,
      height: rect.height,
      strokes: strokes.current.map((s) => [...s]),
    });
  }

  function adoptScript(name: string) {
    const c = context();
    const value = name.trim();
    if (!c || !value) return;
    wipe();
    const rect = c.canvas.getBoundingClientRect();
    c.ctx.fillStyle = "#10385d";
    c.ctx.font = SCRIPT_FONT;
    c.ctx.textBaseline = "middle";
    c.ctx.fillText(value, 20, rect.height / 2, rect.width - 40);
    report("script", { kind: "script", name: value });
  }

  const linkClass =
    tone === "dark"
      ? "text-xs font-semibold text-sky-300 hover:text-sky-200 hover:bg-white/10"
      : undefined;

  return (
    <div className="space-y-3">
      {compact ? (
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clear}
            className={cn(linkClass, tone === "dark" && "text-slate-300")}
          >
            <Eraser className="size-3.5" aria-hidden="true" /> Clear
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => adoptScript(scriptName)}
            disabled={!scriptName.trim()}
            className={linkClass}
          >
            <PenLine className="size-3.5" aria-hidden="true" /> Adopt Script Signature
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="radiogroup" aria-label="Signature method" className="flex gap-1.5">
            {(["draw", "type"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                role="radio"
                aria-checked={mode === m}
                variant={mode === m ? "default" : "outline"}
                onClick={() => setMode(m)}
              >
                {m === "draw" ? (
                  "Draw"
                ) : (
                  <>
                    <Type className="size-4" /> Type
                  </>
                )}
              </Button>
            ))}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={clear}>
            <Eraser className="size-4" /> Clear
          </Button>
        </div>
      )}

      {!compact && mode === "type" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="lto-typed-signature">Type your full legal name</Label>
            <Input
              id="lto-typed-signature"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="name"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => adoptScript(typed)}
            disabled={!typed.trim()}
          >
            Adopt typed signature
          </Button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        role="img"
        aria-label={mode === "draw" ? label : "Typed signature preview"}
        className="h-28 w-full cursor-crosshair touch-none rounded-lg border border-border bg-white"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      <p aria-live="polite" className="sr-only" data-testid="signature-pad-state">
        {state === "empty"
          ? "Signature area is empty."
          : state === "script"
            ? "Script signature adopted."
            : "Signature drawn."}
      </p>
    </div>
  );
}
