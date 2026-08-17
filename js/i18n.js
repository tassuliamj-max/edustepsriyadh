// i18n.js — نظام تبديل اللغة (عربي / إنجليزي) لكامل الموقع (الصفحة الرئيسية + النظام المحاسبي)
// ------------------------------------------------------------------------------------------------
// الفكرة: بدل إعادة كتابة كل دالة عرض في app.js لاستدعاء دالة ترجمة، نترجم الصفحة "بعد" ظهورها —
// نمشي على كل عُقد النص الظاهرة في الصفحة (DOM text nodes) ونستبدل أي عبارة عربية معروفة في قاموس
// الترجمة بمقابلها الإنجليزي، ثم نراقب أي تغييرات مستقبلية في الصفحة (عبر MutationObserver) ونترجمها
// فور ظهورها تلقائيًا. هذا يعني أن التبديل يعمل على الصفحة الرئيسية وشاشة الدخول ولوحة التحكم بكل
// تبويباتها ونوافذها المنبثقة وإيصالات الطباعة، دون الحاجة لتعديل كل سطر عرض داخل app.js.
// التبديل رجعي بالكامل: نفس القاموس يُستخدم بالاتجاهين (عربي إنجليزي) و(إنجليزي عربي).
(function (global) {
  'use strict';

  var STORAGE_KEY = 'acc_lang';

  // ================= قاموس الترجمة (عربي -> إنجليزي) =================
  // المفتاح هو النص العربي كما يظهر فعليًا في الصفحة؛ القيمة هي المقابل الإنجليزي.
  var DICT = {};

  function addAll(obj) { for (var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) DICT[k] = obj[k]; } }

  // ---- هوية المدرسة (تُستبدل تلقائيًا لكل موقع عبر متغير BRAND أدناه) ----
  addAll({
    'إديو ستبس - الرياض': 'Edusteps Riyadh',
    'Cute Kids — كيوت كيدز إنترناشونال': 'Edusteps Riyadh',
    'إديو ستبس - الرياض. جميع الحقوق محفوظة.': 'Edusteps Riyadh. All rights reserved.',
    'النظام المحاسبي المدرسي | إديو ستبس - الرياض': 'School Accounting System | Edusteps Riyadh',
    'النظام المحاسبي | إديو ستبس - الرياض': 'Accounting System | Edusteps Riyadh',
    'المملكة العربية السعودية': 'Kingdom of Saudi Arabia',
  });

  // ---- الصفحة الرئيسية: الهيدر والتنقل ----
  addAll({
    'تخطي إلى المحتوى': 'Skip to content',
    'الصفحة الرئيسية': 'Home',
    'أساسيات المحاسبة': 'Accounting Basics',
    'الدورة المحاسبية': 'The Accounting Cycle',
    'دليل الحسابات': 'Chart of Accounts',
    'مزايا النظام': 'System Features',
    'دخول المحاسب': 'Accountant Login',
    'دخول المحاسب / فتح النظام': 'Accountant Login / Open System',
    'افتح النظام': 'Open System',
    'افتح النظام المحاسبي': 'Open Accounting System',
    'افتح النظام المحاسبي وابدأ بتسجيل أول سند الآن': 'Open the accounting system and record your first voucher now',
    'القائمة': 'Menu',
  });

  // ---- الهيرو ----
  addAll({
    '📊 نظام محاسبي مدرسي كامل + شرح مبسّط للأساسيات': '📊 A complete school accounting system + a simplified guide to the basics',
    'محاسبة مدرستك': 'Your school’s accounting,',
    'واضحة، ملوّنة، ومتوازنة': 'clear, colorful, and balanced',
    'دائمًا': 'always',
    'سجّل رسوم الطلاب ومصروفات المدرسة عبر سندات بسيطة، ودع النظام يولّد القيود اليومية ودفتر الأستاذ وميزان المراجعة والقوائم المالية تلقائيًا — مبني على أساسيات المحاسبة الحقيقية.':
      'Record student fees and school expenses with simple vouchers, and let the system automatically generate journal entries, the ledger, the trial balance, and financial statements — built on real accounting fundamentals.',
    'تعلّم أساسيات المحاسبة': 'Learn Accounting Basics',
    'حسابات جاهزة': 'ready accounts',
    'قيد مزدوج متوازن': 'balanced double entry',
    'ريال يحتاج Excel': 'riyals need Excel',
    'تقارير مالية جاهزة': 'ready financial reports',
    'مثال حي: سند قبض رسوم دراسية': 'Live example: a tuition fee receipt voucher',
    'القيد الناتج تلقائيًا (المعادلة دائمًا متوازنة)': 'The resulting entry, generated automatically (the equation always balances)',
    'الصندوق (نقدًا)': 'Cash Box (cash)',
    'مدين 3,500': 'Debit 3,500',
    'إيرادات الرسوم الدراسية': 'Tuition Fee Revenue',
    'دائن 3,500': 'Credit 3,500',
    'القيد متوازن: مدين = دائن': 'Entry balanced: Debit = Credit',
  });

  // ---- أساسيات المحاسبة ----
  addAll({
    'تعلّم قبل أن تستخدم': 'Learn before you use it',
    'أساسيات المحاسبة في دقائق': 'Accounting Basics in Minutes',
    'لا تحتاج أن تكون محاسبًا لتفهم مدرسّتك ماليًا. هذه هي المفاهيم الأربعة التي يقوم عليها النظام بالكامل.':
      'You don’t need to be an accountant to understand your school’s finances. These are the four concepts the whole system is built on.',
    'المعادلة المحاسبية الأساسية': 'The Basic Accounting Equation',
    'الأصول (ما تملكه المدرسة)': 'Assets (what the school owns)',
    'الالتزامات + حقوق الملكية': 'Liabilities + Owner’s Equity',
    'الأصول': 'Assets',
    'كل ما تملكه المدرسة وله قيمة: النقدية في الصندوق، رصيد البنك، الأثاث والمعدات.':
      'Everything of value the school owns: cash in the box, the bank balance, furniture and equipment.',
    'كل ما تملكه المدرسة وله قيمة: النقدية في الصندوق، رصيد البنك، الأثاث والمعدات':
      'Everything of value the school owns: cash in the box, the bank balance, furniture and equipment',
    'الإيرادات': 'Revenue',
    'الأموال التي تكسبها المدرسة: الرسوم الدراسية، رسوم الأنشطة والباصات، وإيرادات أخرى.':
      'Money the school earns: tuition fees, activity and bus fees, and other revenue.',
    'الأموال التي تكسبها المدرسة: الرسوم الدراسية، رسوم الأنشطة والباصات، وإيرادات أخرى':
      'Money the school earns: tuition fees, activity and bus fees, and other revenue',
    'المصروفات': 'Expenses',
    'ما تنفقه المدرسة لتشغيلها: الرواتب، الإيجار، المستلزمات، والصيانة.':
      'What the school spends to operate: salaries, rent, supplies, and maintenance.',
    'ما تنفقه المدرسة لتشغيلها: الرواتب، الإيجار، المستلزمات، والصيانة':
      'What the school spends to operate: salaries, rent, supplies, and maintenance',
    'مبدأ القيد المزدوج: المدين والدائن': 'The Double-Entry Principle: Debit and Credit',
    'كل عملية مالية في المدرسة لها طرفان متساويان دائمًا — لا يوجد قيد بطرف واحد.':
      'Every financial transaction at the school always has two equal sides — there’s no such thing as a one-sided entry.',
    'مدين (Debit)': 'Debit',
    'الطرف الذي يستلم القيمة — مثال: الصندوق عندما يستلم رسومًا دراسية': 'The side that receives the value — example: the cash box when it receives tuition fees',
    'مقابل': 'vs.',
    'دائن (Credit)': 'Credit',
    'الطرف الذي يمنح القيمة أو مصدرها — مثال: حساب إيرادات الرسوم الدراسية': 'The side that gives the value or is its source — example: the tuition fee revenue account',
  });

  // ---- الدورة المحاسبية ----
  addAll({
    'كيف يعمل النظام': 'How the system works',
    'الدورة المحاسبية خطوة بخطوة': 'The Accounting Cycle, Step by Step',
    'من لحظة تسجيل السند وحتى ظهوره في القوائم المالية — كل هذا يحدث تلقائيًا داخل النظام.':
      'From the moment a voucher is recorded to its appearance in the financial statements — it all happens automatically inside the system.',
    'إصدار سند': 'Issue a Voucher',
    'قبض رسوم أو صرف مصروف': 'Collecting a fee or paying an expense',
    'القيد اليومي': 'Journal Entry',
    'تسجيل تلقائي: مدين ودائن': 'Recorded automatically: debit and credit',
    'الترحيل لدفتر الأستاذ': 'Posting to the Ledger',
    'تحديث رصيد كل حساب': 'Updating each account’s balance',
    'ميزان المراجعة': 'Trial Balance',
    'التأكد أن مدين = دائن': 'Confirming that debit = credit',
    'القوائم المالية': 'Financial Statements',
    'قائمة الدخل وصافي الربح': 'The income statement and net profit',
  });

  // ---- دليل الحسابات (الصفحة الرئيسية) ----
  addAll({
    'الحسابات المدرسية الجاهزة في النظام': 'The School Accounts Ready in the System',
    'دليل حسابات مبسّط ومخصص للمدارس، جاهز للاستخدام فورًا دون أي إعداد.':
      'A simplified chart of accounts built for schools, ready to use instantly with no setup.',
    'الرمز': 'Code',
    'اسم الحساب': 'Account Name',
    'النوع': 'Type',
    'الرصيد الطبيعي': 'Normal Balance',
  });

  // ---- مزايا النظام ----
  addAll({
    'كل ما تحتاجه المحاسبة المدرسية في مكان واحد': 'Everything school accounting needs, in one place',
    'سندات قبض وصرف': 'Receipt & Payment Vouchers',
    'واجهة بسيطة لتسجيل الرسوم والمصروفات دون أي خبرة محاسبية مسبقة.': 'A simple interface for recording fees and expenses with no prior accounting experience.',
    'قيود يومية تلقائية': 'Automatic Journal Entries',
    'كل سند يولّد قيدًا محاسبيًا متوازنًا فورًا — بلا أخطاء يدوية.': 'Every voucher instantly generates a balanced accounting entry — no manual errors.',
    'دفتر أستاذ لكل حساب': 'A Ledger for Every Account',
    'تتبّع حركة أي حساب ورصيده التراكمي بنقرة واحدة.': 'Track any account’s activity and running balance in one click.',
    'لوحة قيادة ملوّنة': 'A Colorful Dashboard',
    'مؤشرات ورسوم بيانية واضحة تلخّص الوضع المالي في ثوانٍ.': 'Clear indicators and charts that summarize the financial position in seconds.',
    'ميزان مراجعة فوري': 'Instant Trial Balance',
    'تحقّق تلقائي أن إجمالي المدين يساوي إجمالي الدائن دائمًا.': 'Automatic verification that total debits always equal total credits.',
    'قائمة دخل مبسّطة': 'A Simplified Income Statement',
    'الإيرادات، المصروفات، وصافي الربح أو الخسارة — بوضوح تام.': 'Revenue, expenses, and net profit or loss — with total clarity.',
    'تصدير للقيود': 'Export for Journal Entries',
    'تصدير سجل القيود اليومية كملف CSV لمشاركته أو أرشفته.': 'Export the journal entry log as a CSV file to share or archive.',
    'حماية بكلمة مرور': 'Password Protection',
    'وصول محمي للنظام المحاسبي عبر تسجيل دخول مخصص للمحاسب.': 'Protected access to the accounting system via a dedicated accountant login.',
  });

  // ---- دعوة ختامية / الفوتر ----
  addAll({
    'جاهز؟': 'Ready?',
    'روابط سريعة': 'Quick Links',
    'النظام': 'System',
    'لوحة القيادة': 'Dashboard',
    'ملاحظة': 'Note',
    'بيانات مشتركة وآمنة عبر السحابة — يراها فريق المحاسبة كافة من أي جهاز فور تحديثها.':
      'Shared, secure cloud data — seen by the entire accounting team from any device the instant it’s updated.',
    'نظام محاسبي مدرسي بسيط وملوّن، يطبّق أساسيات المحاسبة الحقيقية دون تعقيد.':
      'A simple, colorful school accounting system that applies real accounting fundamentals without complexity.',
    'فتح النظام المحاسبي': 'Open the Accounting System',
    'نظام محاسبي مدرسي متكامل: سندات قبض وصرف، قيود يومية تلقائية، دفتر أستاذ، ميزان مراجعة، وقوائم مالية — مع شرح مبسّط لأساسيات المحاسبة.':
      'A complete school accounting system: receipt and payment vouchers, automatic journal entries, a ledger, a trial balance, and financial statements — with a simplified guide to accounting basics.',
  });

  // ================= شاشة الدخول =================
  addAll({
    'النظام المحاسبي المدرسي': 'The School Accounting System',
    'النظام المحاسبي': 'Accounting System',
    'تسجيل دخول المحاسب': 'Accountant Sign In',
    'مخصص لفريق الشؤون المالية والمحاسبة فقط': 'For the finance and accounting team only',
    'اسم المستخدم': 'Username',
    'كلمة المرور': 'Password',
    'تسجيل الدخول': 'Sign In',
    'جارٍ الدخول...': 'Signing in...',
    'يرجى إدخال اسم المستخدم وكلمة المرور': 'Please enter your username and password',
    'بيانات الدخول غير صحيحة': 'Incorrect login credentials',
    'انتهت الجلسة، يرجى تسجيل الدخول مجددًا': 'Your session has expired, please sign in again',
  });

  // ================= إطار التطبيق: الشريط الجانبي =================
  addAll({
    'نظرة عامة': 'Overview',
    'الطلاب': 'Students',
    'سندات القبض': 'Receipt Vouchers',
    'سندات الصرف': 'Payment Vouchers',
    'القيود اليومية': 'Journal Entries',
    'دفتر الأستاذ': 'The Ledger',
    'المستخدمون': 'Users',
    'الإعدادات': 'Settings',
    '↩ العودة إلى الموقع الرئيسي': '↩ Back to the Main Site',
    'تسجيل الخروج': 'Sign Out',
  });

  // ================= تبويب: نظرة عامة =================
  addAll({
    'ملخص الوضع المالي للمدرسة': 'A summary of the school’s financial position',
    'إجمالي الإيرادات': 'Total Revenue',
    'جميع رسوم وإيرادات المدرسة': 'All school fees and revenue',
    'إجمالي المصروفات': 'Total Expenses',
    'رواتب، إيجار، تشغيل، وغيرها': 'Salaries, rent, operations, and more',
    'صافي الربح': 'Net Profit',
    'صافي الخسارة': 'Net Loss',
    'الإيرادات − المصروفات': 'Revenue − Expenses',
    'وضع مالي إيجابي 👍': 'Positive financial position 👍',
    'المصروفات تفوق الإيرادات ⚠️': 'Expenses exceed revenue ⚠️',
    'السندات هذا الشهر': 'Vouchers This Month',
    'إجمالي كل السندات:': 'Total of all vouchers:',
    'الإيرادات والمصروفات — آخر 6 أشهر': 'Revenue & Expenses — Last 6 Months',
    'مقارنة شهرية بين التحصيل والصرف': 'A monthly comparison of collections and payments',
    'توزيع المصروفات': 'Expense Distribution',
    'حسب بند الصرف': 'By expense item',
    'أحدث السندات': 'Latest Vouchers',
    'رقم السند': 'Voucher No.',
    'البيان': 'Description',
    'التاريخ': 'Date',
    'المبلغ': 'Amount',
  });

  // ================= تبويب: الطلاب =================
  addAll({
    'عدد الطلاب': 'Number of Students',
    'في جميع الصفوف': 'Across all classes',
    'إجمالي ما تم تحصيله من الطلاب': 'Total Collected From Students',
    'سندات القبض المرتبطة بالطلاب': 'Receipt vouchers linked to students',
    'عدد الصفوف والمراحل': 'Number of Classes & Stages',
    'من تمهيدي حتى الصف الثاني عشر': 'From Pre-KG through Grade 12',
    'الصفوف والمراحل': 'Classes & Stages',
    'اضغط على أي صف للانتقال إليه وعرض طلابه فقط — رقم القيد يُولَّد تلقائيًا حسب نطاق كل صف':
      'Click any class to open it and view only its students — the registration number is generated automatically based on each class’s range',
    'إضافة طالب جديد': 'Add New Student',
    'كل الصفوف': 'All Classes',
    'كل الطلاب': 'All Students',
    'طالب': 'student(s)',
    'سجل الطلاب': 'Student Record',
    'بحث بالاسم أو رقم القيد أو جوال ولي الأمر...': 'Search by name, registration no., or guardian’s phone...',
    'تصدير سجل الطلاب CSV': 'Export Student Record CSV',
    'QR': 'QR',
    'الصف': 'Class',
    'السندات': 'Vouchers',
    'إجمالي المدفوعات': 'Total Payments',
    'إجراءات': 'Actions',
    'لا يوجد طلاب هنا بعد — اضغط «إضافة طالب جديد» للبدء': 'No students here yet — click “Add New Student” to get started',
    'الصف الحالي:': 'Current class:',
    'عرض بطاقة الطالب': 'View student card',
    'عرض': 'View',
    'تعديل': 'Edit',
    'إضافة دفعة': 'Add Payment',
    'حذف': 'Delete',
    'لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول به': 'You can’t delete your own account while signed in to it',
    'لا يمكن حذف آخر حساب مسؤول نشط في النظام': 'The last active admin account in the system can’t be deleted',
    'حذف الطلاب متاح لحساب المسؤول فقط': 'Deleting students is available to admin accounts only',
    'ليست لديك صلاحية لحذف الطلاب': 'You don’t have permission to delete students',
    'تم حذف الطالب': 'Student deleted',
    'يرجى اختيار الصف وإدخال اسم الطالب على الأقل': 'Please choose a class and enter at least the student’s name',
  });

  // ================= نموذج الطالب =================
  addAll({
    'نموذج قبول الطالب': 'Student Admission Form',
    'نموذج قبول الطالب — يُولَّد رقم القيد تلقائيًا بعد اختيار الصف': 'Student admission form — the registration number is generated automatically after choosing the class',
    'بيانات الطالب': 'Student Information',
    'الصف / المرحلة': 'Class / Stage',
    'رقم القيد': 'Registration No.',
    'سيُحدَّد تلقائيًا عند الحفظ': 'Will be assigned automatically on save',
    'اسم الطالب': 'Student Name',
    'تاريخ الميلاد': 'Date of Birth',
    'الجنس': 'Gender',
    '— غير محدد —': '— Not specified —',
    'ذكر': 'Male',
    'أنثى': 'Female',
    'تاريخ الالتحاق': 'Enrollment Date',
    'نسبة الخصم على الرسوم (%)': 'Fee Discount (%)',
    'جوال ولي الأمر (SMS / واتساب)': 'Guardian’s Phone (SMS / WhatsApp)',
    'تفاصيل الرسوم': 'Fee Breakdown',
    'أدخل المبلغ المستحق لكل نوع رسوم — رقم منفصل لكل بند، تُجمع تلقائيًا لتكوين إجمالي رسوم الطالب':
      'Enter the amount due for each fee type — a separate figure for each item, totaled automatically into the student’s total fees',
    'الدفعة الأولى عند القبول': 'First Payment on Admission',
    'إجبارية لأي نوع رسوم — يُصدر سند قبض تلقائيًا بهذا المبلغ فور حفظ الطالب':
      'Required for any fee type — a receipt voucher for this amount is issued automatically once the student is saved',
    'نوع الرسوم (حساب الإيراد)': 'Fee Type (Revenue Account)',
    'مبلغ الدفعة الأولى (ر.س)': 'First Payment Amount (SAR)',
    'طريقة الدفع': 'Payment Method',
    'نقدًا (الصندوق)': 'Cash (cash box)',
    'تحويل بنكي (البنك)': 'Bank Transfer (bank)',
    'اختيار صورة الطالب': 'Choose Student Photo',
    'تُصغَّر الصورة تلقائيًا لتوفير المساحة': 'The photo is resized automatically to save space',
    'بيانات إضافية': 'Additional Information',
    'فصيلة الدم': 'Blood Type',
    'المدرسة السابقة': 'Previous School',
    'العنوان': 'Address',
    'ملاحظات': 'Notes',
    'بيانات ولي الأمر (الأب)': 'Guardian Information (Father)',
    'اسم الأب': 'Father’s Name',
    'رقم الهوية الوطنية': 'National ID No.',
    'المهنة': 'Occupation',
    'رقم الجوال': 'Phone No.',
    'بيانات الأم': 'Mother’s Information',
    'اسم الأم': 'Mother’s Name',
    'المستندات': 'Documents',
    'شهادة الميلاد / الهوية': 'Birth Certificate / ID',
    'مستند إضافي': 'Additional Document',
    'لم يتم اختيار ملف — الحد الأقصى 300KB (صورة أو PDF)': 'No file chosen — max 300KB (image or PDF)',
    'إلغاء': 'Cancel',
    'حفظ بيانات الطالب': 'Save Student',
    'تعديل بيانات الطالب': 'Edit Student Information',
    'يرجى إدخال تفصيل الرسوم (رسم واحد على الأقل بقيمة أكبر من صفر) — هذا الحقل إجباري':
      'Please enter the fee breakdown (at least one fee greater than zero) — this field is required',
    'يرجى إدخال مبلغ الدفعة الأولى (قيمة أكبر من صفر) — هذا الحقل إجباري لأي نوع رسوم':
      'Please enter the first payment amount (greater than zero) — this field is required for any fee type',
    'يرجى اختيار نوع الرسوم (حساب الإيراد) الخاص بالدفعة الأولى': 'Please choose the fee type (revenue account) for the first payment',
    'تم تحديث بيانات الطالب': 'Student information updated',
    'تعذّر الحفظ — تحقق من الاتصال بالإنترنت وحاول مجددًا': 'Save failed — check your internet connection and try again',
    'الدفعة الأولى عند القبول:': 'First payment on admission:',
    'أدخل تفصيل الرسوم أولًا لحساب صافي المبلغ المستحق': 'Enter the fee breakdown first to calculate the net amount due',
    'لا يمكن أن تتجاوز صافي الرسوم المستحقة': 'cannot exceed the net fees due',
    'الملف كبير جدًا': 'File is too large',
    'الحد الأقصى 300KB': 'max 300KB',
    'مثال: O+': 'Example: O+',
    '(ثابت)': '(fixed)',
    '(تقديري — يُؤكَّد عند الحفظ)': '(estimated — confirmed on save)',
  });

  // ================= بطاقة عرض الطالب =================
  addAll({
    'بطاقة الطالب': 'Student Card',
    'البيانات الكاملة ورمز QR للتعريف السريع': 'Full information and a QR code for quick identification',
    'بيانات التواصل والالتحاق': 'Contact & Enrollment Information',
    'ولي الأمر': 'Guardian',
    'جوال الأب': 'Father’s Phone',
    'مهنة الأب': 'Father’s Occupation',
    'جوال الأم': 'Mother’s Phone',
    'مهنة الأم': 'Mother’s Occupation',
    'إجمالي الرسوم': 'Total Fees',
    'الرسوم بعد الخصم': 'Fees After Discount',
    'نسبة الخصم': 'Discount Rate',
    'عدد السندات': 'Number of Vouchers',
    'إجمالي المدفوع': 'Total Paid',
    'المتبقي': 'Remaining',
    'السجل المالي': 'Financial Record',
    'الرسوم:': 'Fees:',
    'خصم': 'Discount',
    'لا توجد رسوم مُفصَّلة': 'No itemized fees',
    'طباعة بطاقة الطالب (PDF)': 'Print Student Card (PDF)',
    'طباعة كشف كامل بكل السندات': 'Print Full Voucher Statement',
  });

  // ================= إضافة دفعة =================
  addAll({
    'تسجيل سند قبض للطالب': 'Record a receipt voucher for the student',
    'تسجيل سند قبض للطالب:': 'Recording a receipt voucher for student:',
    'طريقة الاستلام': 'Collection Method',
    'نوع الرسوم': 'Fee Type',
    'حفظ الدفعة وإصدار السند': 'Save Payment & Issue Voucher',
    'يرجى تعبئة جميع الحقول الإلزامية بمبلغ أكبر من صفر': 'Please fill in all required fields with an amount greater than zero',
    'تم تسجيل الدفعة وإصدار سند القبض': 'Payment recorded and receipt voucher issued',
    'تعذّر حفظ الدفعة — تحقق من الاتصال بالإنترنت وحاول مجددًا': 'Payment could not be saved — check your internet connection and try again',
  });

  // ================= سندات القبض / الصرف =================
  addAll({
    'سند قبض جديد': 'New Receipt Voucher',
    'تحصيل رسوم دراسية أو إيراد آخر': 'Collecting tuition fees or other revenue',
    'اسم الدافع (الطالب / ولي الأمر)': 'Payer Name (student / guardian)',
    'حساب الإيراد': 'Revenue Account',
    '(اختياري)': '(optional)',
    'إضافة سند القبض': 'Add Receipt Voucher',
    'جميع سندات القبض': 'All Receipt Vouchers',
    'تصدير القيود CSV': 'Export Entries CSV',
    'بحث بالاسم أو رقم السند...': 'Search by name or voucher no...',
    'الدافع': 'Payer',
    'الحساب': 'Account',
    'الطريقة': 'Method',
    'لا توجد سندات قبض بعد': 'No receipt vouchers yet',
    'سند صرف جديد': 'New Payment Voucher',
    'تسجيل مصروف تشغيلي للمدرسة': 'Recording an operating expense for the school',
    'المستفيد (جهة الصرف)': 'Beneficiary (payee)',
    'طريقة الصرف': 'Payment Method',
    'حساب المصروف': 'Expense Account',
    'إضافة سند الصرف': 'Add Payment Voucher',
    'جميع سندات الصرف': 'All Payment Vouchers',
    'المستفيد': 'Beneficiary',
    'لا توجد سندات صرف بعد': 'No payment vouchers yet',
    'يرجى إدخال بريد إلكتروني صحيح (يُستخدم لاستعادة كلمة المرور لاحقًا)': 'Please enter a valid email (used later for password recovery)',
    'تم إضافة سند القبض وتوليد القيد المحاسبي بنجاح': 'Receipt voucher added and accounting entry generated successfully',
    'تم إضافة سند القبض بنجاح': 'Receipt voucher added successfully',
    'تم إضافة سند الصرف وتوليد القيد المحاسبي بنجاح': 'Payment voucher added and accounting entry generated successfully',
    'تم إضافة سند الصرف بنجاح': 'Payment voucher added successfully',
    'حذف سند القبض هذا؟ سيُحذف القيد المرتبط به أيضًا.': 'Delete this receipt voucher? Its linked journal entry will be deleted too.',
    'حذف سند الصرف هذا؟ سيُحذف القيد المرتبط به أيضًا.': 'Delete this payment voucher? Its linked journal entry will be deleted too.',
    'ليست لديك صلاحية لحذف السندات': 'You don’t have permission to delete vouchers',
    'حذف السندات متاح لحساب المسؤول فقط': 'Deleting vouchers is available to admin accounts only',
    'تم حذف السند': 'Voucher deleted',
    'طباعة / حفظ PDF': 'Print / Save PDF',
    'تحويل بنكي': 'Bank Transfer',
    'نقدًا': 'Cash',
    'بنكي': 'Bank',
  });

  // ================= القيود اليومية / دفتر الأستاذ / ميزان المراجعة =================
  addAll({
    'سجل القيود اليومية': 'Journal Entry Log',
    'تصدير CSV': 'Export CSV',
    'رقم القيد': 'Entry No.',
    'مدين': 'Debit',
    'دائن': 'Credit',
    'لا توجد قيود بعد — أضف سند قبض أو صرف لتظهر هنا': 'No entries yet — add a receipt or payment voucher for it to appear here',
    'اختر الحساب:': 'Choose account:',
    'الرصيد التراكمي': 'Running Balance',
    'لا توجد حركات على هذا الحساب بعد': 'No activity on this account yet',
    'الرصيد الختامي:': 'Closing Balance:',
    'الإجمالي': 'Total',
    'الرصيد': 'Balance',
    'متوازن: مدين = دائن': 'Balanced: Debit = Credit',
    'غير متوازن': 'Not Balanced',
  });

  // ================= القوائم المالية =================
  addAll({
    'الإيرادات حسب المصدر': 'Revenue by Source',
    'المصروفات حسب البند': 'Expenses by Item',
    'صافي الربح / الخسارة': 'Net Profit / Loss',
    'لا توجد بيانات': 'No data',
  });

  // ================= دليل الحسابات (تطبيق) =================
  addAll({
    'دليل الحسابات المدرسي': 'School Chart of Accounts',
    'أصل': 'Asset',
    'إيراد': 'Revenue',
    'مصروف': 'Expense',
    'حساب محذوف من الدليل': 'Account deleted from the chart',
  });

  // ================= المستخدمون =================
  addAll({
    'حسابات الدخول للنظام': 'System Login Accounts',
    'أضف حسابات لفريق المحاسبة وحدّد صلاحية كل حساب — تُحفظ فقط في متصفح هذا الجهاز':
      'Add accounts for the accounting team and set each account’s permission — stored only in this device’s browser',
    '+ إضافة مستخدم': '+ Add User',
    'اسم المستخدم (للدخول)': 'Username (for login)',
    'مثال: accountant2': 'Example: accountant2',
    'البريد الإلكتروني': 'Email',
    'يُستخدم فقط لاستعادة كلمة المرور عند نسيانها': 'Used only to recover a forgotten password',
    'الاسم الكامل': 'Full Name',
    'يظهر في أعلى الصفحة': 'Shown at the top of the page',
    'الدور': 'Role',
    'محاسب — بدون صلاحية إدارة المستخدمين': 'Accountant — no user management permission',
    'مسؤول — صلاحية كاملة + إدارة المستخدمين': 'Admin — full permission + user management',
    'كلمة المرور (8 أحرف على الأقل)': 'Password (at least 8 characters)',
    'تأكيد كلمة المرور': 'Confirm Password',
    'حفظ المستخدم': 'Save User',
    'إضافة مستخدم جديد': 'Add New User',
    'سيتمكن هذا الحساب من تسجيل الدخول للنظام المحاسبي بهذه البيانات': 'This account will be able to sign in to the accounting system with these details',
    'تعديل بيانات المستخدم': 'Edit User Information',
    'الاسم': 'Name',
    'تاريخ الإنشاء': 'Created On',
    'إعادة تعيين كلمة المرور': 'Reset Password',
    'تعطيل الحساب': 'Disable Account',
    'تفعيل الحساب': 'Enable Account',
    'مسؤول': 'Admin',
    'محاسب': 'Accountant',
    'نشط': 'Active',
    'موقوف': 'Suspended',
    'هذا حسابك الحالي': 'This is your current account',
    'لا يوجد مستخدمون': 'No users',
    'تم إنشاء المستخدم بنجاح': 'User created successfully',
    'تم حفظ التعديلات': 'Changes saved',
    'تم حذف المستخدم': 'User deleted',
    'كلمتا المرور غير متطابقتين': 'The passwords do not match',
    'تم تعطيل الحساب': 'Account disabled',
    'تم تفعيل الحساب': 'Account enabled',
    'حذف المستخدم': 'Delete user',
    'لا يمكن التراجع عن هذا الإجراء': 'This action cannot be undone',
    'هذا الإجراء نهائي ولا يمكن التراجع عنه': 'This action is final and cannot be undone',
    'إعادة تعيين كلمة المرور لـ': 'Reset password for',
    'سيُرسَل رابط إعادة التعيين إلى بريد المستخدم:': 'A reset link will be sent to the user’s email:',
    'لأسباب أمنية، لا يمكن تعيين كلمة مرور جديدة للمستخدم مباشرةً من هنا. اضغط الزر أدناه لإرسال رسالة رسمية تحتوي رابط إعادة تعيين كلمة المرور إلى البريد الإلكتروني المسجَّل لهذا المستخدم، ليقوم هو بتعيين كلمة مرور جديدة بنفسه.':
      'For security reasons, a new password cannot be set for a user directly from here. Click the button below to send an official message containing a password reset link to this user’s registered email, so they can set a new password themselves.',
    'إرسال رابط إعادة التعيين': 'Send Reset Link',
    'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريد المستخدم': 'Password reset link sent to the user’s email',
    'لا يوجد بريد إلكتروني مسجَّل لهذا المستخدم': 'No email is registered for this user',
    'المستخدم غير موجود': 'User not found',
    'اسم المستخدم موجود مسبقًا': 'Username already exists',
    'هذا البريد الإلكتروني مستخدَم مسبقًا لحساب آخر': 'This email is already used by another account',
    'اسم المستخدم يجب أن يكون 3-30 حرفًا (إنجليزي/أرقام/._- فقط)': 'Username must be 3-30 characters (English letters/digits/._- only)',
    'كلمة المرور يجب ألا تقل عن 8 أحرف': 'Password must be at least 8 characters',
    'هذا الإجراء متاح للمسؤول فقط': 'This action is available to admins only',
    'يرجى إدخال اسم مستخدم': 'Please enter a username',
    'لا يمكنك تعطيل حسابك الحالي أثناء تسجيل الدخول به': 'You can’t disable your own account while signed in to it',
    'لا يمكن — هذا آخر حساب مسؤول نشط في النظام': 'Not allowed — this is the last active admin account in the system',
    'تعذّر إنشاء الحساب:': 'Could not create the account:',
    'تعذّر الحفظ:': 'Save failed:',
    'تعذّر إرسال رسالة إعادة التعيين:': 'Could not send the reset message:',
    'تعذّر الحذف:': 'Delete failed:',
  });

  // ================= الإعدادات =================
  addAll({
    'تغيير كلمة المرور': 'Change Password',
    'كلمة المرور الحالية': 'Current Password',
    'كلمة المرور الجديدة (8 أحرف على الأقل)': 'New Password (at least 8 characters)',
    'تأكيد كلمة المرور الجديدة': 'Confirm New Password',
    'حفظ التغييرات': 'Save Changes',
    'كلمتا المرور الجديدتان غير متطابقتين': 'The new passwords do not match',
    'تم تغيير كلمة المرور بنجاح': 'Password changed successfully',
    'كلمة المرور الحالية غير صحيحة، أو الرجاء إعادة تسجيل الدخول ثم المحاولة مجددًا': 'The current password is incorrect, or please sign in again and retry',
    'النسخ الاحتياطي والاستعادة': 'Backup & Restore',
    'كل بيانات النظام محفوظة داخل متصفح هذا الجهاز فقط — يُنصح بأخذ نسخة احتياطية دوريًا لتفادي فقدان البيانات':
      'All system data is stored only in this device’s browser — it’s recommended to back up regularly to avoid data loss',
    'تنزيل نسخة احتياطية كاملة': 'Download a Full Backup',
    'يُنزَّل ملف واحد (JSON) يحتوي جميع الطلاب والسندات والقيود وحسابات المستخدمين. احتفظ به في مكان آمن (بريدك الإلكتروني، تخزين سحابي، أو قرص خارجي).':
      'Downloads a single (JSON) file containing all students, vouchers, entries, and user accounts. Keep it somewhere safe (your email, cloud storage, or an external drive).',
    'تنزيل نسخة احتياطية الآن': 'Download Backup Now',
    'الاستعادة من نسخة احتياطية': 'Restore From a Backup',
    'يستبدل هذا كل بيانات النظام الحالية في هذا المتصفح بمحتوى الملف المختار، ولا يمكن التراجع بعد الاستعادة. تأكد من اختيار ملف النسخة الاحتياطية الصحيح الصادر من هذا النظام قبل المتابعة.':
      'This replaces all of the system’s current data in this browser with the content of the chosen file, and cannot be undone once restored. Make sure you’ve chosen the correct backup file produced by this system before continuing.',
    'اختيار ملف النسخة الاحتياطية للاستعادة': 'Choose Backup File to Restore',
    'تم تنزيل ملف النسخة الاحتياطية إلى جهازك': 'Backup file downloaded to your device',
    'تعذّرت قراءة الملف المختار': 'The chosen file could not be read',
    'تأكيد الاستعادة': 'Confirm Restore',
    'سيتم استبدال': 'This will replace',
    'كل': 'all',
    'بيانات الطلاب والسندات والقيود وحسابات المستخدمين الحالية في هذا المتصفح بمحتوى الملف:':
      'the current students, vouchers, entries, and user account data in this browser with the content of the file:',
    'هل تريد المتابعة؟': 'Do you want to continue?',
    'نعم، استبدال كل البيانات': 'Yes, replace all data',
    'الملف المختار ليس بصيغة JSON صالحة': 'The chosen file is not valid JSON',
    'هذا الملف ليس نسخة احتياطية صادرة من هذا النظام': 'This file is not a backup produced by this system',
    'جارٍ الاستعادة... قد يستغرق ذلك بضع ثوانٍ': 'Restoring... this may take a few seconds',
    'تمت استعادة النسخة الاحتياطية بنجاح — سيُعاد تحميل الصفحة': 'Backup restored successfully — the page will reload',
    'حدث خطأ أثناء الاستعادة:': 'An error occurred while restoring:',
    'استعادة النسخة الاحتياطية متاحة لحساب المسؤول فقط': 'Restoring a backup is available to admin accounts only',
  });

  // ================= إيصالات الطباعة =================
  addAll({
    'سند قبض': 'Receipt Voucher',
    'سند صرف': 'Payment Voucher',
    'الاسم (الدافع)': 'Name (Payer)',
    'تم الإصدار عبر النظام المحاسبي —': 'Issued via the accounting system —',
    'إيصال دفع الرسوم': 'Fee Payment Receipt',
    'إجمالي الرسوم (بعد الخصم)': 'Total Fees (after discount)',
    'المبلغ المدفوع في هذا السند': 'Amount Paid in This Voucher',
    'المتبقي بعد هذا السند': 'Remaining After This Voucher',
    'م': '#',
    'الإجمالي المستحق': 'Total Due',
    'المدفوع في هذا السند': 'Paid in This Voucher',
    'إعداد': 'Prepared by',
    'اعتماد': 'Approved by',
    'قسم الحسابات —': 'Accounts Department —',
    'بطاقة تعريف الطالب': 'Student ID Card',
    '— تعريف سريع عبر مسح رمز QR': '— quick ID via QR scan',
    'كشف كامل بسندات القبض —': 'Full Receipt Voucher Statement —',
    'تاريخ الطباعة': 'Print Date',
    'الرصيد المستحق من دفعات سابقة': 'Balance Due From Previous Payments',
    'الرسوم الدراسية': 'Tuition Fees',
    'الخصم على الرسوم': 'Fee Discount',
    'كشف سندات القبض': 'Receipt Vouchers Statement',
    'سند': 'voucher(s)',
    'لا توجد سندات قبض بعد لهذا الطالب': 'No receipt vouchers yet for this student',
    'المتبقي بعده': 'Remaining After',
  });

  // ================= دليل الحسابات (بيانات) =================
  addAll({
    'الصندوق (النقدية)': 'Cash Box (cash)',
    'البنك': 'Bank',
    'إيرادات الأنشطة والباصات': 'Activities & Bus Revenue',
    'إيرادات أخرى': 'Other Revenue',
    'رواتب الموظفين': 'Staff Salaries',
    'مستلزمات وقرطاسية': 'Supplies & Stationery',
    'صيانة وتشغيل': 'Maintenance & Operations',
    'مصروفات أخرى': 'Other Expenses',
  });

  // ================= الصفوف والمراحل (بيانات) =================
  addAll({
    'تمهيدي (KG-S)': 'Pre-KG (KG-S)',
    'تمهيدي': 'Pre-KG',
    'الروضة الأولى (KG1)': 'KG1',
    'الروضة الثانية (KG2)': 'KG2',
    'روضة١': 'KG1',
    'روضة٢': 'KG2',
    'الصف الأول': 'Grade 1',
    'الصف الثاني': 'Grade 2',
    'الصف الثالث': 'Grade 3',
    'الصف الرابع': 'Grade 4',
    'الصف الخامس': 'Grade 5',
    'الصف السادس': 'Grade 6',
    'الصف السابع': 'Grade 7',
    'الصف الثامن': 'Grade 8',
    'الصف التاسع': 'Grade 9',
    'الصف العاشر': 'Grade 10',
    'الصف الحادي عشر': 'Grade 11',
    'الصف الثاني عشر': 'Grade 12',
    'صف غير معروف': 'Unknown class',
  });

  // ================= أنواع الرسوم (بيانات) =================
  addAll({
    'رسوم فصلية': 'Term Fees',
    'رسوم القبول': 'Admission Fees',
    'رسوم التسجيل': 'Registration Fees',
    'مستلزمات فنية': 'Art Supplies',
    'النقل (الباص)': 'Transport (Bus)',
    'الكتب': 'Books',
    'الزي المدرسي': 'School Uniform',
    'غرامة': 'Fine',
    'رسوم أخرى': 'Other Fees',
  });

  // ================= وحدة العملة =================
  addAll({ 'ر.س': 'SAR' });

  // ================= مجموعة عامة إضافية (تغطية إضافية للأجزاء المتبقية) =================
  addAll({
    'اسم': 'Name',
    'العنوان الرئيسي': 'Main Title',
    'جوال ولي الأمر': 'Guardian’s Phone',
    'تعذّر الحذف — تحقق من الاتصال أو صلاحياتك: ': 'Delete failed — check your connection or permissions: ',
    'الرقم التسلسلي': 'Serial No.',
    'البند': 'Item',
    'الحساب الدائن': 'Credit Account',
    'الحساب المدين': 'Debit Account',
    'حفظ التعديلات': 'Save Edits',
    'الطالب': 'Student',
    'الحالة': 'Status',
    '— اختر الصف —': '— Choose Class —',
    'لا توجد سندات بعد': 'No vouchers yet',
    'أدخل رسمًا واحدًا على الأقل بقيمة أكبر من صفر': 'Enter at least one fee greater than zero',
    'الدفعة الأولى (': 'First payment (',
    ') أكبر من صافي الرسوم المستحقة (': ') exceeds the net fees due (',
    'تمت إضافة الطالب (رقم القيد: ': 'Student added (registration no.: ',
    ') وتسجيل الدفعة الأولى بمبلغ ': ') and first payment recorded for ',
    'صافي الرسوم بعد الخصم: ': 'Net fees after discount: ',
    ' — المتبقي بعد الدفعة الأولى: ': ' — remaining after first payment: ',
    'تاريخ السند': 'Voucher Date',
    'الإجمالي المدفوع': 'Total Paid',
    'قبض': 'Receipt',
    'صرف': 'Payment',
    'تحصيل من ': 'Collected from ',
    'صرف إلى ': 'Paid to ',
    'تفصيل الرسوم': 'Fee Breakdown',
  });

  // ================= محرك الترجمة =================
  var forwardPairs = null; // [[ar, en], ...] مرتبة تنازليًا حسب طول النص العربي
  var reversePairs = null; // [[en, ar], ...] مرتبة تنازليًا حسب طول النص الإنجليزي

  function buildPairs() {
    if (forwardPairs) return;
    forwardPairs = [];
    for (var k in DICT) { if (Object.prototype.hasOwnProperty.call(DICT, k)) forwardPairs.push([k, DICT[k]]); }
    forwardPairs.sort(function (a, b) { return b[0].length - a[0].length; });
    // لبناء اتجاه العكس (إنجليزي -> عربي) نتجنّب أي قيمة إنجليزية مكرّرة (نُبقي أول ظهور فقط)
    var seenEn = {};
    reversePairs = [];
    forwardPairs.forEach(function (pair) {
      if (!Object.prototype.hasOwnProperty.call(seenEn, pair[1])) {
        seenEn[pair[1]] = true;
        reversePairs.push([pair[1], pair[0]]);
      }
    });
    reversePairs.sort(function (a, b) { return b[0].length - a[0].length; });
  }

  function applyPairs(str, pairs) {
    if (!str) return str;
    var out = str;
    for (var i = 0; i < pairs.length; i++) {
      if (out.indexOf(pairs[i][0]) !== -1) {
        out = out.split(pairs[i][0]).join(pairs[i][1]);
      }
    }
    return out;
  }

  function translateText(str) {
    buildPairs();
    if (getLang() === 'en') return applyPairs(str, forwardPairs);
    return applyPairs(str, reversePairs);
  }

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1 };
  var TRANSLATE_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

  function translateElementAttrs(el) {
    if (!el.getAttribute) return;
    for (var i = 0; i < TRANSLATE_ATTRS.length; i++) {
      var a = TRANSLATE_ATTRS[i];
      var v = el.getAttribute(a);
      if (v) {
        var t = translateText(v);
        if (t !== v) el.setAttribute(a, t);
      }
    }
  }

  function translateNode(root) {
    if (!root) return;
    if (root.nodeType === 3) { // Text node
      var t = translateText(root.nodeValue);
      if (t !== root.nodeValue) root.nodeValue = t;
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 11) return; // عنصر أو fragment فقط
    if (root.nodeType === 1) {
      if (SKIP_TAGS[root.tagName]) return;
      translateElementAttrs(root);
    }
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentNode;
        if (p && SKIP_TAGS[p.tagName]) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var textNodes = [];
    var n;
    while ((n = walker.nextNode())) textNodes.push(n);
    textNodes.forEach(function (tn) {
      var t = translateText(tn.nodeValue);
      if (t !== tn.nodeValue) tn.nodeValue = t;
    });
    // ترجمة السمات (placeholder/title/aria-label/alt) لكل العناصر الفرعية أيضًا
    if (root.querySelectorAll) {
      var withAttrs = root.querySelectorAll('[placeholder],[title],[aria-label],[alt]');
      for (var i = 0; i < withAttrs.length; i++) translateElementAttrs(withAttrs[i]);
    }
  }

  var observer = null;
  function startObserving() {
    if (observer || !document.body) return;
    observer = new MutationObserver(function (mutations) {
      if (getLang() !== 'en' && !pendingArRetranslate) return;
      observer.disconnect();
      mutations.forEach(function (m) {
        for (var i = 0; i < m.addedNodes.length; i++) translateNode(m.addedNodes[i]);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  var pendingArRetranslate = false;

  function getLang() {
    try { return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ar'; } catch (e) { return 'ar'; }
  }

  function updateToggleButtons(lang) {
    var btns = document.querySelectorAll('[data-lang-toggle]');
    for (var i = 0; i < btns.length; i++) {
      var label = btns[i].querySelector('[data-lang-toggle-label]');
      if (label) label.textContent = lang === 'en' ? 'العربية' : 'English';
      else btns[i].textContent = lang === 'en' ? 'العربية' : 'English';
    }
  }

  function applyLangToDocument(lang) {
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'ar');
    document.documentElement.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
    document.body && document.body.classList.toggle('lang-en', lang === 'en');
    document.title = translateText(document.title);
    translateNode(document.body);
    updateToggleButtons(lang);
  }

  function setLang(lang) {
    lang = lang === 'en' ? 'en' : 'ar';
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* تجاهل */ }
    pendingArRetranslate = (lang === 'ar');
    applyLangToDocument(lang);
    pendingArRetranslate = false;
    try { document.dispatchEvent(new CustomEvent('lang:changed', { detail: { lang: lang } })); } catch (e) { /* متصفحات قديمة */ }
  }

  function toggleLang() { setLang(getLang() === 'en' ? 'ar' : 'en'); }

  function init() {
    startObserving();
    var lang = getLang();
    applyLangToDocument(lang);
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-lang-toggle]');
      if (btn) { e.preventDefault(); toggleLang(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.AccI18n = {
    getLang: getLang,
    setLang: setLang,
    toggleLang: toggleLang,
    t: translateText,
    translateNode: translateNode,
  };
})(window);
