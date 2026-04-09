# SPEC — AI Product Hackathon

**Nhóm:** 30 (Phòng E403)
**Track:** ☐ VinFast · ☐ Vinmec · ☐ VinUni-VinSchool · ☐ XanhSM · ☒ Open
**Problem statement (1 câu):** *Nhân viên doanh nghiệp phải chờ đợi lâu khi hỏi HR/IT những câu hỏi lặp lại về chính sách, quy trình — hiện tại phải nhắn tin/gọi điện chờ HR trả lời thủ công — AI RAG Chatbot tự đọc Sổ tay công ty và trả lời ngay lập tức 24/7, giải phóng thời gian cho cả hai bên.*

**Thành viên:**
1. Trịnh Kế Tiến — 2A202600500
2. Mai Phi Hiếu — 2A202600126
3. Nguyễn Năng Anh — 2A202600184
4. Phạm Thanh Tùng — 2A202600268
5. Dương Phương Thảo — 2A202600049

**Ngày nộp:** 08/04/2026

---

## 1. AI Product Canvas

|   | Value | Trust | Feasibility |
|---|-------|-------|-------------|
| **Câu hỏi** | User nào? Pain gì? AI giải gì? | Khi AI sai thì sao? User sửa bằng cách nào? | Cost/latency bao nhiêu? Risk chính? |
| **Trả lời** | *Toàn bộ nhân viên công ty (đặc biệt nhân viên mới) mất 30+ phút/ngày chờ HR trả lời chính sách nghỉ phép, bảo hiểm, lương thưởng — AI đọc Sổ tay nhân viên (RAG) và trả lời tức thì <2s, giảm thời gian chờ từ 30 phút xuống còn 10 giây* | *AI trích dẫn sai chính sách lương/bảo hiểm → nhân viên hiểu nhầm → mâu thuẫn. User phát hiện sai bằng cách click vào Citation xem văn bản gốc. Sửa bằng nút "Escalate to HR" chuyển cho người thật xử lý + nút "Báo lỗi" gửi correction log.* | *~$0.001/query (GPT-4o-mini), latency <2s, risk chính: Hallucination chính sách nhạy cảm + Data leakage nếu không phân quyền truy cập tài liệu theo cấp bậc* |

**Automation hay augmentation?** ☐ Automation · ☒ Augmentation
Justify: *Augmentation — AI chỉ tra cứu và gợi ý câu trả lời kèm trích dẫn nguồn. User (nhân viên) tự đánh giá đúng/sai rồi quyết định hành động. Mọi quyết định cuối cùng (duyệt phép, ký giải ngân) luôn qua tay HR/Manager. Cost of reject = 0 vì nhân viên chỉ cần bấm "Hỏi HR thật" nếu không tin AI.*

**Learning signal:**

1. User correction đi vào đâu? *Khi user bấm "Báo lỗi" hoặc "Escalate to HR", hệ thống ghi log vào Correction Database kèm câu hỏi gốc + câu trả lời AI + lý do sai. Admin HR review và cập nhật/xóa file tài liệu cũ trong Vector DB.*
2. Product thu signal gì để biết tốt lên hay tệ đi? *Deflection Rate (tỷ lệ nhân viên hỏi AI xong không cần mở ticket hỏi HR nữa). Nếu Deflection Rate tăng từ 60% → 80% → AI đang tốt lên. Nếu giảm → cần kiểm tra data quality.*
3. Data thuộc loại nào? ☐ User-specific · ☒ Domain-specific · ☐ Real-time · ☐ Human-judgment · ☐ Khác: ___
   Có marginal value không? (Model đã biết cái này chưa?) *Có marginal value rất cao. ChatGPT/Gemini KHÔNG biết chính sách nghỉ phép riêng của công ty bạn vì đó là tài liệu nội bộ bảo mật. Mỗi bộ Sổ tay nhân viên là duy nhất (Moat) — chỉ có RAG cục bộ mới trả lời được.*

---

## 2. User Stories — 4 paths

Mỗi feature chính = 1 bảng. AI trả lời xong → chuyện gì xảy ra?

### Feature: *Tra cứu chính sách HR nội bộ*

