# VR Color Circle Bowling

Game VR học và ghi nhớ vòng tròn màu thông qua cơ chế bowling. Dự án chạy hoàn toàn trên web bằng Three.js, WebXR và Vite, không dùng Unity.

Người chơi nhặt bóng màu từ giá bóng, ném xuống lane bowling và đánh trúng bia đúng màu. Các level sau dùng hộp mix 2 slot để phối màu, tạo bóng Secondary, Tertiary hoặc Tint mới rồi ném bóng đó vào target.

## Mục Tiêu Dự Án

- Xây dựng demo WebXR có thể chạy trên trình duyệt desktop và kính VR hỗ trợ WebXR.
- Giúp người chơi học nhóm màu Primary, Secondary, Tertiary và Tint qua thao tác trực quan.
- Tạo gameplay ngắn, dễ demo, có trạng thái thắng thua, âm thanh, hiệu ứng và phản hồi controller.
- Có pipeline build/deploy đơn giản bằng Vite và GitHub Pages.

## Tính Năng Chính

- Scene 3D bowling bằng Three.js.
- WebXR VR mode qua `VRButton` và `renderer.xr`.
- Điều khiển desktop bằng chuột để test nhanh.
- Điều khiển VR bằng controller: nhặt bóng, vung tay và thả để ném.
- Bảng điều khiển 3D trong VR: chọn mode, xem HUD, chuyển level, reset và chơi
  lại hoàn toàn bằng một trong hai tay cầm Meta Quest 3.
- 3 level học màu, mở khóa tuần tự.
- 2 chế độ chơi:
  - `Easy`: không giới hạn thời gian, lane trống và bia cố định.
  - `Hard`: giới hạn thời gian, ném sai màu bị trừ 2 giây, có obstacle pachinko và bia xoay ở Level 2-3.
- Giá bóng nguồn đặt bên phải người chơi, bóng tự quay về vị trí sẵn sàng sau khi dùng.
- Hộp mix 2 slot đặt bên trái, nhận 2 bóng theo công thức và sinh bóng kết quả.
- Shelf bóng nguồn được xếp gọn theo hàng/lưới để dễ chọn bóng.
- Easy và Hard Level 1 dùng bia cố định; target nhiều hàng có cơ chế rơi theo cột.
- Hard Level 2-3 đặt bia trên ellipse quay liên tục để người chơi phải căn timing.
- Hard có peg, bumper nảy mạnh và kicker tam giác; mật độ tăng theo level.
- Mô phỏng vật lý nhẹ: bóng lăn, nảy, va bumper, trúng/trượt bia.
- Hệ thống phối màu qua hộp mix:
  - Primary + Primary -> Secondary.
  - Primary + Secondary -> Tertiary.
  - Color + White -> Tint.
  - Công thức sai sẽ báo lỗi và trả bóng về giá.
- Hiệu ứng particle khi đúng màu, khói khi sai hoặc trượt.
- Âm thanh nền và SFX tổng hợp bằng Web Audio API.
- Rung controller nếu thiết bị hỗ trợ haptic feedback.
- Deploy tự động lên GitHub Pages bằng GitHub Actions.

## Công Nghệ Sử Dụng

| Thành phần | Công nghệ                     |
| ---------- | ----------------------------- |
| 3D engine  | Three.js                      |
| VR runtime | WebXR Device API              |
| Build tool | Vite                          |
| UI/HUD     | HTML, CSS                     |
| Âm thanh   | Web Audio API                 |
| Deploy     | GitHub Actions + GitHub Pages |

## Yêu Cầu Môi Trường

- Node.js 20 hoặc mới hơn.
- npm.
- Trình duyệt desktop hiện đại để test nhanh, ví dụ Chrome hoặc Edge.
- Kính VR/trình duyệt hỗ trợ WebXR để vào chế độ VR, ví dụ Meta Quest Browser.
- Với VR thật, nên chạy qua HTTPS. GitHub Pages là cách deploy phù hợp cho demo.

## Cài Đặt Và Chạy Local

```bash
npm install
npm run dev
```

Vite mặc định chạy ở:

```text
http://localhost:5173
```

Nếu test trên thiết bị khác trong cùng mạng LAN, dùng địa chỉ IP máy đang chạy dev server. Cấu hình Vite đã bật `host: true`.

## Build Và Preview

Build production:

