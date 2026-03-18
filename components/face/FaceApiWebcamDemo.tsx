"use client";

import { useEffect, useRef, useState } from "react";
import type * as FaceApi from "@vladmandic/face-api";
import { useTranslations } from "next-intl";
import { Webcam } from "@/components/ui/webcam";
import { expressionKeyToEmoji } from "@/lib/detection-i18n";
import { cn } from "@/lib/utils";

type Status = "idle" | "loading_models" | "ready" | "running" | "error";

type ExpressionItem = {
  key: string;
  pct: number;
  emoji: string;
  isTop: boolean;
};

type FaceInfo = {
  gender: string | null;
  age: number | null;
  expressions: ExpressionItem[] | null;
};

const DEFAULT_MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
const MIRROR_VIDEO = true;

type FaceApiTfLike = {
  setBackend: (backend: string) => Promise<void> | void;
  ready: () => Promise<void>;
  enableProdMode: () => Promise<void> | void;
  getBackend: () => string;
  env: () => {
    flagRegistry: Record<string, unknown>;
    set: (k: string, v: unknown) => void;
  };
};

function topK<T extends Record<string, number>>(
  scores: T,
  k: number,
): Array<[keyof T, number]> {
  return (Object.entries(scores) as Array<[keyof T, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k);
}

export function FaceApiWebcamDemo({
  modelUrl = DEFAULT_MODEL_URL,
  className,
}: {
  modelUrl?: string;
  className?: string;
}) {
  const t = useTranslations("Detection");
  const labels = {
    genderLabel: t("genderLabel"),
    ageLabel: t("ageLabel"),
    expressionLabel: t("expressionLabel"),
    ageSuffix: t("ageSuffix"),
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const faceapiRef = useRef<typeof FaceApi | null>(null);
  const tinyFaceOptionsRef = useRef<FaceApi.TinyFaceDetectorOptions | null>(
    null,
  );
  const runningRef = useRef(false);
  const inFlightRef = useRef(false);
  const lastTickRef = useRef(0);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [backend, setBackend] = useState<string | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [descriptorPreview, setDescriptorPreview] = useState<string | null>(
    null,
  );
  const [faces, setFaces] = useState<FaceInfo[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setStatus("loading_models");
        setError(null);

        const faceapi =
          (await import("@vladmandic/face-api")) as typeof FaceApi;
        if (cancelled) return;
        faceapiRef.current = faceapi;

        const tf = (faceapi as unknown as { tf: FaceApiTfLike }).tf;
        await tf.setBackend("webgl");
        await tf.ready();

        if (tf?.env().flagRegistry.CANVAS2D_WILL_READ_FREQUENTLY)
          tf.env().set("CANVAS2D_WILL_READ_FREQUENTLY", true);
        if (tf?.env().flagRegistry.WEBGL_EXP_CONV)
          tf.env().set("WEBGL_EXP_CONV", true);

        await tf.enableProdMode();
        await tf.ready();

        setBackend(tf.getBackend());

        await Promise.all([
          faceapi.nets.tinyFaceDetector.load(modelUrl),
          faceapi.nets.ageGenderNet.load(modelUrl),
          faceapi.nets.faceLandmark68Net.load(modelUrl),
          faceapi.nets.faceRecognitionNet.load(modelUrl),
          faceapi.nets.faceExpressionNet.load(modelUrl),
        ]);

        tinyFaceOptionsRef.current = new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.3,
        });

        if (cancelled) return;
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "FaceAPI init failed");
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const faceapi = faceapiRef.current;
    const options = tinyFaceOptionsRef.current;
    if (!video || !canvas || !faceapi || !options) return;
    if (status !== "ready" && status !== "running") return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const mx = (vw: number, x: number, w = 0) =>
      MIRROR_VIDEO ? vw - x - w : x;

    runningRef.current = true;
    setStatus("running");

    const targetFps = 12;
    const minFrameMs = 1000 / targetFps;

    const tick = async (now: number) => {
      if (!runningRef.current) return;

      rafRef.current = requestAnimationFrame((t) => void tick(t));

      if (now - lastTickRef.current < minFrameMs) return;
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;
      setFps(Math.round(1000 / Math.max(1, dt)));

      if (video.readyState < 2) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
      }

      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        const results = await faceapi
          .detectAllFaces(video, options)
          .withFaceLandmarks()
          .withFaceExpressions()
          .withFaceDescriptors()
          .withAgeAndGender();

        setFaces(
          results.map((r) => {
            const expr = r.expressions
              ? topK(r.expressions as unknown as Record<string, number>, 2)
              : [];
            return {
              gender: r.gender ?? null,
              age: typeof r.age === "number" ? r.age : null,
              expressions:
                expr.length > 0
                  ? expr.map(([k, v], idx) => {
                      const key = String(k);
                      const pct = Math.round(v * 100);
                      return {
                        key,
                        pct,
                        emoji: expressionKeyToEmoji(key),
                        isTop: idx === 0,
                      };
                    })
                  : null,
            };
          }),
        );

        const first = results[0];
        if (first?.descriptor) {
          const d = first.descriptor;
          const preview = Array.from(d.slice(0, 8))
            .map((n) => n.toFixed(3))
            .join(", ");
          setDescriptorPreview(`len=${d.length} [${preview}, ...]`);
        } else {
          setDescriptorPreview(null);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 3;
        ctx.font = "14px ui-sans-serif, system-ui, -apple-system, Segoe UI";
        ctx.textBaseline = "top";

        results.forEach((r, i) => {
          const box = r.detection.box;
          const bx = mx(vw, box.x, box.width);

          ctx.strokeStyle = "deepskyblue";
          ctx.globalAlpha = 0.9;
          ctx.strokeRect(bx, box.y, box.width, box.height);

          ctx.fillStyle = "deepskyblue";
          ctx.globalAlpha = 0.65;
          const labelText = String(i + 1);
          // Measure text to size the blue background tightly
          const metrics = ctx.measureText(labelText);
          const paddingX = 8;
          const labelW = Math.ceil(metrics.width + paddingX * 2);
          const labelH = 24;
          const labelX = MIRROR_VIDEO ? mx(vw, box.x, labelW) : box.x;
          const labelY = Math.max(0, box.y - labelH);
          ctx.fillRect(labelX, labelY, labelW, labelH);

          ctx.globalAlpha = 1;
          ctx.fillStyle = "black";

          // Draw only the face index text
          ctx.fillText(
            labelText,
            labelX + paddingX,
            labelY + Math.max(0, (labelH - 14) / 2),
          );

          if (r.landmarks?.positions?.length) {
            ctx.fillStyle = "lightblue";
            ctx.globalAlpha = 0.6;
            for (const pt of r.landmarks.positions) {
              const px = mx(vw, pt.x);
              ctx.beginPath();
              ctx.arc(px, pt.y, 2, 0, 2 * Math.PI);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "FaceAPI runtime error");
      } finally {
        inFlightRef.current = false;
      }
    };

    rafRef.current = requestAnimationFrame((t) => void tick(t));

    return () => {
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [status]);

  return (
    <section className={cn("w-full grid md:grid-cols-2 gap-2", className)}>
      {/* Webcam */}
      <div className="relative w-full min-w-0 md:row-span-2">
        <Webcam ref={videoRef} containerClassName="w-full" />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 w-full h-full"
        />
      </div>
      {/* Face Info */}
      <div className="w-full min-w-0">
        <div className="space-y-2">
          {faces.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            faces.map((face, i) => (
              <div className="flex gap-2 w-full min-w-0" key={i}>
                {faces.length > 1 && (
                  <p className="text-2xl font-semibold text-muted-foreground mb-1">
                    {i + 1}
                  </p>
                )}
                <div className="flex flex-col text-sm flex-1 min-w-0">
                  <div>
                    <span className="text-muted-foreground">{labels.genderLabel}:</span> {face.gender != null ? t(face.gender.toLowerCase()) : "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{labels.ageLabel}:</span> {face.age != null ? Math.round(face.age) : "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{labels.expressionLabel}:</span>{" "}
                    {face.expressions != null ? (
                      <div className="mt-1 space-y-1">
                        {face.expressions.map((e, idx) => (
                          <div
                            className="flex items-center gap-2 w-full min-w-0"
                            key={idx}
                          >
                            <span className="w-6 text-base leading-none">
                              {e.emoji}
                            </span>
                            <div
                              className="h-2 flex-1 min-w-0 rounded bg-muted overflow-hidden"
                            >
                              <div
                                className={cn(
                                  "h-full rounded",
                                  e.isTop ? "bg-blue-500" : "bg-muted-foreground/40",
                                )}
                                style={{ width: `${Math.max(0, Math.min(100, e.pct))}%` }}
                              />
                            </div>
                            <span className="w-12 text-right tabular-nums text-muted-foreground">
                              {e.pct}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Debug Info */}
      <div className="text-xs text-muted-foreground bg-muted rounded-md p-2">
        {fps ? (
          <>
            {" "}
            FPS: <span>{fps}</span>
          </>
        ) : null}{" "}
        | Faces: <span>{faces.length} </span>| Status: <span>{status}</span>
        {backend ? (
          <>
            {" "}
            | Backend: <span>{backend}</span>
          </>
        ) : null}
        {descriptorPreview ? (
          <div>
            Descriptor: <span className="font-mono">{descriptorPreview}</span>
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="text-red-500">
            {error}
          </div>
        ) : null}
      </div>
    </section>
  );
}
