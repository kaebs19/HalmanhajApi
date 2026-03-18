# Exercises API — iOS Developer Guide
# التمارين فقط (تحتاج تسجيل دخول)

> Base URL: `https://halmanhaj.khalafiati.io/api`
> (سيتغير لـ `https://www.halmanhaj.com/api` بعد نقل الدومين)

## مهم جداً
- التمارين تحتاج **تسجيل دخول** — التوكن مطلوب في كل الطلبات
- Header: `Authorization: Bearer <JWT_TOKEN>`
- كل الـ IDs هي **UUID** (مثال: `"c4322ad9-f9b0-408e-8036-7a19edc37bd9"`) — **ليست integer**
- التمارين تُعرض **حسب صف المستخدم** مباشرة — بدون تصفح مراحل
- التصميم المطلوب: **Duolingo-style** (مراحل/مستويات متتالية)

---

## تدفق التطبيق (Logged-in)

```
1. GET /exercises/student/list?grade_id={user.grade_id}     ← قائمة التمارين حسب صف الطالب
2. GET /exercises/:id                                        ← جلب التمرين + الأسئلة
3. POST /exercises/:id/answer                                ← إرسال إجابة (يحفظ + XP)
4. GET /exercises/:id/progress/:userId                       ← تقدم الطالب
5. GET /exercises/skips/today                                 ← التخطيات المتبقية
```

---

## 1. قائمة التمارين

### GET `/exercises/student/list`
يرجع كل التمارين المنشورة مع تقدم الطالب. **فلتر حسب صف المستخدم.**

**Query Params (اختياري):**
| Param | Type | وصف |
|-------|------|------|
| `grade_id` | UUID | صف المستخدم (من `/me` → `user.grade_id`) |
| `subject_id` | UUID | فلتر حسب المادة |
| `difficulty` | string | `easy` / `medium` / `hard` |
| `type` | string | نوع التمرين (مثل `mcq`, `ordering`) |

**Request:**
```
GET /exercises/student/list?grade_id=abc-123-uuid
Authorization: Bearer eyJhbGciOi...
```

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "تمرين الجمع",
    "type": "mcq",
    "difficulty": "easy",
    "xp_reward": 10,
    "time_limit": null,
    "questions_count": 18,
    "subject_name": "الرياضيات",
    "subject_icon": "🔢",
    "stage_name": "المرحلة الابتدائية",
    "grade_name": "الصف الأول",
    "solved_count": 5,
    "attempted_count": 8
  }
]
```

**حقول التقدم:**
- `solved_count`: عدد الأسئلة اللي أجاب عليها صح
- `attempted_count`: عدد الأسئلة اللي حاول يجيب عليها
- `questions_count`: إجمالي الأسئلة
- **نسبة الإنجاز** = `solved_count / questions_count * 100`

---

## 2. جلب تمرين واحد

### GET `/exercises/:id`
يرجع التمرين مع كل أسئلته (بدون الإجابات الصحيحة).

**Request:**
```
GET /exercises/c4322ad9-f9b0-408e-8036-7a19edc37bd9
Authorization: Bearer eyJhbGciOi...
```

**Response:**
```json
{
  "id": "uuid",
  "title": "تمرين الجمع",
  "description": "تمرين على عمليات الجمع البسيطة",
  "type": "mcq",
  "difficulty": "easy",
  "xp_reward": 10,
  "time_limit": null,
  "is_published": true,
  "questions": [
    {
      "id": "uuid",
      "question_text": "وَقَفَتْ عَلَى الْوَرْدَةِ 🌸 ثَلَاثُ نَحْلَاتٍ 🐝، طَارَتْ وَاحِدَةٌ، كَمْ نَحْلَةً بَقِيَتْ؟",
      "question_image": null,
      "question_data": {
        "options": ["4", "2", "3", "1"]
      },
      "order_index": 2
    }
  ],
  "lesson_title": "درس الجمع",
  "subject_name": "الرياضيات",
  "stage_name": "المرحلة الابتدائية",
  "grade_name": "الصف الأول"
}
```

---

## 3. إرسال إجابة

### POST `/exercises/:id/answer`
يحفظ الإجابة + يمنح XP عند أول إجابة صحيحة.

**Request:**
```json
POST /exercises/c4322ad9-uuid/answer
Authorization: Bearer eyJhbGciOi...