```bash
npm run build
```

Preview bản build:

```bash
npm run preview
```

Thư mục output sau build là `dist/`.

## Cách Chơi

1. Chọn `Start Easy` hoặc `Start Hard`.
2. Nhặt hoặc chọn bóng ở giá bóng bên phải người chơi.
3. Ở level mix màu, đặt 2 bóng vào hộp mix bên trái để tạo bóng mới.
4. Ném bóng xuống lane về phía bia đúng màu.
5. Khi hoàn thành đủ target của level hiện tại, game tự mở khóa level tiếp theo.
6. Hoàn thành Level 3 để thắng toàn bộ game.

## Luật Level

| Level                         | Nội dung                  | Luật chính                                                                                     |
| ----------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| Level 1 - Primary             | Học màu cơ bản            | Ném bóng Red, Yellow, Blue vào đúng bia cùng màu.                                              |
| Level 2 - Mix Secondary       | Phối màu Secondary        | Đặt 2 bóng Primary vào hộp mix để tạo Orange, Green, Purple, sau đó ném bóng mới vào đúng bia. |
| Level 3 - Mix Tertiary & Tint | Phối màu Tertiary và Tint | Dùng hộp mix để tạo Secondary, Tertiary và Tint. White là bóng nguồn bắt buộc để tạo Tint.     |

## Công Thức Phối Màu

| Công thức       | Kết quả       |
| --------------- | ------------- |
| Red + Yellow    | Orange        |
| Blue + Yellow   | Green         |
| Blue + Red      | Purple        |
| Orange + Red    | Red Orange    |
| Orange + Yellow | Yellow Orange |
| Green + Yellow  | Yellow Green  |
| Blue + Green    | Blue Green    |
| Blue + Purple   | Blue Purple   |
| Purple + Red    | Red Purple    |
| Red + White     | Red Tint      |
| Yellow + White  | Yellow Tint   |
| Blue + White    | Blue Tint     |
| Orange + White  | Orange Tint   |
| Green + White   | Green Tint    |
| Purple + White  | Purple Tint   |

## Chế Độ Chơi

### Easy

- Không giới hạn thời gian.
- Không phạt thời gian khi ném sai.
- Phù hợp để học luật, test demo và trình bày gameplay.

### Hard

- Mỗi level có thời gian giới hạn; ném trúng sai màu bị trừ 2 giây.
- Level 1 thêm các peg pachinko thưa, bia vẫn cố định.
- Level 2 thêm bumper và kicker tam giác, bia màu quay chậm trên vòng tròn.
- Level 3 có nhiều kicker mạnh hơn, obstacle dày hơn và bia quay nhanh hơn.
- Kicker tam giác bật bóng rất mạnh và làm lệch hướng theo cạnh/điểm va chạm; không dùng random và không trừ điểm hoặc thời gian.
- Hết giờ sẽ dừng level hiện tại và phát âm thanh thua.

## Điều Khiển

### Desktop

| Thao tác                              | Chức năng                                             |
| ------------------------------------- | ----------------------------------------------------- |
| Click bóng ở giá bóng                 | Chọn bóng cần ném.                                    |
| Click lane hoặc bia                   | Ném bóng đã chọn về vị trí click.                     |
| Click slot hộp mix khi đang chọn bóng | Đặt bóng vào hộp mix.                                 |
| Bắn trúng bia thấp                    | Các bia phía trên cùng cột rơi xuống vị trí thấp hơn. |
| Phím `F`                              | Đưa camera về lại góc gameplay.                       |
| Phím `Esc`                            | Bỏ chọn bóng hiện tại.                                |

### VR

| Thao tác                                            | Chức năng                                                         |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| Bấm `Enter VR` trên Meta Quest Browser              | Bắt đầu phiên WebXR; đây là thao tác web duy nhất cần thiết.      |
| Trỏ ray tay trái hoặc tay phải vào nút 3D + trigger | Chọn Easy/Hard, Next Level, Reset, đổi mode, retry hoặc chơi lại. |
| Nút `A` hoặc `X`                                    | Mở hoặc thu gọn bảng điều khiển VR.                               |
| Nút `B` hoặc `Y`                                    | Đóng bảng phụ hoặc hủy thao tác đang cầm bóng.                    |
| Trỏ controller vào bóng và giữ select/trigger       | Nhặt bóng.                                                        |
| Vung tay rồi thả select/trigger                     | Ném bóng xuống lane.                                              |
| Thả bóng gần slot hộp mix                           | Đặt bóng vào hộp mix.                                             |
| Ném đúng màu                                        | Ghi điểm, phát hiệu ứng và rung controller.                       |
| Ném sai màu hoặc trượt                              | Tạo khói, phát âm thanh báo lỗi, đưa bóng về máng.                |