**Trigger:** *Nhân viên gõ câu hỏi vào chatbot (VD: "Tôi được nghỉ phép mấy ngày?") → AI tìm kiếm trong Vector DB (ChromaDB) → trả kết quả kèm citation*

| Path | Câu hỏi thiết kế | Mô tả |
|------|-------------------|-------|
| Happy — AI đúng, tự tin | User thấy gì? Flow kết thúc ra sao? | *AI trả lời "Theo quy chế, bạn được nghỉ 12 ngày phép/năm" kèm citation [Trích: chinh-sach-nghi-phep.md]. User click citation → popup hiện văn bản gốc → xác nhận đúng → quay lại làm việc. Không cần hỏi HR.* |
| Low-confidence — AI không chắc | System báo "không chắc" bằng cách nào? User quyết thế nào? | *Câu hỏi phức tạp liên quan BHXH đặc thù. AI trả lời với disclaimer: "Thông tin này có thể chưa đầy đủ. Hệ thống đã mở [Ticket #102] gửi tới HR." User chờ HR xác nhận hoặc tự click vào citation kiểm tra.* |
| Failure — AI sai | User biết AI sai bằng cách nào? Recover ra sao? | *AI lấy nhầm chính sách 2022 thay vì 2026. User click citation → đọc văn bản gốc → phát hiện năm sai → bấm nút [Báo Lỗi]. Hệ thống bật cờ đỏ cảnh báo "Ngoài luồng" + tự động escalate lên HR.* |
| Correction — user sửa | User sửa bằng cách nào? Data đó đi vào đâu? | *User bấm "Báo lỗi" kèm ghi chú "File cũ năm 2022". HR admin nhận notification → vào dashboard xóa file PDF 2022 khỏi ChromaDB → upload file mới 2026 → Re-index. Lần sau AI trả lời đúng.* |

### Feature: *Xử lý câu hỏi ngoài phạm vi (Out-of-domain)*

**Trigger:** *Nhân viên hỏi câu không liên quan đến HR (VD: "Giá vàng hôm nay bao nhiêu?") → AI detect low relevance score từ Vector Search → kích hoạt Fallback Flow*

| Path | Câu hỏi thiết kế | Mô tả |
|------|-------------------|-------|
| Happy — AI đúng, tự tin | User thấy gì? Flow kết thúc ra sao? | *Không áp dụng — Câu hỏi ngoài phạm vi nên không có "đúng".* |
| Low-confidence — AI không chắc | System báo "không chắc" bằng cách nào? User quyết thế nào? | *Không áp dụng — Hệ thống detect ngay là out-of-domain, không cần đánh giá confidence.* |
| Failure — AI sai | User biết AI sai bằng cách nào? Recover ra sao? | *Nếu không có guardrail: AI bịa câu trả lời về giá vàng dựa trên training data cũ → User tin → thiệt hại. Với guardrail: Hệ thống bật UI viền đỏ "LỖI NGOÀI LUỒNG" → AI trung thực nói không có tài liệu.* |
| Correction — user sửa | User sửa bằng cách nào? Data đó đi vào đâu? | *Câu hỏi ngoài phạm vi được log vào "Unresolved Queries DB". HR admin review hàng tuần — nếu thấy pattern (VD: nhiều người hỏi về chế độ gym) → bổ sung tài liệu mới vào knowledge base.* |

---

## 3. Eval metrics + threshold

**Optimize precision hay recall?** ☒ Precision · ☐ Recall
Tại sao? *Khi AI trả lời chính sách công ty (lương, thưởng, phép) thì phải CHÍNH XÁC TUYỆT ĐỐI từng con số. Thà AI nói "Không tìm thấy quy chế này, vui lòng hỏi HR" (low recall — bỏ sót) để nhân viên tự hỏi HR, còn hơn AI tự tin nói "Thưởng Tết 3 tháng lương" trong khi thực tế chỉ 1 tháng (low precision — sai thông tin) gây nhân viên biểu tình.*
Nếu sai ngược lại thì chuyện gì xảy ra? *Nếu chọn Recall cao nhưng Precision thấp → AI trả lời linh tinh về chính sách tài chính nhạy cảm → nhân viên hành động sai dựa trên thông tin bịa → kiện tụng nội bộ, mất uy tín bộ phận HR.*

