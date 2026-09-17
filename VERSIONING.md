# バージョンの進め方

製品の `ver1.0` は `1.0.0` と同じ意味で扱う。Sites側の「保存版1、2…」は配信システムの連番なので、製品版とは別に記録する。

| 変更 | 製品版の例 | Gitタグ |
| --- | --- | --- |
| 小さな不具合修正 | ver1.0.1 | v1.0.1 |
| 機能追加・操作改善 | ver1.1 | v1.1.0 |
| 操作体系などの大きな変更 | ver2.0 | v2.0.0 |

## 各版の記録

1. 依頼内容に合わせて次の版を決め、`work/v<版番号>` ブランチで実装する。
2. `CHANGELOG.md` に変更点、確認結果、残る制約を記録する。
3. 検証した公開ソースのコミット、Gitタグ、Sitesの保存版IDと公開IDを対応付ける。
4. `../releases/petakakushi-v<版番号>/` にソース、Git bundle、公開データ、復元手順、SHA-256を保存する。
5. 既存版のタグや保存物を更新しない。修正は新しい版として残す。

## 公開版の対応

後続版の対応表は `releases/v<版番号>.json` に保存する。

現在の外部公開版ver1.6.2は次のとおり。

- Gitタグ: `v1.6.2`
- 公開ソース: `1838fdf32998b984c61e052cf999997d909e18d2`
- Cloudflare Worker: `petakakushi-app`
- URL: https://petakakushi-app.r524.workers.dev
- Cloudflare Version ID: `289337c8-50a1-48a4-9601-4378d572c1ab`
- Sites版ver1.6（保存版9）は変更せず保持
- 詳細: [ver1.6.2の記録](releases/v1.6.2.json)

### 外部公開版ver1.6.1

- Gitタグ: `v1.6.1`
- 公開ソース: `405baf773db9e7ff349ded9ca5af4d3564a0d21b`
- Cloudflare Version ID: `12d68391-4a91-4d1c-82fa-dfcc0e0041b3`
- 詳細: [ver1.6.1の記録](releases/v1.6.1.json)

### Sites版ver1.6

- Gitタグ: `v1.6.0`
- 公開ソース: `f4ca13495e4b9bf4302b8116717094130fcdc884`
- Sites保存版: `9`
- Version ID: `appgprj_6a9f868ff5c08191b89670c11f8895e9~appgver_c7a4cc396a44819190675d541f379f14`
- Deployment ID: `appgdep_6a9fbe8a4184819192cb63654dbe93b6`（成功）
- 詳細: [ver1.6の記録](releases/v1.6.0.json)
- 過去の版: [ver1.5の記録](releases/v1.5.0.json)、 [ver1.4の記録](releases/v1.4.0.json)、 [ver1.3.2の記録](releases/v1.3.2.json)、 [ver1.3.1の記録](releases/v1.3.1.json)、 [ver1.3の記録](releases/v1.3.0.json)、 [ver1.2の記録](releases/v1.2.0.json)、 [ver1.1の記録](releases/v1.1.0.json)

### 保存済みver1.0

- 製品版: `1.0.0`（表示名 `ver1.0`）
- Gitタグ: `v1.0.0`
- 公開ソース: `0fd24e513207195f298bf259ca208aa44b2e81aa`
- Sites保存版: `1`
- Site ID: `appgprj_6a9f868ff5c08191b89670c11f8895e9`
- Version ID: `appgprj_6a9f868ff5c08191b89670c11f8895e9~appgver_945caad962c88191930f9904e552d980`
- Deployment ID: `appgdep_6a9f8c4f41208191ac64e1fc182782a6`
- URL: https://petakakushi-524.r5ni4.chatgpt.site
- 記録時の閲覧範囲: 本人のみ

初版の `package.json` にある `0.1.0` は生成時の雛形値。公開ソースをそのまま保存するため初版では変更せず、製品版は上記のタグと記録で特定する。次の実装版からパッケージの値も製品版に揃える。

版管理用ドキュメントを追加したコミットと、初版の公開コミットは異なる。`v1.0.0` は初版公開コミットに固定してある。