Sau khi đã vào VR, người chơi không cần bấm HUD HTML. Menu bắt đầu, level, mode,
điểm, timer, trạng thái hết giờ và màn chiến thắng đều được hiển thị trong
không gian VR.

## Cấu Trúc Dự Án

```text
.
├── .github/
│   └── workflows/
│       └── deploy-pages.yml
├── docs/
│   ├── 01_Project_Proposal.md
│   ├── 02_Report_Word_Outline.md
│   ├── 03_Slide_PowerPoint_Outline.md
│   ├── 04_Testing_Checklist.md
│   ├── 05_Performance_Guide.md
│   └── 06_Demo_Script.md
├── src/
│   ├── main.js
│   └── styles.css
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
```

## Vai Trò Các File Chính

| File                                 | Vai trò                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `index.html`                         | Khung HTML chính, HUD, nút điều khiển, overlay chiến thắng và entry script.          |
| `src/main.js`                        | Toàn bộ logic scene, level, vật lý bóng, phối màu, controller VR, HUD, audio và VFX. |
| `src/VRPanel.js`                     | Bảng điều khiển 3D dùng được bằng ray và trigger của cả hai controller.              |
| `src/InputManager.js`                | Ánh xạ chuột và hai tay cầm WebXR, ray UI, nhặt/ném bóng và phím A/B/X/Y.            |
| `src/styles.css`                     | Giao diện HUD, nút bấm, overlay chiến thắng và responsive layout.                    |
| `vite.config.js`                     | Cấu hình Vite, port dev server và `base` tự động cho GitHub Pages.                   |
| `.github/workflows/deploy-pages.yml` | Workflow build bằng Node 20 và deploy thư mục `dist` lên GitHub Pages.               |
| `docs/`                              | Tài liệu phụ trợ cho đề tài, báo cáo, slide, test, performance và demo.              |

## Kiến Trúc Runtime

```text
index.html
  └── src/main.js
        ├── VRColorBowling
        │     ├── setupWorld()
        │     ├── setupControllers()
        │     ├── setupDesktopControls()
        │     ├── startLevel()
        │     ├── updateBallPhysics()
        │     ├── handleTargetCollisions()
        │     └── animate()
        └── AudioEngine
              ├── BGM
              ├── SFX đúng/sai/mix/win/lose
              └── tiếng bóng lăn
```

Luồng chơi chính:

```text
Start Level
  -> spawn target + bóng Primary
  -> người chơi chọn/nhặt bóng
  -> nếu cần màu mới: đặt 2 bóng vào hộp mix
      -> đúng công thức: spawn bóng kết quả
      -> sai công thức: trả bóng về giá
  -> ném bóng vào target
  -> kiểm tra va chạm
      -> đúng màu: ghi điểm
      -> nếu còn bia phía trên cùng cột: bia phía trên rơi xuống
      -> sai/trượt: reset bóng
  -> đủ target: mở level tiếp theo hoặc thắng game
```

## Deploy Lên GitHub Pages

Repo đã có workflow `.github/workflows/deploy-pages.yml`.

Các bước:

1. Push code lên branch `main`.
2. Vào `Settings > Pages` của GitHub repo.
3. Ở `Build and deployment`, chọn source là `GitHub Actions`.
4. Mỗi lần push lên `main`, workflow sẽ:
   - Cài dependencies bằng `npm ci`.
   - Chạy `npm run build`.
   - Upload thư mục `dist`.
   - Deploy lên GitHub Pages.

Link sau deploy thường có dạng:

```text
https://<github-username>.github.io/<repo-name>/
```

`vite.config.js` tự đổi `base` theo tên repo khi chạy trong GitHub Actions, nên asset path phù hợp với GitHub Pages.

## Tài Liệu Trong Thư Mục `docs`