{
  "question_id": "uuid-السؤال",
  "answer": 0
}
```

**Response (إجابة صحيحة — أول مرة):**
```json
{
  "correct": true,
  "xp_gained": 10,
  "attempts": 1
}
```

**Response (إجابة خاطئة):**
```json
{
  "correct": false,
  "xp_gained": 0,
  "attempts": 1,
  "correct_answer": { "index": 0 }
}
```

**Response (إجابة صحيحة — ليست أول مرة):**
```json
{
  "correct": true,
  "xp_gained": 0,
  "attempts": 3
}
```

### قواعد XP:
- XP يُمنح **فقط عند أول إجابة صحيحة**
- إذا سبق وأجاب صح → `xp_gained: 0`
- المقدار: حقل `xp_reward` في التمرين (افتراضي **10 XP**)
- لا يتغير حسب الصعوبة

---

## 4. تقدم الطالب

### GET `/exercises/:id/progress/:userId`

**Request:**
```
GET /exercises/uuid-التمرين/progress/uuid-المستخدم
Authorization: Bearer eyJhbGciOi...
```

**Response:**
```json
[
  {
    "question_id": "uuid",
    "is_correct": true,
    "attempts": 2,
    "completed_at": "2026-03-17T10:30:00Z"
  },
  {
    "question_id": "uuid",
    "is_correct": false,
    "attempts": 1,
    "completed_at": null
  }
]
```

- `completed_at = null` → لم يُجب صح بعد
- `is_correct = true` + `completed_at` → أجاب صح

---

## 5. نظام التخطي (Skips)

### GET `/exercises/skips/today`
التخطيات المتبقية اليوم.

```json
{
  "skips_remaining": 3,
  "skips_from_ads": 0
}
```

**المعادلة:** `skips_remaining = max(0, 3 - skips_used + skips_from_ads)`
- 3 تخطيات أساسية يومياً
- تتجدد كل يوم
- إعلانات تضيف تخطيات غير محدودة

### POST `/exercises/skips/use`
استخدام تخطي واحد.
```json
{ "success": true, "skips_remaining": 2 }
```

### POST `/exercises/skips/add-from-ad`
إضافة تخطي من مشاهدة إعلان.
```json
{ "success": true, "skips_remaining": 4 }
```

---

## 6. أنواع التمارين الـ 13

لكل نوع: شكل البيانات + الإجابة المرسلة + طريقة المقارنة.

---

### `true_false` — صح/خطأ
```
question_data: {}
answer المرسل: true أو false                    ← boolean
correct_answer: { "value": true }
المقارنة: answer === correct_answer.value
```
**مثال Request:** `{ "question_id": "uuid", "answer": true }`

---

### `mcq` — اختيار من متعدد
```
question_data: { "options": ["4", "2", "3", "1"] }
answer المرسل: 0                                 ← number (index يبدأ من 0)
correct_answer: { "index": 0 }
المقارنة: Number(answer) === Number(correct_answer.index)
```
**مثال Request:** `{ "question_id": "uuid", "answer": 0 }`

---

### `speed` — سرعة (مثل mcq لكن بوقت)
```
question_data: { "options": ["خيار1", "خيار2", "خيار3"] }
answer المرسل: 1                                 ← number (index)
correct_answer: { "index": 1 }
المقارنة: نفس mcq
```

---

### `fill_blank` — ملء الفراغ
```
question_data: {}
answer المرسل: "النص"                            ← string
correct_answer: { "value": "الإجابة" }
  أو: { "values": ["إجابة1", "إجابة2"] }        ← عدة إجابات مقبولة
