// store.js — طبقة البيانات الكاملة للنظام المحاسبي المدرسي (Firebase: Firestore + Authentication)
// يطبّق أساسيات المحاسبة: القيد المزدوج (مدين/دائن)، دفتر الأستاذ، ميزان المراجعة، قائمة الدخل.
//
// ملاحظة معمارية مهمة: القراءات (listStudents, getStudent, listVouchers, getLedger ...) تبقى **متزامنة (sync)**
// تمامًا كما كانت في نسخة localStorage — لكنها الآن تقرأ من نسخة محلية مخزَّنة في الذاكرة (cache) تُحدَّث تلقائيًا
// وفوريًا من Firestore عبر onSnapshot (وهذا ما يمنح النظام مزامنة حيّة بين كل الأجهزة/المتصفحات). أما الكتابة
// (createStudent, deleteVoucher ...) فأصبحت **غير متزامنة (async)** لأنها فعليًا طلبات شبكة إلى خادم Firebase.

import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, setPersistence, browserSessionPersistence, onAuthStateChanged,
  signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword,
  sendPasswordResetEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, runTransaction, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

(function (global) {
  'use strict';

  const SCHOOL_CODE = 'EDSR';
  const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
  // نطاق بريد اصطناعي داخلي: يسمح بتسجيل الدخول باسم مستخدم بسيط (مثل "accountant") بدل بريد إلكتروني حقيقي،
  // مع الاستمرار في استخدام Firebase Authentication الفعلي خلف الكواليس (الذي يتطلب بريدًا لتسجيل الدخول).
  // بريد كل مستخدم الحقيقي (لأغراض استرجاع كلمة المرور) يُحفَظ في حقل email المنفصل داخل مستند users/{uid}.

  if (!global.FIREBASE_CONFIG || !global.FIREBASE_CONFIG.apiKey || global.FIREBASE_CONFIG.apiKey.indexOf('ضع_') === 0) {
    // eslint-disable-next-line no-console
    console.error('لم يتم ضبط js/firebase-config.js بعد — النظام لن يعمل قبل إدخال بيانات مشروع Firebase الخاص بكم فيه.');
  }

  const fbApp = initializeApp(global.FIREBASE_CONFIG || {});
  const auth = getAuth(fbApp);
  // ملاحظة: قاعدة بيانات Firestore الخاصة بهذا المشروع هي القاعدة المحجوزة الافتراضية العادية "(default)"
  // (تحقّقنا من هذا عبر اختبار مباشر على Firestore REST API) — لذلك لا نمرر معرّف قاعدة بيانات صريحًا هنا؛
  // تمرير أي معرّف آخر (مثل "default" بدون قوسين) سيجعل كل اتصال يفشل دائمًا بخطأ "client is offline" مضلِّل.
  // نستخدم مع ذلك experimentalAutoDetectLongPolling بدل getFirestore الافتراضية: بعض الشبكات
  // (برامج حماية، بروكسي شركات) تحجب اتصال Firestore الفوري (WebChannel)، وهذا الخيار يجعل Firestore
  // يكتشف تلقائيًا ويستخدم طريقة اتصال بديلة (long-polling) تعمل عبر أي شبكة تقريبًا.
  const db = initializeFirestore(fbApp, { experimentalAutoDetectLongPolling: true, useFetchStreams: false });
  setPersistence(auth, browserSessionPersistence).catch(() => {});

  // ---------- دليل الحسابات المدرسي (ثابت) ----------
  const ACCOUNTS = [
    { id: 'cash', code: '1001', name: 'الصندوق (النقدية)', type: 'asset', normalSide: 'debit', colorVar: '--series-1' },
    { id: 'bank', code: '1002', name: 'البنك', type: 'asset', normalSide: 'debit', colorVar: '--series-7' },

    { id: 'rev_tuition', code: '4001', name: 'إيرادات الرسوم الدراسية', type: 'revenue', normalSide: 'credit', colorVar: '--series-3' },
    { id: 'rev_activities', code: '4002', name: 'إيرادات الأنشطة والباصات', type: 'revenue', normalSide: 'credit', colorVar: '--series-4' },
    { id: 'rev_other', code: '4003', name: 'إيرادات أخرى', type: 'revenue', normalSide: 'credit', colorVar: '--series-6' },

    { id: 'exp_salaries', code: '5001', name: 'رواتب الموظفين', type: 'expense', normalSide: 'debit', colorVar: '--series-2' },
    { id: 'exp_supplies', code: '5003', name: 'مستلزمات وقرطاسية', type: 'expense', normalSide: 'debit', colorVar: '--series-4' },
    { id: 'exp_maintenance', code: '5004', name: 'صيانة وتشغيل', type: 'expense', normalSide: 'debit', colorVar: '--series-7' },
    { id: 'exp_other', code: '5005', name: 'مصروفات أخرى', type: 'expense', normalSide: 'debit', colorVar: '--series-8' },
  ];
  const REVENUE_ACCOUNTS = ACCOUNTS.filter((a) => a.type === 'revenue');
  const EXPENSE_ACCOUNTS = ACCOUNTS.filter((a) => a.type === 'expense');
  const ASSET_ACCOUNTS = ACCOUNTS.filter((a) => a.type === 'asset');
  function accountById(id) { return ACCOUNTS.find((a) => a.id === id) || null; }
  function accountLabel(id) {
    return accountById(id) || { id, code: '—', name: 'حساب محذوف من الدليل', type: '', normalSide: 'debit', colorVar: '--series-8' };
  }

  // ---------- المراحل والصفوف الدراسية (ثابتة) ----------
  const GRADES = [
    { id: 'kg_s', name: 'تمهيدي (KG-S)', short: 'تمهيدي', base: 0, colorVar: '--series-5' },
    { id: 'kg1', name: 'الروضة الأولى (KG1)', short: 'روضة١', base: 10000, colorVar: '--series-6' },
    { id: 'kg2', name: 'الروضة الثانية (KG2)', short: 'روضة٢', base: 20000, colorVar: '--series-3' },
    { id: 'g1', name: 'الصف الأول', short: 'صف ١', base: 101000, colorVar: '--series-1' },
    { id: 'g2', name: 'الصف الثاني', short: 'صف ٢', base: 102000, colorVar: '--series-1' },
    { id: 'g3', name: 'الصف الثالث', short: 'صف ٣', base: 103000, colorVar: '--series-1' },
    { id: 'g4', name: 'الصف الرابع', short: 'صف ٤', base: 104000, colorVar: '--series-1' },
    { id: 'g5', name: 'الصف الخامس', short: 'صف ٥', base: 105000, colorVar: '--series-1' },
    { id: 'g6', name: 'الصف السادس', short: 'صف ٦', base: 106000, colorVar: '--series-1' },
    { id: 'g7', name: 'الصف السابع', short: 'صف ٧', base: 201000, colorVar: '--series-7' },
    { id: 'g8', name: 'الصف الثامن', short: 'صف ٨', base: 202000, colorVar: '--series-7' },
    { id: 'g9', name: 'الصف التاسع', short: 'صف ٩', base: 203000, colorVar: '--series-7' },
    { id: 'g10', name: 'الصف العاشر', short: 'صف ١٠', base: 301000, colorVar: '--series-8' },
    { id: 'g11', name: 'الصف الحادي عشر', short: 'صف ١١', base: 302000, colorVar: '--series-8' },
    { id: 'g12', name: 'الصف الثاني عشر', short: 'صف ١٢', base: 303000, colorVar: '--series-8' },
  ];
  function gradeById(id) { return GRADES.find((g) => g.id === id) || null; }

  // ---------- أنواع رسوم الطالب (تفصيل الرسوم عند القبول) ----------
  const FEE_TYPES = [
    { id: 'termly', label: 'رسوم فصلية' },
    { id: 'admission', label: 'رسوم القبول' },
    { id: 'registration', label: 'رسوم التسجيل' },
    { id: 'art_material', label: 'مستلزمات فنية' },
    { id: 'transport', label: 'النقل (الباص)' },
    { id: 'books', label: 'الكتب' },
    { id: 'uniform', label: 'الزي المدرسي' },
    { id: 'fine', label: 'غرامة' },
    { id: 'others', label: 'رسوم أخرى' },
  ];
  function feeTypeById(id) { return FEE_TYPES.find((f) => f.id === id) || null; }
  function normalizeFees(feesInput) {
    const fees = {};
    FEE_TYPES.forEach((f) => { fees[f.id] = round2(Math.max(0, Number(feesInput && feesInput[f.id]) || 0)); });
    return fees;
  }
  function sumFees(fees) {
    return round2(FEE_TYPES.reduce((sum, f) => sum + (Number(fees && fees[f.id]) || 0), 0));
  }

  const FEE_TYPE_ACCOUNT_MAP = {
    termly: 'rev_tuition', admission: 'rev_tuition', registration: 'rev_tuition',
    art_material: 'rev_other', transport: 'rev_activities', books: 'rev_other',
    uniform: 'rev_other', fine: 'rev_other', others: 'rev_other',
  };
  function feeTypeToAccountId(feeTypeId) { return FEE_TYPE_ACCOUNT_MAP[feeTypeId] || 'rev_other'; }

  // ---------- أدوات عامة ----------
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  // تنزيل نص (CSV/JSON) كملف على جهاز المستخدم
  function downloadTextFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------- النسخة المحلية المخزَّنة في الذاكرة (cache) — تُحدَّث حيًّا عبر onSnapshot ----------
  const cache = {
    students: [],
    vouchers: [],
    users: [],
    counters: { receipt: 0, payment: 0 },
    studentCounters: {},
    ready: { students: false, vouchers: false, users: false, counters: false, studentCounters: false },
  };
  let unsubscribers = [];

  function notifyChange() {
    document.dispatchEvent(new CustomEvent('acc:data-changed'));
  }

  function stopListening() {
    unsubscribers.forEach((u) => { try { u(); } catch (e) { /* تجاهل */ } });
    unsubscribers = [];
    cache.students = []; cache.vouchers = []; cache.users = [];
    cache.counters = { receipt: 0, payment: 0 }; cache.studentCounters = {};
    cache.ready = { students: false, vouchers: false, users: false, counters: false, studentCounters: false };
  }

  // يبدأ الاستماع الحي لكل مجموعات البيانات — يُستدعى فقط بعد تسجيل دخول ناجح
  function startListening() {
    stopListening();
    unsubscribers.push(onSnapshot(collection(db, 'students'), (snap) => {
      cache.students = snap.docs.map((d) => d.data());
      cache.ready.students = true;
      notifyChange();
    }, () => { cache.ready.students = true; notifyChange(); }));

    unsubscribers.push(onSnapshot(collection(db, 'vouchers'), (snap) => {
      cache.vouchers = snap.docs.map((d) => d.data());
      cache.ready.vouchers = true;
      notifyChange();
    }, () => { cache.ready.vouchers = true; notifyChange(); }));

    // ملاحظة: قواعد الأمان (Security Rules) تُقيّد ما يظهر فعليًا هنا — المسؤول يرى الجميع، والمحاسب يرى سجله فقط
    unsubscribers.push(onSnapshot(collection(db, 'users'), (snap) => {
      cache.users = snap.docs.map((d) => d.data());
      cache.ready.users = true;
      notifyChange();
    }, () => { cache.ready.users = true; notifyChange(); }));

    unsubscribers.push(onSnapshot(doc(db, 'meta', 'counters'), (snap) => {
      cache.counters = snap.exists() ? snap.data() : { receipt: 0, payment: 0 };
      cache.ready.counters = true;
    }, () => { cache.ready.counters = true; }));

    unsubscribers.push(onSnapshot(doc(db, 'meta', 'studentCounters'), (snap) => {
      cache.studentCounters = snap.exists() ? snap.data() : {};
      cache.ready.studentCounters = true;
    }, () => { cache.ready.studentCounters = true; }));
  }

  // معاينة رقم القيد القادم دون استهلاكه (تقديري فقط — يعتمد على آخر نسخة مخزَّنة محليًا، ويُؤكَّد فعليًا عبر معاملة Firestore atomically عند الحفظ)
  function peekNextRegNo(classId) {
    const grade = gradeById(classId);
    if (!grade) return null;
    const idx = cache.studentCounters[classId] || 0;
    return String(grade.base + idx).padStart(6, '0');
  }

  // ---------- طبقة السندات + القيود اليومية ----------
  const Store = {
    ACCOUNTS, REVENUE_ACCOUNTS, EXPENSE_ACCOUNTS, ASSET_ACCOUNTS, accountById, accountLabel,
    GRADES, gradeById, FEE_TYPES, feeTypeById, feeTypeToAccountId, SCHOOL_CODE, peekNextRegNo,

    // إنشاء سند قبض — معاملة Firestore ذرّية: تحجز رقمًا تسلسليًا فريدًا حتى مع كتابة متزامنة من أكثر من جهاز
    async createReceipt(data) {
      const cashSide = data.method === 'bank' ? 'bank' : 'cash';
      const resolvedAccountId = data.account_id || feeTypeToAccountId(data.fee_type_id);
      const ref = doc(collection(db, 'vouchers'));
      const record = {
        id: ref.id, type: 'receipt', serial: '', date: data.date, amount: round2(Number(data.amount)),
        party_name: data.party_name, student_id: data.student_id || null, method: data.method,
        account_id: resolvedAccountId, fee_type_id: data.fee_type_id || null,
        debit_account_id: cashSide, credit_account_id: resolvedAccountId,
        description: data.description || '', created_at: new Date().toISOString(),
      };
      await runTransaction(db, async (tx) => {
        const countersRef = doc(db, 'meta', 'counters');
        const countersSnap = await tx.get(countersRef);
        const counters = countersSnap.exists() ? countersSnap.data() : { receipt: 0, payment: 0 };
        const next = (counters.receipt || 0) + 1;
        record.serial = `REC-${String(next).padStart(4, '0')}`;
        tx.set(countersRef, { ...counters, receipt: next }, { merge: true });
        tx.set(ref, record);
      });
      return record;
    },

    async createPayment(data) {
      const cashSide = data.method === 'bank' ? 'bank' : 'cash';
      const ref = doc(collection(db, 'vouchers'));
      const record = {
        id: ref.id, type: 'payment', serial: '', date: data.date, amount: round2(Number(data.amount)),
        party_name: data.party_name, method: data.method, account_id: data.account_id,
        debit_account_id: data.account_id, credit_account_id: cashSide,
        description: data.description || '', created_at: new Date().toISOString(),
      };
      await runTransaction(db, async (tx) => {
        const countersRef = doc(db, 'meta', 'counters');
        const countersSnap = await tx.get(countersRef);
        const counters = countersSnap.exists() ? countersSnap.data() : { receipt: 0, payment: 0 };
        const next = (counters.payment || 0) + 1;
        record.serial = `PAY-${String(next).padStart(4, '0')}`;
        tx.set(countersRef, { ...counters, payment: next }, { merge: true });
        tx.set(ref, record);
      });
      return record;
    },

    listVouchers({ type = '', search = '', page = 1, pageSize = 12 } = {}) {
      let list = cache.vouchers.slice().sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.created_at) - new Date(a.created_at));
      if (type) list = list.filter((v) => v.type === type);
      if (search) {
        const q = search.trim().toLowerCase();
        list = list.filter((v) => [v.serial, v.party_name, v.description].some((f) => String(f || '').toLowerCase().includes(q)));
      }
      const total = list.length;
      const start = (Math.max(1, page) - 1) * pageSize;
      return { rows: list.slice(start, start + pageSize), total };
    },

    getVoucher(id) { return cache.vouchers.find((v) => v.id === id) || null; },

    // حذف السندات متاح لحساب المسؤول فقط — حماية دفاعية على مستوى الواجهة، والحماية الفعلية عبر Security Rules في Firestore
    async deleteVoucher(id) {
      if (!Auth.isAdmin()) return { ok: false, error: 'حذف السندات متاح لحساب المسؤول فقط' };
      try {
        await deleteDoc(doc(db, 'vouchers', id));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: 'تعذّر الحذف — تحقق من الاتصال أو صلاحياتك: ' + (e && e.message ? e.message : '') };
      }
    },

    listJournalEntries() {
      return cache.vouchers.map((v) => ({
        id: v.id, serial: v.serial, date: v.date,
        description: v.description || (v.type === 'receipt' ? `تحصيل من ${v.party_name}` : `صرف إلى ${v.party_name}`),
        debit_account_id: v.debit_account_id, credit_account_id: v.credit_account_id,
        amount: v.amount, voucher_type: v.type,
      })).sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getLedger(accountId) {
      const account = accountById(accountId);
      if (!account) return null;
      const entries = this.listJournalEntries()
        .filter((e) => e.debit_account_id === accountId || e.credit_account_id === accountId)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      let balance = 0;
      const rows = entries.map((e) => {
        const debit = e.debit_account_id === accountId ? e.amount : 0;
        const credit = e.credit_account_id === accountId ? e.amount : 0;
        balance += account.normalSide === 'debit' ? debit - credit : credit - debit;
        return { ...e, debit, credit, balance: round2(balance) };
      });
      return { account, rows, closingBalance: round2(balance) };
    },

    getTrialBalance() {
      const entries = this.listJournalEntries();
      const totals = {};
      ACCOUNTS.forEach((a) => { totals[a.id] = { debit: 0, credit: 0 }; });
      const orphanIds = new Set();
      entries.forEach((e) => {
        if (!totals[e.debit_account_id]) { totals[e.debit_account_id] = { debit: 0, credit: 0 }; orphanIds.add(e.debit_account_id); }
        if (!totals[e.credit_account_id]) { totals[e.credit_account_id] = { debit: 0, credit: 0 }; orphanIds.add(e.credit_account_id); }
        totals[e.debit_account_id].debit += e.amount;
        totals[e.credit_account_id].credit += e.amount;
      });
      const rows = ACCOUNTS.map((a) => {
        const t = totals[a.id];
        const balance = a.normalSide === 'debit' ? t.debit - t.credit : t.credit - t.debit;
        return { account: a, debit: round2(t.debit), credit: round2(t.credit), balance: round2(balance) };
      });
      orphanIds.forEach((id) => {
        const t = totals[id];
        rows.push({ account: accountLabel(id), debit: round2(t.debit), credit: round2(t.credit), balance: round2(t.debit - t.credit) });
      });
      const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
      const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0));
      return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.005 };
    },

    // ---------- سجل الطلاب ----------
    async createStudent(data) {
      const ref = doc(collection(db, 'students'));
      const now = new Date().toISOString();
      const fees = normalizeFees(data.fees);
      const record = {
        id: ref.id, reg_no: '', class_id: data.class_id, name: (data.name || '').trim(),
        dob: data.dob || '', gender: data.gender || '', admission_date: data.admission_date || new Date().toISOString().slice(0, 10),
        fees, tuition_fee: sumFees(fees), discount_percent: Math.max(0, Math.min(100, Number(data.discount_percent) || 0)),
        guardian_phone: data.guardian_phone || '', blood_group: data.blood_group || '', previous_school: data.previous_school || '',
        address: data.address || '', notes: data.notes || '', photo: data.photo || '',
        father_name: data.father_name || '', father_id: data.father_id || '', father_job: data.father_job || '', father_phone: data.father_phone || '',
        mother_name: data.mother_name || '', mother_id: data.mother_id || '', mother_job: data.mother_job || '', mother_phone: data.mother_phone || '',
        documents: Array.isArray(data.documents) ? data.documents : [],
        created_at: now, updated_at: now,
      };
      const grade = gradeById(data.class_id);
      if (!grade) throw new Error('صف غير معروف');
      await runTransaction(db, async (tx) => {
        const countersRef = doc(db, 'meta', 'studentCounters');
        const countersSnap = await tx.get(countersRef);
        const counters = countersSnap.exists() ? countersSnap.data() : {};
        const idx = counters[data.class_id] || 0;
        record.reg_no = String(grade.base + idx).padStart(6, '0');
        tx.set(countersRef, { ...counters, [data.class_id]: idx + 1 }, { merge: true });
        tx.set(ref, record);
      });
      return record;
    },

    async updateStudent(id, data) {
      const prev = cache.students.find((s) => s.id === id);
      if (!prev) return null;
      const fees = data.fees ? normalizeFees(data.fees) : (prev.fees || normalizeFees({ termly: prev.tuition_fee }));
      const updated = {
        ...prev, ...data, id: prev.id, reg_no: prev.reg_no, fees, tuition_fee: sumFees(fees),
        discount_percent: Math.max(0, Math.min(100, Number(data.discount_percent ?? prev.discount_percent) || 0)),
        documents: Array.isArray(data.documents) ? data.documents : prev.documents,
        updated_at: new Date().toISOString(),
      };
      await setDoc(doc(db, 'students', id), updated);
      return updated;
    },

    async deleteStudent(id) {
      if (!Auth.isAdmin()) return { ok: false, error: 'حذف الطلاب متاح لحساب المسؤول فقط' };
      try {
        await deleteDoc(doc(db, 'students', id));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: 'تعذّر الحذف — تحقق من الاتصال أو صلاحياتك: ' + (e && e.message ? e.message : '') };
      }
    },

    getStudent(id) { return cache.students.find((s) => s.id === id) || null; },

    getStudentPayments(student) {
      const name = (student.name || '').trim().toLowerCase();
      const rows = cache.vouchers
        .filter((v) => v.type === 'receipt')
        .filter((v) => (v.student_id && v.student_id === student.id) || (!v.student_id && name && (v.party_name || '').trim().toLowerCase() === name))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      return { rows, count: rows.length, totalPaid: round2(rows.reduce((s, v) => s + v.amount, 0)), lastDate: rows.length ? rows[0].date : null };
    },

    getClassCounts() {
      const counts = {};
      GRADES.forEach((g) => (counts[g.id] = 0));
      cache.students.forEach((s) => { if (counts[s.class_id] !== undefined) counts[s.class_id] += 1; });
      return counts;
    },

    listStudents({ classId = '', search = '', page = 1, pageSize = 12 } = {}) {
      let list = cache.students.slice().sort((a, b) => a.reg_no.localeCompare(b.reg_no));
      if (classId) list = list.filter((s) => s.class_id === classId);
      if (search) {
        const q = search.trim().toLowerCase();
        list = list.filter((s) => [s.name, s.reg_no, s.guardian_phone].some((f) => String(f || '').toLowerCase().includes(q)));
      }
      const total = list.length;
      const start = (Math.max(1, page) - 1) * pageSize;
      const rows = list.slice(start, start + pageSize).map((s) => {
        const pay = this.getStudentPayments(s);
        return { ...s, paymentsCount: pay.count, totalPaid: pay.totalPaid, lastPaymentDate: pay.lastDate };
      });
      return { rows, total };
    },

    getStudentsTotals({ classId = '', search = '' } = {}) {
      const { rows } = this.listStudents({ classId, search, page: 1, pageSize: 100000 });
      return { totalStudents: rows.length, totalCollected: round2(rows.reduce((s, r) => s + r.totalPaid, 0)) };
    },

    getIncomeStatement({ from = null, to = null } = {}) {
      const vouchers = cache.vouchers.filter((v) => {
        if (from && v.date < from) return false;
        if (to && v.date > to) return false;
        return true;
      });
      const revenueByAccount = {}; const expenseByAccount = {};
      REVENUE_ACCOUNTS.forEach((a) => (revenueByAccount[a.id] = 0));
      EXPENSE_ACCOUNTS.forEach((a) => (expenseByAccount[a.id] = 0));
      vouchers.forEach((v) => {
        if (v.type === 'receipt') revenueByAccount[v.account_id] = (revenueByAccount[v.account_id] || 0) + v.amount;
        if (v.type === 'payment') expenseByAccount[v.account_id] = (expenseByAccount[v.account_id] || 0) + v.amount;
      });
      const revenueRows = REVENUE_ACCOUNTS.map((a) => ({ account: a, amount: round2(revenueByAccount[a.id] || 0) }));
      const expenseRows = EXPENSE_ACCOUNTS.map((a) => ({ account: a, amount: round2(expenseByAccount[a.id] || 0) }));
      const totalRevenue = round2(revenueRows.reduce((s, r) => s + r.amount, 0));
      const totalExpense = round2(expenseRows.reduce((s, r) => s + r.amount, 0));
      return { revenueRows, expenseRows, totalRevenue, totalExpense, netProfit: round2(totalRevenue - totalExpense) };
    },

    getMonthlySeries(months = 6) {
      const now = new Date();
      const buckets = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        buckets.push({ key, label: d.toLocaleDateString('ar-SA', { month: 'short' }), revenue: 0, expense: 0 });
      }
      const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
      cache.vouchers.forEach((v) => {
        const key = String(v.date || '').slice(0, 7);
        const bucket = byKey[key];
        if (!bucket) return;
        if (v.type === 'receipt') bucket.revenue += v.amount; else bucket.expense += v.amount;
      });
      return buckets.map((b) => ({ ...b, revenue: round2(b.revenue), expense: round2(b.expense) }));
    },

    getStats() {
      const income = this.getIncomeStatement();
      const todayPrefix = new Date().toISOString().slice(0, 10);
      const thisMonthPrefix = new Date().toISOString().slice(0, 7);
      const todayCount = cache.vouchers.filter((v) => v.date === todayPrefix).length;
      const monthCount = cache.vouchers.filter((v) => String(v.date).slice(0, 7) === thisMonthPrefix).length;
      return {
        totalRevenue: income.totalRevenue, totalExpense: income.totalExpense, netProfit: income.netProfit,
        todayCount, monthCount, totalVouchers: cache.vouchers.length,
        cashBalance: this.getLedger('cash').closingBalance, bankBalance: this.getLedger('bank').closingBalance,
      };
    },

    exportJournalCSV() {
      const entries = this.listJournalEntries();
      const headers = ['رقم السند', 'التاريخ', 'البيان', 'الحساب المدين', 'الحساب الدائن', 'المبلغ'];
      const esc = (v) => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const lines = [headers.map(esc).join(',')];
      entries.forEach((e) => {
        lines.push([e.serial, e.date, e.description, accountLabel(e.debit_account_id).name, accountLabel(e.credit_account_id).name, e.amount].map(esc).join(','));
      });
      downloadTextFile(`journal-${Date.now()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8;');
    },

    exportStudentsCSV() {
      const headers = ['رقم القيد', 'اسم الطالب', 'الصف/المرحلة', 'جوال ولي الأمر', 'اسم الأب', 'اسم الأم', 'تاريخ الالتحاق', 'إجمالي الرسوم', 'نسبة الخصم %', 'صافي الرسوم', 'إجمالي المدفوع', 'المتبقي'];
      const esc = (v) => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const lines = [headers.map(esc).join(',')];
      cache.students.slice().sort((a, b) => a.reg_no.localeCompare(b.reg_no)).forEach((s) => {
        const g = gradeById(s.class_id);
        const pay = this.getStudentPayments(s);
        const netFee = round2((s.tuition_fee || 0) * (1 - (s.discount_percent || 0) / 100));
        const remaining = Math.max(0, round2(netFee - pay.totalPaid));
        lines.push([s.reg_no, s.name, g ? g.name : '', s.guardian_phone || '', s.father_name || '', s.mother_name || '',
          s.admission_date || '', s.tuition_fee || 0, s.discount_percent || 0, netFee, pay.totalPaid, remaining].map(esc).join(','));
      });
      downloadTextFile(`students-${Date.now()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8;');
    },

    // ---------- نسخ احتياطي واستعادة (الآن على مستوى قاعدة بيانات Firestore المشتركة، لا المتصفح فقط) ----------
    exportBackupJSON() {
      const payload = {
        app: 'edusteps-riyadh', school_code: SCHOOL_CODE, backup_version: 2,
        exported_at: new Date().toISOString(),
        data: { vouchers: cache.vouchers, students: cache.students, counters: cache.counters, studentCounters: cache.studentCounters },
      };
      downloadTextFile(`edu-steps-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8;');
    },

    // يستبدل كل بيانات الطلاب والسندات المشتركة في Firestore بمحتوى ملف نسخة احتياطية — إجراء متاح للمسؤول فقط
    // ملاحظة: لا يستعيد حسابات المستخدمين (هذه تُدار عبر Firebase Authentication ولا يمكن استبدالها من ملف محلي)
    async importBackupJSON(jsonText) {
      if (!Auth.isAdmin()) return { ok: false, error: 'استعادة النسخة الاحتياطية متاحة لحساب المسؤول فقط' };
      let payload;
      try { payload = JSON.parse(jsonText); } catch (e) { return { ok: false, error: 'الملف المختار ليس بصيغة JSON صالحة' }; }
      if (!payload || typeof payload !== 'object' || !payload.data || payload.app !== 'edu-steps-accounting') {
        return { ok: false, error: 'هذا الملف ليس نسخة احتياطية صادرة من هذا النظام' };
      }
      const d = payload.data;
      try {
        // حذف كل الطلاب والسندات الحالية أولًا (على دفعات — الحد الأقصى 500 عملية لكل دفعة في Firestore)
        const existingIds = [...cache.students.map((s) => ['students', s.id]), ...cache.vouchers.map((v) => ['vouchers', v.id])];
        for (let i = 0; i < existingIds.length; i += 450) {
          const batch = writeBatch(db);
          existingIds.slice(i, i + 450).forEach(([col, id]) => batch.delete(doc(db, col, id)));
          await batch.commit();
        }
        const newDocs = [
          ...(Array.isArray(d.students) ? d.students.map((s) => ['students', s]) : []),
          ...(Array.isArray(d.vouchers) ? d.vouchers.map((v) => ['vouchers', v]) : []),
        ];
        for (let i = 0; i < newDocs.length; i += 450) {
          const batch = writeBatch(db);
          newDocs.slice(i, i + 450).forEach(([col, record]) => batch.set(doc(db, col, record.id), record));
          await batch.commit();
        }
        if (d.counters && typeof d.counters === 'object') await setDoc(doc(db, 'meta', 'counters'), d.counters);
        if (d.studentCounters && typeof d.studentCounters === 'object') await setDoc(doc(db, 'meta', 'studentCounters'), d.studentCounters);
        return { ok: true, exportedAt: payload.exported_at || null };
      } catch (e) {
        return { ok: false, error: 'حدث خطأ أثناء الاستعادة: ' + (e && e.message ? e.message : '') };
      }
    },
  };

  // ============================================================
  // المصادقة (Firebase Authentication) وإدارة المستخدمين
  // ============================================================
  function publicUser(u) {
    return { id: u.uid, username: u.username, name: u.name, role: u.role, active: u.active !== false, createdAt: u.createdAt, email: u.email };
  }
  function countActiveAdmins(excludeUid) {
    return cache.users.filter((u) => u.role === 'admin' && u.active !== false && u.uid !== excludeUid).length;
  }

  let currentSession = null; // { userId, uid, username, name, role, expires }
  let authReadyResolve;
  const authReadyPromise = new Promise((resolve) => { authReadyResolve = resolve; });
  let authReadyFired = false;
  let userDocUnsub = null;

  function buildSession(fbUser, userDoc) {
    const loginAtRaw = sessionStorage.getItem('edu_acc_login_at_' + fbUser.uid);
    const loginAt = loginAtRaw ? Number(loginAtRaw) : Date.now();
    if (!loginAtRaw) sessionStorage.setItem('edu_acc_login_at_' + fbUser.uid, String(loginAt));
    return {
      userId: fbUser.uid, uid: fbUser.uid, username: userDoc.username, name: userDoc.name || userDoc.username,
      role: userDoc.role, expires: loginAt + SESSION_TTL_MS,
    };
  }

  onAuthStateChanged(auth, async (fbUser) => {
    if (userDocUnsub) { userDocUnsub(); userDocUnsub = null; }
    if (!fbUser) {
      currentSession = null;
      stopListening();
      if (!authReadyFired) { authReadyFired = true; authReadyResolve(); }
      notifyChange();
      return;
    }
    // نستمع حيًّا لمستند المستخدم الخاص به (يعكس فورًا أي تغيير في الدور أو تعطيل الحساب من طرف المسؤول)
    userDocUnsub = onSnapshot(doc(db, 'users', fbUser.uid), (snap) => {
      if (!snap.exists() || snap.data().active === false) {
        currentSession = null;
        signOut(auth).catch(() => {});
        if (!authReadyFired) { authReadyFired = true; authReadyResolve(); }
        notifyChange();
        return;
      }
      const userDoc = snap.data();
      const expiredByTTL = currentSession && currentSession.uid === fbUser.uid && Date.now() > currentSession.expires;
      if (expiredByTTL) {
        signOut(auth).catch(() => {});
        return;
      }
      currentSession = buildSession(fbUser, userDoc);
      if (!authReadyFired) { authReadyFired = true; authReadyResolve(); }
      startListening();
      notifyChange();
    }, () => {
      if (!authReadyFired) { authReadyFired = true; authReadyResolve(); }
    });
  });

  const Auth = {
    // يُنتظر أولًا حتى تُحدِّد Firebase ما إذا كان هناك مستخدم مسجَّل دخوله مسبقًا (عملية غير متزامنة عند تحميل الصفحة)
    ready() { return authReadyPromise; },

    // أُبقيت لأجل التوافق مع الاستدعاءات القديمة — لا حاجة لإنشاء مسؤول افتراضي هنا بعد الآن؛
    // أول حساب مسؤول يُنشأ يدويًا من Firebase Console كخطوة تهيئة لمرة واحدة (راجع تعليمات النشر المرفقة)
    async ensureDefaultAdmin() { return Promise.resolve(); },

    async login(username, password) {
      const uname = String(username || '').trim().toLowerCase();
      if (!uname || !password) return false;
      try {
        const mapSnap = await getDoc(doc(db, 'usernames', uname));
        if (!mapSnap.exists()) return false;
        const { email } = mapSnap.data();
        sessionStorage.removeItem('edu_acc_login_at_pending');
        const cred = await signInWithEmailAndPassword(auth, email, password);
        sessionStorage.setItem('edu_acc_login_at_' + cred.user.uid, String(Date.now()));
        // ننتظر وصول مستند المستخدم عبر onAuthStateChanged قبل اعتبار الدخول ناجحًا فعليًا
        for (let i = 0; i < 50 && !currentSession; i++) { await new Promise((r) => setTimeout(r, 100)); }
        return !!currentSession;
      } catch (e) {
        console.error('EDU_LOGIN_ERROR', e && e.code, e && e.message);
        return false;
      }
    },

    getSession() {
      if (currentSession && Date.now() > currentSession.expires) { this.logout(); return null; }
      return currentSession;
    },

    logout() {
      if (auth.currentUser) sessionStorage.removeItem('edu_acc_login_at_' + auth.currentUser.uid);
      signOut(auth).catch(() => {});
    },

    async changePassword(currentPassword, newPassword) {
      const fbUser = auth.currentUser;
      if (!fbUser || !fbUser.email) return { ok: false, error: 'انتهت الجلسة، يرجى تسجيل الدخول مجددًا' };
      try {
        await reauthenticateWithCredential(fbUser, EmailAuthProvider.credential(fbUser.email, currentPassword));
        await updatePassword(fbUser, newPassword);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: 'كلمة المرور الحالية غير صحيحة، أو الرجاء إعادة تسجيل الدخول ثم المحاولة مجددًا' };
      }
    },

    isAdmin() { const s = this.getSession(); return !!s && s.role === 'admin'; },

    // يُعاد استدعاؤها بعد تعديل بيانات المستخدم الحالي — بفضل onSnapshot الحيّ على مستند المستخدم، الجلسة تتحدَّث تلقائيًا أصلًا
    refreshSession() { return this.getSession(); },

    listUsers() { return cache.users.map(publicUser).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); },

    // إنشاء مستخدم جديد: يتطلب بريدًا إلكترونيًا حقيقيًا (لأجل إمكانية استعادة كلمة المرور ذاتيًا لاحقًا)
    // يُستخدم تطبيق Firebase ثانوي مؤقت حتى لا يُفقَد تسجيل دخول المسؤول الحالي أثناء إنشاء الحساب الجديد
    async createUser({ username, password, name, role, email }) {
      if (!this.isAdmin()) return { ok: false, error: 'هذا الإجراء متاح للمسؤول فقط' };
      const uname = String(username || '').trim().toLowerCase();
      if (!uname) return { ok: false, error: 'يرجى إدخال اسم مستخدم' };
      if (!/^[a-z0-9_.\-]{3,30}$/.test(uname)) return { ok: false, error: 'اسم المستخدم يجب أن يكون 3-30 حرفًا (إنجليزي/أرقام/._- فقط)' };
      const mail = String(email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { ok: false, error: 'يرجى إدخال بريد إلكتروني صحيح (يُستخدم لاستعادة كلمة المرور لاحقًا)' };
      if (!password || password.length < 8) return { ok: false, error: 'كلمة المرور يجب ألا تقل عن 8 أحرف' };
      const existingMap = await getDoc(doc(db, 'usernames', uname));
      if (existingMap.exists()) return { ok: false, error: 'اسم المستخدم موجود مسبقًا' };
      const roleVal = role === 'admin' ? 'admin' : 'staff';

      const secondaryApp = initializeApp(global.FIREBASE_CONFIG, 'SecondaryUserCreation-' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, mail, password);
        const newUid = cred.user.uid;
        await signOut(secondaryAuth);
        const createdAt = Date.now();
        await setDoc(doc(db, 'users', newUid), {
          uid: newUid, username: uname, email: mail, name: (name || '').trim() || uname, role: roleVal, active: true, createdAt,
        });
        await setDoc(doc(db, 'usernames', uname), { email: mail });
        return { ok: true, user: { id: newUid, username: uname, name: (name || '').trim() || uname, role: roleVal, active: true, createdAt } };
      } catch (e) {
        const code = e && e.code ? e.code : '';
        if (code === 'auth/email-already-in-use') return { ok: false, error: 'هذا البريد الإلكتروني مستخدَم مسبقًا لحساب آخر' };
        return { ok: false, error: 'تعذّر إنشاء الحساب: ' + (e && e.message ? e.message : '') };
      } finally {
        try { await deleteApp(secondaryApp); } catch (e) { /* تجاهل */ }
      }
    },

    async updateUser(id, { name, role, active }) {
      if (!this.isAdmin()) return { ok: false, error: 'هذا الإجراء متاح للمسؤول فقط' };
      const user = cache.users.find((u) => u.uid === id);
      if (!user) return { ok: false, error: 'المستخدم غير موجود' };
      const session = this.getSession();
      const roleVal = role === 'admin' ? 'admin' : 'staff';
      const activeVal = active !== false;
      if (session && session.userId === id && activeVal === false) {
        return { ok: false, error: 'لا يمكنك تعطيل حسابك الحالي أثناء تسجيل الدخول به' };
      }
      const willBeNonAdmin = user.role === 'admin' && roleVal !== 'admin';
      const willBeInactive = user.active !== false && activeVal === false;
      if ((willBeNonAdmin || willBeInactive) && countActiveAdmins(user.uid) === 0) {
        return { ok: false, error: 'لا يمكن — هذا آخر حساب مسؤول نشط في النظام' };
      }
      try {
        await updateDoc(doc(db, 'users', id), {
          name: (typeof name === 'string' && name.trim()) ? name.trim() : user.name, role: roleVal, active: activeVal,
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: 'تعذّر الحفظ: ' + (e && e.message ? e.message : '') };
      }
    },

    // لا يمكن لأي حساب (حتى المسؤول) تعيين كلمة مرور جديدة لمستخدم آخر مباشرةً من المتصفح لأسباب أمنية —
    // بدلًا من ذلك يُرسِل هذا الإجراء رسالة "إعادة تعيين كلمة المرور" الرسمية من Firebase إلى بريد المستخدم المسجَّل
    async sendPasswordReset(id) {
      if (!this.isAdmin()) return { ok: false, error: 'هذا الإجراء متاح للمسؤول فقط' };
      const user = cache.users.find((u) => u.uid === id);
      if (!user || !user.email) return { ok: false, error: 'لا يوجد بريد إلكتروني مسجَّل لهذا المستخدم' };
      try {
        await sendPasswordResetEmail(auth, user.email);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: 'تعذّر إرسال رسالة إعادة التعيين: ' + (e && e.message ? e.message : '') };
      }
    },

    // "حذف" المستخدم يعني هنا: إزالة صلاحية الدخول للنظام (حذف مستند بياناته وربط اسم المستخدم)، وليس حذف حساب
    // Firebase Authentication الفعلي (وهو إجراء يتطلب صلاحيات خادم لا تتوفر في تطبيق بلا خادم بأمان) —
    // النتيجة العملية واحدة: هذا الشخص لن يستطيع الدخول للنظام أو رؤية أي بيانات بعد الحذف
    async deleteUser(id) {
      if (!this.isAdmin()) return { ok: false, error: 'هذا الإجراء متاح للمسؤول فقط' };
      const session = this.getSession();
      if (session && session.userId === id) return { ok: false, error: 'لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول به' };
      const user = cache.users.find((u) => u.uid === id);
      if (!user) return { ok: false, error: 'المستخدم غير موجود' };
      if (user.role === 'admin' && countActiveAdmins(user.uid) === 0) {
        return { ok: false, error: 'لا يمكن حذف آخر حساب مسؤول نشط في النظام' };
      }
      try {
        await deleteDoc(doc(db, 'users', id));
        if (user.username) await deleteDoc(doc(db, 'usernames', user.username)).catch(() => {});
        return { ok: true };
      } catch (e) {
        return { ok: false, error: 'تعذّر الحذف: ' + (e && e.message ? e.message : '') };
      }
    },
  };

  global.AccStore = Store;
  global.AccAuth = Auth;
  global.__AccCache = cache; // للاختبار فقط (Playwright) — غير مستخدَم من واجهة التطبيق
})(window);
