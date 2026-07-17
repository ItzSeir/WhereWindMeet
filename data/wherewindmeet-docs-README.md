# Documentation 使用指南

這個頁面會自動讀取 GitHub Repository 指定資料夾裡的所有 `.md` 文件，並顯示成 Documentation 網站。

它支援：

- 左側文章列表
- 文章全文搜尋
- 右側本頁章節目錄
- 白天／夜晚模式
- 自動記住使用者選擇
- Markdown 標題、粗體、清單、連結、圖片、表格
- 程式碼區塊
- 資訊框、警告框、危險提示框

---

# 1. Folder 結構

建議使用：

```text
repository/
├─ data/
│  └─ minecraft-docs/
│     ├─ 01-start.md
│     ├─ 02-rules.md
│     ├─ 03-announcements.md
│     └─ 04-pve-guide.md
│
└─ minecraft/
   └─ minecraft-docs.html
```

如果是 WhereWindMeet，可以改成：

```text
repository/
├─ data/
│  └─ wherewindmeet-docs/
│     ├─ 01-start.md
│     ├─ 02-registration.md
│     └─ 03-announcements.md
│
└─ documentation/
   └─ wherewindmeet-docs.html
```

---

# 2. 修改 Repository 設定

在 HTML 裡找到：

```js
const DOCS_CONFIG = {
  owner: "ItzSeir",
  repo: "FloestSMP",
  branch: "main",
  folder: "data/minecraft-docs",
  defaultFile: "01-start.md"
};
```

說明：

| 設定 | 用途 | 範例 |
|---|---|---|
| `owner` | GitHub 帳號或組織名稱 | `ItzSeir` |
| `repo` | Repository 名稱 | `FloestSMP` |
| `branch` | Branch 名稱 | `main` |
| `folder` | Markdown 文件所在資料夾 | `data/minecraft-docs` |
| `defaultFile` | 預設開啟的文章 | `01-start.md` |

WhereWindMeet 版本：

```js
const DOCS_CONFIG = {
  owner: "ItzSeir",
  repo: "WhereWindMeet",
  branch: "main",
  folder: "data/wherewindmeet-docs",
  defaultFile: "01-start.md"
};
```

---

# 3. 新增文章

在文件資料夾內新增 `.md`：

```text
04-pve-guide.md
```

建議檔名加編號：

```text
01-start.md
02-rules.md
03-announcements.md
04-pve-guide.md
05-faq.md
```

數字會控制左側文章排序。

---

# 4. Markdown 標題

```md
# 文章主標題

## 第一個章節

### 子章節

#### 更小的標題
```

注意：

- 第一個 `#` 會作為頁面頂部標題。
- 系統會自動從文章內容移除第一個 `#`，避免標題重複。
- `##` 和 `###` 會自動出現在右側「本頁內容」。

範例：

```md
# 新手開始指南

歡迎來到教學中心。

## 如何加入伺服器

這裡放加入方式。

### Java 版

這裡放 Java 版資訊。
```

---

# 5. 粗體、斜體和刪除線

```md
**粗體文字**

*斜體文字*

~~刪除線~~
```

顯示效果：

- **粗體文字**
- *斜體文字*
- ~~刪除線~~

---

# 6. 一般清單

無編號清單：

```md
- 第一項
- 第二項
- 第三項
```

有編號清單：

```md
1. 第一步
2. 第二步
3. 第三步
```

巢狀清單：

```md
- Minecraft
  - Java Edition
  - Bedrock Edition
- WhereWindMeet
  - 團隊報名
  - 活動公告
```

---

# 7. Checkbox 任務清單

```md
- [x] 已完成
- [ ] 未完成
- [ ] 等待處理
```

適合用在：

- 更新清單
- 維護進度
- 活動準備
- 開發事項

---

# 8. 超連結

```md
[前往 WhereWindMeet](https://itzseir.github.io/WhereWindMeet/)
```

外部網址會自動在新分頁開啟。

---

# 9. 圖片

網路圖片：

```md
![圖片說明](https://example.com/image.png)
```

Repository 內圖片：

```md
![副本圖片](../images/dungeon.png)
```

如果 Markdown 位於：

```text
data/minecraft-docs/04-guide.md
```

圖片位於：

```text
data/images/dungeon.png
```

可使用：

```md
![副本圖片](../images/dungeon.png)
```

---

# 10. 行內程式碼