| Metric | Threshold | Red flag (dừng khi) |
|--------|-----------|---------------------|
| Accuracy trích dẫn đúng văn bản | ≥98% | <90% trong 1 tuần |
| Hallucination rate (AI bịa thông tin) | <1% | >3% trong 3 ngày liên tục |
| First-Contact Resolution Rate (hỏi 1 lần xong) | ≥80% | <60% — user liên tục phải escalate lên HR |
| User satisfaction (CSAT) | ≥4.5/5 | <3.5/5 — user ghét bot, bỏ dùng |
| Latency phản hồi | <2 giây | >5 giây — user mất kiên nhẫn |

---

## 4. Top 3 failure modes

*"Failure mode nào user KHÔNG BIẾT bị sai? Đó là cái nguy hiểm nhất."*

| # | Trigger | Hậu quả | Mitigation |
|---|---------|---------|------------|
| 1 | *AI lấy nhầm file chính sách cũ (2022) cho câu hỏi năm 2026 vì Vector DB chưa được cập nhật* | *Nhân viên tin AI, hành động theo chính sách cũ (số ngày phép sai, % bảo hiểm sai) → tranh chấp lao động. ĐÂY LÀ NGUY HIỂM NHẤT vì user không biết mình đang bị sai.* | *Bắt buộc Citation kèm mỗi câu trả lời → User click mở văn bản gốc kiểm chứng. Thêm: Mỗi file trong Vector DB phải có metadata "valid_until date" để auto-flag tài liệu hết hạn.* |
| 2 | *Nhân viên cấp thấp hỏi câu liên quan đến bảng lương giám đốc hoặc hợp đồng bảo mật C-Level* | *Data Leakage — rò rỉ thông tin lương/thưởng cấp cao ra toàn công ty → scandal nội bộ* | *Phân quyền truy cập RAG theo User Token. Query đi kèm Employee Level. Tài liệu C-Level bị gắn tag "Restricted" → chỉ query được nếu user là HR Manager trở lên.* |
| 3 | *Nhân viên bực mình vì chính sách bất công, chửi thề với AI → AI phản hồi không phù hợp hoặc bị jailbreak thao túng* | *AI nói bậy hoặc bị lừa tiết lộ system prompt → ảnh hưởng uy tín công ty* | *Guardrails chặn profanity + jailbreak detection. Nếu detect → trả lời mẫu lịch sự "Tôi hiểu bạn đang không hài lòng. Xin chuyển yêu cầu của bạn đến HR để hỗ trợ trực tiếp."* |

---

## 5. ROI 3 kịch bản

|   | Conservative | Realistic | Optimistic |
|---|-------------|-----------|------------|
| **Assumption** | *Công ty 500 người, 100 câu hỏi/ngày, 60% Deflection Rate* | *Công ty 1000 người, 300 câu hỏi/ngày, 80% Deflection Rate* | *Công ty 3000 người, 1000 câu hỏi/ngày, 90% Deflection Rate* |
| **Cost** | *$100 LLM API + $100 Server = $200/tháng* | *$300 API + $200 Server = $500/tháng* | *$1000 API + $300 Server = $1300/tháng* |
| **Benefit** | *Mỗi câu tốn HR 5 phút → tiết kiệm 250h/tháng ≈ 1.5 nhân sự = $1000/tháng* | *Tiết kiệm 750h/tháng ≈ 4.5 nhân sự = $3000/tháng* | *Tiết kiệm 2500h/tháng ≈ 15 nhân sự = $10,000/tháng* |
| **Net** | *+$800/tháng* | *+$2500/tháng* | *+$8700/tháng* |

**Kill criteria:** *Dừng dự án nếu: (1) Chi phí vận hành AI > lương thuê 1 nhân viên Helpdesk part-time trong 2 tháng liên tục, HOẶC (2) Deflection Rate < 40% sau 3 tháng triển khai (tức là nhân viên vẫn phải hỏi HR thay vì tin AI), HOẶC (3) Hallucination rate > 5% — AI bịa chính sách quá nhiều gây rủi ro pháp lý.*

---

## 6. Mini AI spec (1 trang)

**HR Copilot** là trợ lý Q&A nội bộ dành cho toàn bộ nhân viên trong doanh nghiệp, giải quyết vấn đề quá tải của bộ phận HR/IT khi phải trả lời hàng trăm câu hỏi lặp lại mỗi ngày về chính sách nghỉ phép, bảo hiểm, lương thưởng, và quy trình nội bộ.