| File                             | Nội dung                                                            |
| -------------------------------- | ------------------------------------------------------------------- |
| `01_Project_Proposal.md`         | Mục tiêu, nội dung, luật chơi, công nghệ và sản phẩm nộp.           |
| `02_Report_Word_Outline.md`      | Dàn ý báo cáo Word.                                                 |
| `03_Slide_PowerPoint_Outline.md` | Dàn ý slide thuyết trình.                                           |
| `04_Testing_Checklist.md`        | Checklist kiểm thử chức năng, audio, VR interaction và performance. |
| `05_Performance_Guide.md`        | Hướng dẫn tối ưu render, geometry, physics, script và audio.        |
| `06_Demo_Script.md`              | Kịch bản demo 3-5 phút.                                             |

## Checklist Kiểm Thử Nhanh

Trước khi nộp hoặc demo, nên kiểm tra:

- `npm install` chạy thành công.
- `npm run dev` mở được app local.
- `npm run build` build thành công.
- Start được Easy mode.
- Start được Hard mode và timer giảm theo thời gian.
- Easy cả 3 level không có obstacle Hard và vẫn dùng bia cố định.
- Hard Level 1 có peg nhưng bia không xoay.
- Hard Level 2 có peg, bumper, kicker tam giác và bia xoay chậm.
- Hard Level 3 có nhiều obstacle hơn Level 2 và bia xoay nhanh hơn.
- Bóng bật cực mạnh và lệch hướng khi chạm kicker nhưng không rung hoặc kẹt trong collider.
- Level 1 ghi điểm đúng với Red, Yellow, Blue.
- Level 2 đặt 2 bóng Primary vào hộp mix và tạo được Secondary.
- Level 3 dùng hộp mix tạo được Secondary rồi dùng Secondary + Primary tạo được Tertiary.
- Level 3 dùng White + màu bất kỳ trong công thức để tạo được Tint.
- Bia ở hàng dưới không bị chìm xuống lane và có thể bắn trúng.
- Bắn trúng bia thấp làm các bia phía trên cùng cột rơi xuống.
- Công thức sai trong hộp mix có âm thanh lỗi, khói và trả bóng về giá.
- Ném sai màu có khói, âm thanh lỗi và trừ thời gian trong Hard mode.
- Hoàn thành Level 3 hiện overlay chiến thắng.
- Trên kính VR, nút `Enter VR` xuất hiện khi chạy qua HTTPS.
- Sau `Enter VR`, chọn được Easy và Hard bằng cả tay trái lẫn tay phải.
- Panel VR hiển thị đúng level, mode, điểm, tiến độ, timer và trạng thái.
- Trigger của cả hai tay bấm được Next, Reset, đổi mode, Retry và Play Again.
- Controller VR nhặt, mix và ném bóng ổn định bằng cả hai tay.
- Mở system menu hoặc tháo/đeo lại headset không tạo cú ném ngoài ý muốn.

## Ghi Chú Khi Test VR

- WebXR thường yêu cầu HTTPS, trừ một số trường hợp localhost.
- Nếu không thấy nút `Enter VR`, kiểm tra trình duyệt và thiết bị có hỗ trợ WebXR không.
- Nếu âm thanh chưa phát, click/tương tác với trang trước vì trình duyệt chặn autoplay audio.
- Trong VR, trigger đầu tiên trên panel cũng dùng để mở khóa AudioContext.
- Nếu panel đang thu gọn, bấm `A` hoặc `X` để mở lại.
- Nếu camera desktop bị lệch, nhấn `F`.
- Nếu đang chọn nhầm bóng trên desktop, nhấn `Esc`.

## Hướng Phát Triển

- Thêm obstacle chuyển động và các pattern roulette thay đổi theo thời gian cho một mode thử thách riêng.
- Thêm bảng điểm tổng và lưu tiến trình bằng localStorage.
- Thêm hướng dẫn trong VR thay vì chỉ hiện trên HUD desktop.
- Thêm model/texture cho lane, bóng, target để tăng tính trực quan.
- Thêm chế độ luyện tập riêng cho công thức phối màu.
- Tối ưu thêm cho headset yếu: giảm draw call, giảm particle, gom material.

## Tác Giả Và Phạm Vi

Dự án phục vụ đồ án/demo học tập về Three.js, WebXR và tương tác VR cơ bản. Phạm vi hiện tại tập trung vào gameplay bowling học màu, chạy được trên desktop để test nhanh và trên kính VR hỗ trợ WebXR để demo.