```md
使用 `/spawn` 返回出生點。
```

適合：

- Minecraft 指令
- 檔案名稱
- JavaScript 變數
- 路徑

---

# 11. 程式碼區塊

使用三個反引號：

````md
```js
const name = "WhereWindMeet";
console.log(name);
```
````

其他常用語言：

````md
```html
<div>Hello</div>
```

```css
.card{
  border-radius:12px;
}
```

```json
{
  "name": "WhereWindMeet"
}
```

```text
純文字內容
```
````

---

# 12. 引用框

一般引用：

```md
> 這是一段引用文字。
```

多行引用：

```md
> 第一行
>
> 第二行
```

---

# 13. 資訊框

目前這個 Documentation 支援 HTML class 方式。

藍色資訊框：

```html
<div class="info">
<strong>資訊：</strong>
這裡放一般資訊。
</div>
```

也可以使用：

```html
<div class="notice">
<strong>提示：</strong>
這裡放重要提示。
</div>
```

---

# 14. 警告框

黃色警告框：

```html
<div class="warning">
<strong>注意：</strong>
進行這個操作前，請先備份資料。
</div>
```

適合：

- 版本限制
- 操作前提醒
- 可能影響資料的功能

---

# 15. 危險提示框

紅色危險框：

```html
<div class="danger">
<strong>警告：</strong>
這個操作可能會刪除資料，而且無法復原。
</div>
```

適合：

- 永久刪除
- 封禁警告
- 高風險設定
- 資料重置

---

# 16. 表格

基本表格：

```md
| 指令 | 功能 |
|---|---|
| `/spawn` | 返回出生點 |
| `/home` | 返回家 |
| `/tpa 玩家名稱` | 發送傳送請求 |
```

欄位對齊：

```md
| 名稱 | 數量 | 狀態 |
|:---|---:|:---:|
| 輸出 | 6 | 已開放 |
| 坦克 | 2 | 已滿 |
| 治療 | 2 | 缺人 |
```

對齊標記：

| Markdown | 效果 |
|---|---|
| `:---` | 靠左 |
| `---:` | 靠右 |
| `:---:` | 置中 |

---

# 17. 分隔線

```md
---
```

適合分開不同內容區域。

---

# 18. 混合使用範例

```md
# 副本報名教學

歡迎使用副本報名系統。

<div class="info">
<strong>資訊：</strong>
請先登入 Discord，再開始報名。
</div>

## 報名步驟

1. 選擇活動日期。
2. 選擇隊伍。
3. 選擇職業。
4. 填寫遊戲名稱。
5. 提交報名。

## 職業需求

| 職業 | 人數 | 狀態 |
|---|---:|:---:|
| 輸出 | 6 | 開放 |
| 坦克 | 2 | 已滿 |
| 治療 | 2 | 缺 1 人 |

<div class="warning">
<strong>注意：</strong>
報名後無法直接更改角色名稱，請先確認資料。
</div>

## 常用連結

[前往團隊報名頁](https://itzseir.github.io/WhereWindMeet/PVERegistration)
```

---

# 19. 白天／夜晚模式

右上角有主題按鈕：

```text
🌙 夜晚
```

切換後：

```text
☀️ 白天
```

系統行為：

1. 第一次開啟時跟隨電腦系統主題。
2. 使用者手動切換後，使用 `localStorage` 記住。
3. 重新整理或下次進入時仍保留設定。

使用的儲存鍵：

```js
docs-theme
```

如果要重設：

```js
localStorage.removeItem("docs-theme");
location.reload();
```

---

# 20. 搜尋

點擊上方搜尋框，輸入：

```text
Boss
```

系統會搜尋：

- 文章標題
- 文章內容
- 指令
- 表格文字

也可以按鍵盤：

```text
/
```

快速聚焦搜尋框。

---

# 21. 注意事項

不要直接用：

```text
file:///C:/...
```

打開 HTML 測試。

請使用：

- GitHub Pages
- VS Code Live Server
- Python local server

Python：

```bash
python -m http.server 8000
```

然後開啟：

```text
http://localhost:8000/
```

---

# 22. GitHub Pages 更新

上傳或修改 `.md` 後：

1. Commit changes。
2. 等待 GitHub Pages 部署。
3. 重新整理 Documentation 頁面。
4. 新文章會自動出現在左側。

如果沒有立即更新，可以按：

```text
Ctrl + F5
```

強制重新載入。
