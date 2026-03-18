# تحسينات واجهة التمارين — iOS

## تحديث API (تم تطبيقه)

حقل جديد `type_icon` يُرجع إيموجي افتراضي حسب نوع التمرين:

```json
{
  "id": "uuid",
  "title": "تمرين الجمع",
  "type": "mcq",
  "type_icon": "📝",    // ← جديد
  "subject_icon": "🔢",
  ...
}
```

### جدول الإيموجي حسب النوع

| النوع | type_icon | الوصف |
|-------|-----------|-------|
| `mcq` | 📝 | اختيار من متعدد |
| `true_false` | ✅ | صح / خطأ |
| `fill_blank` | ✏️ | ملء الفراغ |
| `matching` | 🔗 | توصيل |
| `ordering` | 🔢 | ترتيب |
| `classify` | 📂 | تصنيف |
| `image_match` | 🖼️ | توصيل بالصور |
| `speed` | ⚡ | سرعة |
| `read_answer` | 📖 | اقرأ وأجب |
| `word_build` | 🧩 | بناء كلمة |
| `letter_pos` | 🔤 | موقع الحرف |
| `numeric_input` | 🔟 | إدخال رقم |
| `text_input` | 💬 | إدخال نص |

**استخدام:** اعرض `type_icon` داخل الدائرة بدل أيقونات SF Symbols الرمادية.

---

## تحسينات التصميم

### 1. أيقونات الدوائر
**الحالي:** أيقونات SF Symbols رمادية (كيبورد، #، AI، Abc)
**المطلوب:** استخدم `type_icon` من API — إيموجي ملونة داخل الدائرة

```swift
// بدل:
Image(systemName: "keyboard")
// استخدم:
Text(exercise.typeIcon) // "📝" أو "🔢" أو "⚡"
    .font(.system(size: 32))
```

---

### 2. ألوان الدوائر حسب التقدم
**الحالي:** كل الدوائر رمادية
**المطلوب:**

```swift
func circleColor(for exercise: Exercise) -> Color {
    let progress = exercise.questionsCount > 0
        ? Double(exercise.solvedCount) / Double(exercise.questionsCount)
        : 0

    if progress == 0 { return .gray }         // لم يبدأ
    if progress < 1.0 { return .orange }      // قيد الحل
    return .green                              // مكتمل
}
```

مع شريط تقدم دائري حول الأيقونة:
```swift
Circle()
    .trim(from: 0, to: progress)
    .stroke(circleColor, lineWidth: 4)
    .rotationEffect(.degrees(-90))
```

---

### 3. العناوين بالعربي
**الحالي:** "Units 4 & 5: We C..." (مقطوع وبالانجليزي)
**المطلوب:** استخدم حقل `title` من API
- إذا طويل: اعرض أول 25 حرف + "..."
- أو اعرض العنوان تحت الدائرة بخط صغير (12pt)

---

### 4. أيقونة المادة بجانب الاسم
**الحالي:** "لغة انجليزية" (نص فقط)
**المطلوب:** `subject_icon` + اسم المادة

```swift
HStack {
    Text(subject.icon) // "📐" أو "📚"
    Text(subject.name)
        .font(.headline)
}
```

---

### 5. عدد التمارين المكتملة
**الحالي:** "9 تمرين" (العدد الإجمالي فقط)
**المطلوب:** "3/9 مكتمل" مع شريط تقدم صغير

```swift
let completed = exercises.filter { $0.solvedCount == $0.questionsCount }.count
Text("\(completed)/\(exercises.count) مكتمل")
    .font(.caption)
    .foregroundColor(.secondary)
```

---

### 6. تنويع حجم الدوائر
**الاقتراح:** آخر تمرين في كل مادة = "Boss Level"
- حجم أكبر (1.3x)
- إطار مزدوج أو ذهبي
- أيقونة مختلفة (مثل نجمة)

```swift
let isLastInSubject = (index == subjectExercises.count - 1)
let circleSize: CGFloat = isLastInSubject ? 80 : 60
```

---

### 7. نظام القفل (اختياري)
**الاقتراح:** التمرين التالي يُفتح فقط بعد إكمال السابق

```swift
let isLocked = index > 0 && exercises[index - 1].solvedCount < exercises[index - 1].questionsCount

if isLocked {
    // دائرة رمادية + أيقونة قفل
    Image(systemName: "lock.fill")
        .foregroundColor(.gray)
}
```

**ملاحظة:** هذا منطق client-side فقط — السيرفر يسمح بالوصول لأي تمرين.

---

### 8. تأثيرات بصرية
- **اهتزاز خفيف** عند الإجابة الخاطئة
- **تأثير نجوم/confetti** عند إكمال تمرين
- **+10 XP animation** عند أول إجابة صحيحة
- **صوت** مختلف للإجابة الصحيحة والخاطئة

---

### 9. شاشة النتيجة بعد التمرين
بعد إكمال كل أسئلة التمرين، اعرض:
- عدد الإجابات الصحيحة / الإجمالي
- XP المكتسب
- الوقت المستغرق
- زر "التمرين التالي" أو "إعادة"

```
   ╭────────────────────╮
   │     ⭐ ممتاز!      │
   │                    │
   │   15/18 صحيحة     │
   │   +10 XP          │
   │   ⏱️ 3:45          │
   │                    │
   │  [التمرين التالي]  │
   │  [إعادة التمرين]   │
   ╰────────────────────╯
```

---

### 10. تجميع حسب المادة مع تبديل
**الحالي:** كل التمارين في قائمة واحدة تحت "لغة انجليزية"
**المطلوب:** tabs أو segments للتبديل بين المواد

```swift
// جمّع التمارين حسب subject_name
let grouped = Dictionary(grouping: exercises, by: { $0.subjectName })

// اعرض كـ ScrollView أفقي أو Picker
Picker("المادة", selection: $selectedSubject) {
    ForEach(grouped.keys.sorted(), id: \.self) { subject in
        Text(subject).tag(subject)
    }
}
```