المقارنة: trim + lowercase ثم مطابقة
```
**مثال Request:** `{ "question_id": "uuid", "answer": "القمر" }`

---

### `read_answer` — اقرأ وأجب
```
question_data: {}
answer المرسل: "النص"                            ← string
correct_answer: { "value": "الإجابة" }
المقارنة: trim + lowercase
```

---

### `matching` — توصيل
```
question_data: {
  "pairs": [
    {"left": "🏠", "right": "بيت"},
    {"left": "🚪", "right": "باب"},
    {"left": "🍋", "right": "ليمون"}
  ]
}
answer المرسل: [                                 ← array of objects
  {"left": "🏠", "right": "بيت"},
  {"left": "🚪", "right": "باب"},
  {"left": "🍋", "right": "ليمون"}
]
correct_answer: { "pairs": [...] }
المقارنة: ترتيب الأزواج لا يهم — المهم كل زوج (left, right) صحيح
```

---

### `image_match` — توصيل بالصور
```
question_data: {
  "pairs": [{"left": "/uploads/img1.webp", "right": "نص"}]
}
answer المرسل: [{"left": "url", "right": "نص"}]  ← مثل matching
المقارنة: مثل matching
```

---

### `ordering` — ترتيب
```
question_data: {
  "items": ["ثالث", "أول", "ثاني"]              ← مخلوطة
}
answer المرسل: ["أول", "ثاني", "ثالث"]           ← array بالترتيب الصحيح
correct_answer: { "items": ["أول", "ثاني", "ثالث"] }
المقارنة: الترتيب مهم — كل عنصر يطابق مكانه بالضبط
```

---

### `classify` — تصنيف
```
question_data: {
  "categories": ["فواكه", "خضروات"],
  "items": ["تفاح", "جزر", "موز", "بصل"]
}
answer المرسل: {                                 ← object
  "فواكه": ["تفاح", "موز"],
  "خضروات": ["جزر", "بصل"]
}
correct_answer: { "groups": {"فواكه": ["تفاح", "موز"], "خضروات": ["جزر", "بصل"]} }
المقارنة: ترتيب العناصر داخل كل فئة لا يهم
```

---

### `word_build` — بناء كلمة
```
question_data: {
  "build_type": "word",
  "tiles": ["ب", "ت", "ا", "ك"],
  "hint": "📚",
  "display_hint": true
}
answer المرسل: "كتاب"                            ← string (الكلمة المبنية)
correct_answer: { "answer": "كِتَابٌ" }
المقارنة: تُزال التشكيلات من الطرفين ثم تُقارن
```

---

### `letter_pos` — موقع الحرف
```
question_data: {
  "letter": "ب",
  "word": "كتاب",
  "word_with_blank": "كتا_",
  "options": ["بـ", "ـبـ", "ـب", "ب"]
}
answer المرسل: "ـب"                              ← string (شكل الحرف المختار)
correct_answer: { "form": "ـب", "position": "final" }
المقارنة: trim ثم مطابقة حرفية مع correct_answer.form
```

---

### `numeric_input` — إدخال رقم
```
question_data: { "hint": "اكتب الناتج" }
answer المرسل: "42"                              ← string
correct_answer: { "value": "42" }
المقارنة: parseFloat(answer) === parseFloat(correct_answer.value)
```

---

### `text_input` — إدخال نص
```
question_data: { "hint": "اكتب الكلمة" }
answer المرسل: "مدرسة"                           ← string
correct_answer: {
  "value": "مَدْرَسَةٌ",
  "variants": ["مدرسه"]
}
المقارنة: تُزال التشكيلات ثم يُقارن مع value + كل عنصر في variants
```

---

## 7. Swift — مثال التدفق الكامل

```swift
// ============================================
// 1. جلب التمارين حسب صف الطالب
// ============================================
let exercises = try await api.get(
    "/exercises/student/list?grade_id=\(user.gradeId)",
    headers: ["Authorization": "Bearer \(token)"]
)
// عرض التمارين كمراحل Duolingo-style
// solved_count / questions_count = نسبة الإنجاز لكل تمرين

// ============================================
// 2. فتح تمرين
// ============================================
let exercise = try await api.get(
    "/exercises/\(exerciseId)",
    headers: ["Authorization": "Bearer \(token)"]
)
// exercise.questions = array الأسئلة
// exercise.type = نوع التمرين (يحدد شكل الواجهة)

// ============================================
// 3. إرسال إجابة
// ============================================
let result = try await api.post(
    "/exercises/\(exerciseId)/answer",
    headers: ["Authorization": "Bearer \(token)"],
    body: [
        "question_id": questionId,
        "answer": selectedAnswer  // حسب نوع التمرين
    ]
)

if result.correct {
    // إجابة صحيحة
    if result.xpGained > 0 {
        showXPAnimation(xp: result.xpGained)  // +10 XP
    }
    moveToNextQuestion()
} else {
    // إجابة خاطئة
    loseHeart()  // ❤️ → 💔 (client-side)
    showCorrectAnswer(result.correctAnswer)

    if heartsRemaining == 0 {
        showRetryOrWatchAd()
    }
}

// ============================================
// 4. نظام التخطي
// ============================================
// جلب المتبقي
let skips = try await api.get(
    "/exercises/skips/today",
    headers: ["Authorization": "Bearer \(token)"]
)
// skips.skips_remaining = 3 (افتراضي)

