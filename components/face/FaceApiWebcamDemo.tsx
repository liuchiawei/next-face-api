"use client";

import { useEffect, useRef, useState } from "react";
import type * as FaceApi from "@vladmandic/face-api";
import { Webcam } from "@/components/ui/webcam";
import { cn } from "@/lib/utils";

type Status = "idle" | "loading_models" | "ready" | "running" | "error";

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
  const [facesCount, setFacesCount] = useState<number>(0);
  const [descriptorPreview, setDescriptorPreview] = useState<string | null>(
    null,
  );
  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [expressions, setExpressions] = useState<string[] | null>(null);

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

        setFacesCount(results.length);

        const first = results[0];
        if (first) {
          setGender(first.gender ?? null);
          setAge(typeof first.age === "number" ? first.age : null);
          const expr = first.expressions
            ? topK(first.expressions as unknown as Record<string, number>, 2)
            : [];
          setExpressions(
            expr.length > 0
              ? expr.map(([k, v]) => `${String(k)} ${Math.round(v * 100)}%`)
              : null,
          );
        } else {
          setGender(null);
          setAge(null);
          setExpressions(null);
        }

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

        for (const r of results) {
          const box = r.detection.box;
          const bx = mx(vw, box.x, box.width);

          ctx.strokeStyle = "deepskyblue";
          ctx.globalAlpha = 0.9;
          ctx.strokeRect(bx, box.y, box.width, box.height);

          ctx.fillStyle = "deepskyblue";
          ctx.globalAlpha = 0.65;
          const labelW = Math.max(160, box.width);
          const labelX = MIRROR_VIDEO ? mx(vw, box.x, labelW) : box.x;
          ctx.fillRect(labelX, box.y - 40, labelW, 40);

          ctx.globalAlpha = 1;
          ctx.fillStyle = "black";

          const expr = r.expressions
            ? topK(r.expressions as unknown as Record<string, number>, 2)
            : [];
          const exprText = expr
            .map(([k, v]) => `${String(k)} ${Math.round(v * 100)}%`)
            .join(" ");

          const genderText =
            r.gender && typeof r.genderProbability === "number"
              ? `${Math.round(r.genderProbability * 100)}% ${r.gender}`
              : "";
          const ageText =
            typeof r.age === "number" ? `${Math.round(r.age)}y` : "";

          ctx.fillText(
            [genderText, ageText, exprText].filter(Boolean).join("  "),
            labelX + 4,
            Math.max(0, box.y - 36),
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
        }
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
      <div className="relative w-full min-w-0">
        <Webcam ref={videoRef} containerClassName="w-full" />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 w-full h-full"
        />
      </div>
      {/* Info */}
      <div className="w-full min-w-0">
        <div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            性別:{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {gender ?? "—"}
            </span>
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            年齡:{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {age != null ? Math.round(age) : "—"}
            </span>{" "}
            才
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            表情:{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {expressions != null ? expressions.join(", ") : "—"}
            </span>
          </div>
        </div>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Status:{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {status}
          </span>
          {backend ? (
            <>
              {" "}
              · Backend:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {backend}
              </span>
            </>
          ) : null}
          {fps ? (
            <>
              {" "}
              · FPS:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {fps}
              </span>
            </>
          ) : null}{" "}
          · Faces:{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {facesCount}
          </span>
        </div>
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          Model URL: <span className="font-mono">{modelUrl}</span>
        </div>
        {descriptorPreview ? (
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            Descriptor: <span className="font-mono">{descriptorPreview}</span>
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="text-sm text-red-600">
            {error}
          </div>
        ) : null}
      </div>
    </section>
  );
}
