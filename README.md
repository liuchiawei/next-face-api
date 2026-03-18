# next-face-api

使用 Next.js App Router + `@vladmandic/face-api` 做的 **Webcam 人臉偵測示範**，並整合 `next-intl` 做 **多語系路由**（`/en`, `/zh`, `/ja`）。

## 需求

- Node.js：建議使用 LTS 版
- 套件管理：**pnpm**

## 開始使用

安裝依賴：

```bash
pnpm install
```

啟動開發環境：

```bash
pnpm dev
```

打開 `http://localhost:3000`。

## 功能與路由

- **首頁**：`app/[locale]/page.tsx`
- **多語系訊息檔**：`messages/*.json`
- **語系切換**：`components/LocaleSwitcher.tsx`
- **Webcam + Face API Demo**：`components/face/FaceApiWebcamDemo.tsx`

## Face API 模型來源（重要）

目前 `FaceApiWebcamDemo` 預設會從 CDN 載入模型：

- `https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/`

如果你希望 **離線/自架模型**（例如放在 `public/models`），可以把 `modelUrl` 傳進元件（需確保該路徑可被瀏覽器存取）：

```tsx
<FaceApiWebcamDemo modelUrl="/models" />
```

## Webcam 權限與常見問題

- **需要 HTTPS 或 localhost**：瀏覽器通常只允許在安全來源使用攝影機（本機 `localhost` 可用）。
- **看不到影像**：確認瀏覽器已允許此站台的攝影機權限，且沒有被其他 App 佔用。
- **偵測慢/卡頓**：此 Demo 會使用 WebGL 後端並以固定 FPS 節流；不同裝置效能差異很大。

## 常用指令

```bash
pnpm dev      # 開發
pnpm build    # 建置
pnpm start    # 以 production mode 啟動
pnpm lint     # ESLint
```

## 部署

可部署到 Vercel。一般情況下：

```bash
pnpm build
pnpm start
```

若要在部署環境下使用 Webcam，請使用 HTTPS 網域並確認瀏覽器權限設定。
