import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Pointer-event signature pad (mouse, touch and pen). The drawing stays in this
 * canvas only — it is never uploaded or stored by this component.
 */
export function SignaturePad({
  typedName,
  onChange,
}: {
  typedName: string;
  onChange: (hasSignature: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState(typedName);

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

  const clear = useCallback(() => {
    const c = context();
    if (!c) return;
    c.ctx.save();
    c.ctx.setTransform(1, 0, 0, 1, 0, 0);
    c.ctx.clearRect(0, 0, c.canvas.width, c.canvas.height);
    c.ctx.restore();
    onChange(false);
  }, [context, onChange]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const c = context();
    if (!c || mode !== "draw") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const p = point(event);
    c.ctx.beginPath();
    c.ctx.moveTo(p.x, p.y);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const c = context();
    if (!c || !drawing.current) return;
    const p = point(event);
    c.ctx.lineTo(p.x, p.y);
    c.ctx.stroke();
    onChange(true);
  }

  function onPointerUp() {
    drawing.current = false;
  }

  function adoptTyped() {
    const c = context();
    const name = typed.trim();
    if (!c || !name) return;
    clear();
    const rect = c.canvas.getBoundingClientRect();
    c.ctx.fillStyle = "#10385d";
    c.ctx.font = `italic 32px "Brush Script MT", "Segoe Script", cursive`;
    c.ctx.textBaseline = "middle";
    c.ctx.fillText(name, 20, rect.height / 2, rect.width - 40);
    onChange(true);
  }

  return (
    <div className="space-y-3">
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

      {mode === "type" && (
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
          <Button type="button" variant="outline" onClick={adoptTyped} disabled={!typed.trim()}>
            Adopt typed signature
          </Button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        role="img"
        aria-label={
          mode === "draw"
            ? "Signature area. Draw your signature with a mouse, finger or stylus."
            : "Typed signature preview"
        }
        className="h-28 w-full cursor-crosshair touch-none rounded-lg border border-border bg-white"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
      />
    </div>
  );
}
