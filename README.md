# 重生之 Debug 博士逆轉台北

> 都市重生 × 科技選戰 × 打詐快意小說。帶著八十年的記憶，再戰一次台北。
> 這個故事有一萬種結局，你正在看的，是之一。

2061 年，八十歲的 Debug 博士程一凡死在一個沒有人相信真相的台北。再睜眼，他回到投票前三十三天——
這一世，他帶著一個講台灣國語、畢生心願是吃一碗滷肉飯的洋人 AI 妹妹，要讓「深偽之夜」永遠不會發生。

- **全書 13 章**：網文節拍——黃金開場、先抑後揚、打臉反轉、章末卡點
- **一分鐘悅讀**：每章 8 格漫劇分鏡（鉤子→蓄勢→蓄勢→轉折→快意→揭曉→動情→懸念），附旁白；另有「五分鐘漫劇版」
- **Debug 小教室**：每章一堂真實可查證的實用課——深偽辨識、語音複製詐騙、假投資紅旗、個資保護、選罷法常識
- **一萬條世界線**：輸入 1～10000 任一編號，看另一個宇宙的故事梗概；#0001 是正史
- **3D 多重世界**：逆轉台北、浮島夜市、星海 2061、五色大陸、一沙一世界，附場景音效與旁白

閱讀：https://tboydar.github.io/honki-novel/
漫劇版：https://tboydar.github.io/honki-novel/comic.html
3D：https://tboydar.github.io/honki-novel/world/

## 聲明

- 本作為**架空小說**，所有人物、公司、組織與事件皆為虛構，不影射任何真實人物。
- **非競選廣告**：未受任何候選人、政黨或競選團隊出資、委託或授權；書中不出現真實政黨與候選人、不引用民調、不寫開票結果、不呼籲投票給任何人。
- 插圖皆為原創生成，人物皆非真人肖像；旁白為 AI 合成配音，非任何真人聲音。
- 由人類企劃與編輯，搭配 AI 工具協作生成文字、插圖與配音。

## 結構

```
novel/00-世界觀與寫作規範.md   世界觀、角色、法規護欄、爆款節拍規範
novel/outlines.md             13 章大綱
novel/chapters/NN.md          正文
novel/storyboards/NN.json     每章 8 格分鏡（節拍、台詞、畫面描述）
novel/lessons.md              Debug 小教室（含資料來源）
build_site.py                 產生 docs/ 靜態網站
docs/                         GitHub Pages（main /docs）
docs/world/                   three.js 3D 多重世界
docs/audio/                   旁白音檔
```

重建網站：`python3 build_site.py`

## 授權

- 小說文字、插圖與音檔：CC BY-NC-SA 4.0
- 網站程式碼：MIT（見 LICENSE）
- three.js：MIT（見 docs/world/vendor/THREE-LICENSE.txt）

版本 v20261029.4　|　[工作日誌](WORKLOG.md)　|　[結案報告](REPORT.md)
