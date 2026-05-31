# FoodEye 試験導入監査レポート

**監査日:** 2026-05-16  
**対象バージョン:** v1.0  
**監査結果:** 🟡 試験導入条件付き可能（修正後）

---

## システム概要

食品工場における異物事故の記録・AI推定・官能検査・報告書生成を統合するクラウドSaaS。  
Next.js 15 + Firebase v10 + Tailwind CSS。DEMO_MODE（localStorage）と Firebase 本番モードを切り替え可能。

---

## 監査スコア（修正前）

| 評価エリア | 得点 |
|---|---|
| 認証・アクセス制御 | 4 / 10 |
| データ永続化・信頼性 | 5 / 10 |
| Firestore設計・スケーラビリティ | 3 / 10 |
| モバイルUI・アクセシビリティ | 7 / 10 |
| オフライン・障害耐性 | 5 / 10 |
| ストレージ・コスト設計 | 4 / 10 |
| AI推定品質 | 6 / 10 |
| 出力・報告書品質 | 7 / 10 |
| コード品質・保守性 | 8 / 10 |
| 運用・保守体制 | 2 / 10 |
| **合計** | **51 / 100** |

**修正前判定:** ❌ 実運用不可

---

## 発見された主要問題

### 致命的（試験導入ブロッカー）

1. **Firestoreセキュリティルール未定義**  
   `firestore.rules` ファイルが存在しない。認証さえ通れば他工場の全データを読み書き・削除可能。

2. **`saveLocal()` の QuotaExceededError 未処理**  
   `src/lib/firestore.ts` の `saveLocal` / `saveSensoryLocal` / `saveReportsLocal` に try-catch なし。  
   写真3〜4枚の添付で localStorage 上限（Safari ≈10MB）を超過しサイレントクラッシュ。

3. **`getIncident` / `getSensoryEvaluation` に所有者チェックなし**  
   URL推測（`/record/[UUID]`）だけで他ユーザーの事故記録を閲覧可能。

### 高リスク

4. **`findIncidentsByLot` が毎回全件取得**  
   `listIncidents`（全件ダウンロード）経由でフィルタリング。10万件で100,000 reads/回。  
   官能検査登録時・詳細画面表示のたびに実行され、Firebase コスト爆発の原因。

5. **`maximumScale: 1` によるズーム禁止**  
   `layout.tsx` で全画面のピンチズームを禁止。WCAG 2.1 違反。食品工場の老眼作業者が操作不可。

### Firestore インデックス未設定

`firestore.indexes.json` が存在しない。Firebase MODE で `listIncidents` が  
`FirebaseError: The query requires an index` でクラッシュする可能性。

---

## 現場シミュレーション結果

| シナリオ | リスク | 内容 |
|---|---|---|
| 電波弱い工場 | 🔴 データ消失 | Storage アップロード失敗 → 写真が消える |
| 連続撮影 | 🔴 ページリセット | URL.createObjectURL のメモリリーク → iOS で強制リロード |
| 複数人同時入力 | ✅ 問題なし | Firestore SDK が並列書き込みを処理 |
| タブレット | ✅ 問題なし | max-w-2xl でレイアウト安定 |

---

## 試験導入条件

修正完了後、以下の条件で試験導入を承認：

1. Firebase 本番接続（DEMOモード使用禁止）
2. `firebase deploy --only firestore:rules,firestore:indexes` 実行済み
3. 1工場・5名以下
4. 月500件以内
5. 本システムの記録は「補助情報」として扱い、行政報告書の正本に単独使用しないこと