// استخدام تخطي
try await api.post(
    "/exercises/skips/use",
    headers: ["Authorization": "Bearer \(token)"]
)

// تخطي من إعلان (بعد مشاهدة rewarded ad)
try await api.post(
    "/exercises/skips/add-from-ad",
    headers: ["Authorization": "Bearer \(token)"]
)
```

---

## 8. البلاغ عن سؤال

### POST `/exercises/questions/:questionId/report`
يتيح للطالب الإبلاغ عن خطأ في سؤال.

**Request:**
```json
POST /exercises/questions/uuid-السؤال/report
Authorization: Bearer eyJhbGciOi...

{
  "reason": "wrong_answer",
  "details": "الإجابة الصحيحة غلط"
}
```

**الأسباب المقبولة:**
| reason | الوصف |
|--------|-------|
| `wrong_answer` | الإجابة الصحيحة خاطئة |
| `spelling_error` | خطأ إملائي |
| `unclear` | السؤال غير واضح |
| `other` | سبب آخر |

**Response:**
```json
{ "success": true }
```

---

## 9. ملاحظات تصميمية (Duolingo-style)

### عرض التمارين كمسار
- جلب التمارين: `GET /exercises/student/list?grade_id={grade_id}`
- جمّع حسب `subject_name` (كل مادة = قسم)
- اعرض التمارين كدوائر/أيقونات متتالية عمودياً (مثل Duolingo)
- كل تمرين = مرحلة (node)
- لون الدائرة حسب التقدم:
  - رمادي = لم يبدأ (`solved_count == 0`)
  - أصفر/برتقالي = قيد الحل (`solved_count > 0 && solved_count < questions_count`)
  - أخضر = مكتمل (`solved_count == questions_count`)

### القلوب (Lives) — Client-side
- 3 قلوب لكل جلسة تمرين
- كل إجابة خاطئة = خسارة قلب
- عند نفاد القلوب -> إعادة التمرين أو مشاهدة إعلان
- **السيرفر لا يتتبع القلوب** — هذا منطق العميل بالكامل

### شريط التقدم
- `السؤال الحالي / إجمالي الأسئلة`
- مثال الويب: `2/18` مع شريط تقدم أخضر

### ألوان خيارات MCQ (مرجع من الويب)
- A = أزرق فاتح, B = بنفسجي, C = برتقالي, D = أخضر
- تصميم فقط — السيرفر يرسل الخيارات كـ array

### التشكيلات العربية
- النصوص بالتشكيل الكامل (فتحة، ضمة، كسرة، سكون)
- استخدم خط عربي يدعم التشكيل (مثل **Noto Naskh Arabic**)
- عند مقارنة إجابات `text_input` و `word_build`: السيرفر يزيل التشكيلات تلقائياً

### الإيموجي في الأسئلة
- الأسئلة تحتوي إيموجي حقيقية (مثل وردة، نحلة، تفاحة، بيت، قطة، شجرة)
- تأكد من عرضها صح في `UILabel` / `UITextView`

---

## 10. الأخطاء الشائعة

| الخطأ | السبب | الحل |
|-------|-------|------|
| `22P02 invalid input syntax for type uuid` | إرسال integer بدل UUID | كل الـ IDs هي UUID format |
| `401 Unauthorized` | التوكن مفقود أو منتهي | أرسل `Authorization: Bearer <token>` |
| `404 التمرين غير موجود` | التمرين غير منشور أو ID خاطئ | تأكد أن `is_published = true` |
| `400 معرف السؤال والإجابة مطلوبة` | `question_id` أو `answer` ناقص | كلا الحقلين مطلوبة في body |

---

## 11. ملخص سريع للـ Endpoints

| Method | Path | Auth | الوصف |
|--------|------|------|-------|
| GET | `/exercises/student/list` | Bearer | قائمة التمارين + تقدم |
| GET | `/exercises/:id` | Bearer | تمرين + أسئلة (بدون إجابات) |
| POST | `/exercises/:id/answer` | Bearer | إرسال إجابة |
| GET | `/exercises/:id/progress/:userId` | Bearer | تقدم الطالب بتمرين |
| GET | `/exercises/skips/today` | Bearer | تخطيات متبقية |
| POST | `/exercises/skips/use` | Bearer | استخدام تخطي |
| POST | `/exercises/skips/add-from-ad` | Bearer | تخطي من إعلان |
| POST | `/exercises/questions/:id/report` | Bearer | بلاغ عن سؤال |