**Augmentation, không phải Automation:** AI chỉ "tra cứu hộ" và gợi ý câu trả lời kèm trích dẫn tài liệu gốc. Nhân viên tự đánh giá và quyết định. Mọi quyết định phê duyệt (duyệt phép, ký giải ngân) vẫn luôn qua tay con người.

**Kỹ thuật cốt lõi — RAG cục bộ:** Sử dụng Retrieval-Augmented Generation (RAG) chạy trên ChromaDB Vector Store. Toàn bộ Sổ tay nhân viên, SOP, quy chế nội bộ được chunking, embedding và lưu trữ trên server riêng. LLM (GPT-4o-mini) chỉ sinh câu trả lời dựa trên context được truy xuất — KHÔNG trả lời từ training data chung, tuyệt đối không gửi dữ liệu nội bộ ra bên ngoài.

**Quality — Precision trên hết:** Vì đây là thông tin chính sách tài chính nhạy cảm, hệ thống ưu tiên Precision tuyệt đối. Thà nói "Không tìm thấy, vui lòng hỏi HR" còn hơn bịa con số sai. Mỗi câu trả lời bắt buộc kèm Citation (trích dẫn tài liệu gốc) — nhân viên click vào là xem được văn bản thật trên popup, kiểm chứng ngay lập tức.

**Risk chính và Mitigation:**
- **Hallucination:** Guardrail "LỖI NGOÀI LUỒNG" — khi câu hỏi ngoài phạm vi knowledge base, hệ thống bật cảnh báo đỏ thay vì bịa chuyện.
- **Data Leakage:** Phân quyền truy cập theo Employee Level — tài liệu C-Level chỉ HR Manager mới query được.
- **Stale Data:** Metadata "valid_until" trên mỗi file để auto-flag tài liệu hết hạn.

**Data Flywheel:** Mỗi khi nhân viên bấm "Báo lỗi" hoặc "Escalate to HR", hệ thống ghi log correction vào database. HR admin review hàng tuần, cập nhật/xóa file cũ trong Vector DB, upload file mới. Loop này liên tục cải thiện chất lượng knowledge base theo thời gian — càng nhiều nhân viên dùng, data càng sạch, AI càng chính xác.

**Stack công nghệ (MVP đã hoạt động):**
- Backend: Python FastAPI + LangChain + ChromaDB
- Frontend: Next.js 14 + TailwindCSS (Dark Mode, Citation Viewer Modal)
- LLM: OpenAI GPT-4o-mini (~$0.001/query, latency <2s)

## 7. Phân công nhiệm vụ (Chia Việc)

| Thành viên | Vai trò & Trách nhiệm chính trong dự án |
|-----------|------------------------------------------|
| **Trịnh Kế Tiến (Product Lead & Fullstack Dev)** | **(Thành viên chính)**. Đề xuất quy trình, thiết kế kiến trúc AI tổng thể, trực tiếp lập trình Core RAG Backend + Frontend Next.js MVP, tổng hợp và hoàn thiện toàn bộ bản SPEC. |
| **Mai Phi Hiếu (UX/Data Analyst)** | Thiết kế User Stories (4 paths), vạch ra kịch bản Xử lý ngoại luồng (Fallback), thu thập dữ liệu nội quy nhân sự làm Mock Data. |
| **Nguyễn Năng Anh (Business Analyst)** | Phụ trách tính toán bài toán đầu tư (ROI 3 kịch bản), rà soát hiệu quả biên (Marginal value) và vẽ UI Mockup tính năng Citation. |
| **Phạm Thanh Tùng (QA/Security)** | Đặc tả luồng đo lường chất lượng AI (Eval metrics), rà soát Top 3 Failure Modes và thiết lập phương án phòng chống Data Leakage. |
| **Dương Phương Thảo (Product Strategist)** | Đóng góp và tinh chỉnh khung AI Product Canvas (Value, Trust, Feasibility), xây dựng quy trình Learning Signal cho Feedback Loop. |

---
*SPEC Final — Nhóm 30 · Phòng E403 — Day 5 Hackathon AI Thực Chiến · VinUni 2026*
