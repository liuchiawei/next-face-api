import { FaceApiWebcamDemo } from "@/components/face/FaceApiWebcamDemo";

export default function Home() {
  return (
    <main className="w-full max-w-4xl mx-auto p-6 sm:p-10">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Webcam + FaceAPI Demo
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-mono text-[0.9em]">@vladmandic/face-api</span> を使用して、
          ブラウザ上でリアルタイムに顔、ランドマーク、年齢・性別、表情、ディスクリプタを検出します。
        </p>
      </header>

      <FaceApiWebcamDemo />
    </main>
  );
}
