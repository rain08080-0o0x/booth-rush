# 押し進め！BOOTH RUSH

イベント会場の人混みを抜け、45秒以内に目的のブースを目指す短編ブラウザゲームです。

## ローカルで遊ぶ

`dist` を静的ファイルサーバーで配信してください。

```powershell
python -m http.server 8080 --directory dist
```

ブラウザで `http://localhost:8080` を開きます。

## 操作

- `WASD` / 矢印キー: 移動
- `Space`: スタミナを使って押し進む
- スマートフォン: 画面下部の方向ボタンと PUSH ボタン

## GitHub Pages

`.github/workflows/pages.yml` が `main` ブランチへの push 時に `dist` を公開します。GitHub 側の **Settings → Pages → Build and deployment** で Source を **GitHub Actions** に設定してください。
