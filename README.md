# 📡 خريطة تغطية شبكات اليمن

تطبيق ويب يفتح خريطة موقعك الحالي ويعرض عليها **أبراج شبكات الاتصالات اليمنية** (يمن موبايل، يو، سبأفون، واي) مع **نسبة تغطية كل تقنية 2G / 3G / 4G / 5G** بالنسبة المئوية.

مبني بـ **React + TypeScript + Vite + Tailwind CSS + Leaflet**.

## ✨ المميزات

- 📍 تحديد موقعك تلقائياً (GPS) وفتح الخريطة عليه.
- 🗼 عرض أبراج كل الشبكات بألوان مميزة لكل مشغل:
  | المشغل | MNC |
  |---|---|
  | سبأفون SabaFon | 421-01 |
  | يو YOU (MTN سابقاً) | 421-02 |
  | يمن موبايل Yemen Mobile | 421-03 |
  | واي Y Telecom | 421-04 |
- 📶 نسبة تغطية كل تقنية (5G / 4G / 3G / 2G) لكل شبكة مع تقدير قوة الإشارة بـ dBm.
- 👆 اضغط على أي نقطة في الخريطة لتحليل التغطية فيها.
- 🔵 دوائر نطاق التغطية لكل تقنية.
- 🛰️ خرائط: شوارع / فاتح / قمر صناعي.
- 📱 واجهة عربية متجاوبة مع الجوال.
- 📊 عرض معلومات اتصال جهازك الحالي (نوع الشبكة والسرعة).
- 🏙️ الموقع الافتراضي: **تعز** (يفتح عليها عند عدم توفر GPS، وزر «تعز» للرجوع إليها).
- 📴 يعمل بدون إنترنت (انظر الأسفل).
- 🤖 تطبيق أندرويد (APK) عبر Capacitor.

## 🗂️ مصادر البيانات

1. **بيانات تقديرية** (افتراضي): أبراج مولدة بنموذج حتمي لتجربة التطبيق — **ليست مواقع حقيقية**.
2. **OpenCellID API**: مواقع الأبراج الحقيقية من قاعدة البيانات المفتوحة [OpenCellID](https://opencellid.org). سجّل للحصول على مفتاح مجاني ثم أدخله من زر «مصدر البيانات».
3. **ملف OpenCellID**: نزّل ملف اليمن `421.csv.gz` من [صفحة التنزيلات](https://opencellid.org/downloads.php) وارفعه داخل التطبيق (يعمل محلياً بدون إرسال بيانات).

> ⚠️ النسب المئوية **تقديرية** محسوبة بنموذج انتشار إشارة حسب المسافة من الأبراج ونطاق كل تقنية، وليست قياساً ميدانياً. تقنية 5G غير متاحة تجارياً بشكل واسع في اليمن حالياً.

## 🚀 التشغيل محلياً

```bash
npm install
npm run dev
```

لتعيين مفتاح OpenCellID افتراضياً انسخ `.env.example` إلى `.env`:

```bash
VITE_OPENCELLID_KEY=pk.xxxxxxxxxxxxxxxx
```

> تنبيه: أي مفتاح يوضع في `.env` سيظهر في ملفات الموقع المنشور. الأفضل إدخاله من واجهة التطبيق (يُحفظ في متصفحك فقط).

## 🤖 بناء ملف APK (أندرويد)

### الطريقة 1: تلقائياً عبر GitHub Actions (بدون تثبيت أي شيء)
عند كل `push` يبني ملف `.github/workflows/android.yml` ملف APK:
- من تبويب **Actions** ← آخر تشغيل لـ «Build Android APK» ← **Artifacts** ← `shabka-apk-N` (ملف zip بداخله `shabka.apk`).
- عند الدفع إلى `main` يُنشر أيضاً كإصدار في **Releases**، ورابط آخر نسخة مباشرة:
  `https://github.com/MokhtarAlkmaly/Shabka/releases/latest/download/shabka.apk`

ثبّت الملف على الجوال بعد تفعيل «السماح بالتثبيت من مصادر غير معروفة».

### الطريقة 2: محلياً
يتطلب Node 22+، و JDK 21، و Android SDK (أو Android Studio):

```bash
npm install
npm run android:apk      # الناتج: android/app/build/outputs/apk/debug/app-debug.apk
# أو افتح المشروع في Android Studio:
npm run cap:sync && npm run android:open
```

### نسخة release موقّعة (اختياري)
أضف في إعدادات المستودع (Settings → Secrets → Actions):
`ANDROID_KEYSTORE_BASE64`، `ANDROID_KEYSTORE_PASSWORD`، `ANDROID_KEY_ALIAS`، `ANDROID_KEY_PASSWORD`
وسيبني الـ workflow ملف `shabka-release.apk` أيضاً.

## 📴 العمل بدون إنترنت

| الميزة | بدون إنترنت؟ |
|---|---|
| واجهة التطبيق والخطوط | ✅ مضمّنة داخل التطبيق |
| تحديد الموقع GPS | ✅ (أبطأ قليلاً في أول تحديد) |
| البيانات التقديرية وحساب نسب التغطية | ✅ |
| ملف OpenCellID `421.csv.gz` | ✅ يُحفظ في الجهاز بعد رفعه مرة واحدة |
| الخريطة (الشوارع/القمر الصناعي) | ⚠️ تظهر فقط المناطق التي تصفحتها سابقاً وأنت متصل (تُحفظ تلقائياً حتى ~8000 بلاطة) |
| OpenCellID API المباشر | ❌ يحتاج إنترنت |

نصيحة: افتح التطبيق وأنت متصل، وتصفّح تعز (والمناطق التي تهمك) بمستويات التكبير التي تحتاجها، وارفع ملف `421.csv.gz` — بعدها يعمل كل شيء بدون إنترنت.

## 🌐 النشر على GitHub Pages

```bash
git init
git add .
git commit -m "Yemen network coverage map"
git branch -M main
git remote add origin https://github.com/USERNAME/yemen-coverage-map.git
git push -u origin main
```

ثم من إعدادات المستودع: **Settings → Pages → Source: GitHub Actions**.
سيقوم ملف `.github/workflows/deploy.yml` بالبناء والنشر تلقائياً عند كل `push`.

> تحديد الموقع (GPS) يتطلب HTTPS — وهو متوفر تلقائياً في GitHub Pages.

## 📁 هيكل المشروع

```
android/                     # مشروع أندرويد (Capacitor)
capacitor.config.ts
src/
├── App.tsx                  # الواجهة الرئيسية
├── components/
│   ├── MapView.tsx          # الخريطة والأبراج (Leaflet)
│   ├── CoveragePanel.tsx    # بطاقات نسب التغطية
│   └── SettingsModal.tsx    # اختيار مصدر البيانات
├── data/operators.ts        # المشغلون والتقنيات والموقع الافتراضي (تعز)
├── hooks/useConnection.ts   # معلومات اتصال الجهاز
└── lib/
    ├── coverage.ts          # حساب نسب التغطية
    ├── towers.ts            # مصادر بيانات الأبراج
    ├── tileCache.ts         # حفظ بلاطات الخريطة للعمل بدون إنترنت
    ├── store.ts             # تخزين IndexedDB (ملف الأبراج)
    └── geo.ts               # دوال جغرافية
```

## 📄 الترخيص

MIT — بيانات الأبراج من OpenCellID مرخصة بـ CC BY-SA 4.0.
