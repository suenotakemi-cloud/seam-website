#!/bin/bash
# SEAM 銀座 — Square 決済 Worker デプロイ補助
# 使い方: ターミナルで次の1行だけ実行 →  bash ~/Downloads/code_sandbox_light_a3728b14_1778910042/booking/square/deploy.sh
set -e
cd "$(dirname "$0")"

echo "▶ 1/2  Worker をデプロイします"
echo "   （初回だけ 'Would you like to register a workers.dev subdomain?' が出たら y → Enter）"
echo ""
npx --yes wrangler deploy

echo ""
echo "▶ 2/2  Access Token（秘密鍵）を登録します"
echo "   'Enter a secret value:' が出たら、Square Developer(Sandbox) の Access Token を貼り付けて Enter"
echo ""
npx --yes wrangler secret put SQUARE_ACCESS_TOKEN

echo ""
echo "======================================================================"
echo "✅ 完了しました。"
echo "   上に表示された Worker の URL（例 https://seam-square-pay.xxxx.workers.dev）の"
echo "   末尾に  /pay  を付けたものを、pay.html の PAY_ENDPOINT に貼り付けてください。"
echo "   例) PAY_ENDPOINT: 'https://seam-square-pay.xxxx.workers.dev/pay'"
echo "======================================================================"
