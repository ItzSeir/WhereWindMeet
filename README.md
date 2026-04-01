# 燕雲十六聲 夢回花深處俠境報名清單

> A Firebase-powered team signup board for party scheduling.

![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-blue?style=for-the-badge)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Testing-success?style=for-the-badge)

---

## Preview

這是一個用於 **燕雲十六聲** 組隊報名的網頁系統，支援多人同步更新，讓隊伍可以更方便安排時間與職業配置。

### 主要用途
- 顯示未來幾天的開團時間
- 玩家可直接報名
- 自動記錄隊伍人數
- 顯示輸出 / 承傷 / 治療配置
- Firebase 即時同步

---

## Features

- 多日報名面板
- Firebase Firestore 即時同步
- 自訂新增時間段
- 固定時間段不可刪除
- 自訂時間段可刪除
- 每隊最多 10 人
- 每隊至少 2 位治療
- 刪除報名玩家前需確認
- 隊伍狀態顏色提示
  - 有隊友：藍色
  - 滿隊：紅色
- 報名彈窗
- 記住名字功能
- 自訂職業下拉選單

---

## Tech Stack

- **HTML**
- **CSS**
- **JavaScript**
- **Firebase Firestore**
- **GitHub Pages**

---

## Live Demo

🔗 [Open Website](https://itzseir.github.io/WWW/)

---

## Current Rules

### Team Rules
- 一隊最多 **10 人**
- 每隊至少 **2 個治療**
- 若最後 2 個位置時治療仍不足，則限制只能選治療

### Time Rules
- 支援固定時間段
- 支援手動新增時間段
- 滿隊時可自動開新隊
- 固定時間段不可刪除
- 自訂時間段可以刪除（空白時）

---

## Project Structure

```bash
.
├── index.html
├── README.md
└── data / Firebase Firestore
