(function () {
  'use strict';

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return document.querySelectorAll(sel); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function isEnglishUI() { return !!(window.AccI18n && window.AccI18n.getLang() === 'en'); }
  function fmtMoney(n) {
    if (isEnglishUI()) return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' SAR';
    return (Number(n) || 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 }) + ' ر.س';
  }
  function fmtDate(iso) {
    try {
      if (isEnglishUI()) return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    catch (e) { return iso; }
  }
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  const state = {
    receiptsPage: 1,
    receiptsSearch: '',
    paymentsPage: 1,
    paymentsSearch: '',
    studentsPage: 1,
    studentsSearch: '',
    studentsClassId: '',
  };

  function toast(message, type) {
    const el = $('#toast');
    el.textContent = message;
    el.className = `toast show ${type || ''}`;
    setTimeout(() => el.classList.remove('show'), 2600);
  }

  // ---------- تبديل شاشة الدخول / التطبيق ----------
  function showLogin() { $('#loginScreen').classList.remove('hidden'); $('#appShell').classList.add('hidden'); }
  function showApp() { $('#loginScreen').classList.add('hidden'); $('#appShell').classList.remove('hidden'); }

  const ROLE_LABEL = { admin: 'مسؤول', staff: 'محاسب' };
  let currentRole = null;

  function applySessionUI(session) {
    currentRole = session.role;
    const displayName = session.name || session.username;
    $('#userName').textContent = displayName;
    $('#userAvatar').textContent = displayName.slice(0, 1).toUpperCase();
    const roleBadge = $('#userRoleBadge');
    if (roleBadge) roleBadge.textContent = ROLE_LABEL[session.role] || '';
    const usersNav = $('#usersNavBtn');
    if (usersNav) usersNav.classList.toggle('hidden', session.role !== 'admin');
  }

  async function checkSession() {
    await AccAuth.ready();
    const session = AccAuth.getSession();
    if (session) {
      applySessionUI(session);
      showApp();
      initApp();
    } else {
      showLogin();
    }
  }

  const loginForm = $('#loginForm');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = $('#loginAlert');
    alertBox.className = 'form-alert';
    const username = $('#loginUsername').value.trim();
    const password = $('#loginPassword').value;
    if (!username || !password) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور';
      return;
    }
    const btn = $('#loginBtn'), spinner = $('#loginSpinner'), btnText = $('#loginBtnText');
    btn.disabled = true; spinner.classList.add('show'); btnText.textContent = 'جارٍ الدخول...';
    try {
      const ok = await AccAuth.login(username, password);
      if (ok) {
        applySessionUI(AccAuth.getSession());
        loginForm.reset();
        showApp();
        initApp();
      } else {
        alertBox.className = 'form-alert show error';
        alertBox.textContent = 'بيانات الدخول غير صحيحة';
      }
    } finally {
      btn.disabled = false; spinner.classList.remove('show'); btnText.textContent = 'تسجيل الدخول';
    }
  });

  $('#logoutBtn').addEventListener('click', () => { AccAuth.logout(); location.reload(); });
  $('#mobileMenuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  // ---------- التبويبات ----------
  let appInitialized = false;
  const TITLES = {
    overview: ['نظرة عامة', 'ملخص الوضع المالي للمدرسة'],
    students: ['الطلاب', 'سجل الطلاب الكامل مصنّفًا حسب الصفوف والمراحل'],
    receipts: ['سندات القبض', 'تسجيل ومتابعة رسوم الطلاب والإيرادات'],
    payments: ['سندات الصرف', 'تسجيل ومتابعة مصروفات المدرسة'],
    journal: ['القيود اليومية', 'سجل كل حركة مالية بطرفيها المدين والدائن'],
    ledger: ['دفتر الأستاذ', 'تتبّع حركة ورصيد كل حساب'],
    'trial-balance': ['ميزان المراجعة', 'التحقق من توازن إجمالي المدين مع إجمالي الدائن'],
    'income-statement': ['القوائم المالية', 'قائمة الدخل المبسّطة'],
    accounts: ['دليل الحسابات', 'الحسابات المدرسية الجاهزة في النظام'],
    users: ['المستخدمون', 'إدارة حسابات الدخول للنظام وصلاحياتها'],
    settings: ['الإعدادات', 'إدارة حساب المحاسب'],
  };

  function switchTab(tab) {
    if (tab === 'users' && currentRole !== 'admin') tab = 'overview';
    state.currentTab = tab;
    $all('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $all('.tab-panel').forEach((p) => p.classList.add('hidden'));
    $(`#tab-${tab}`).classList.remove('hidden');
    $('#pageTitle').textContent = TITLES[tab][0];
    $('#pageSubtitle').textContent = TITLES[tab][1];
    $('#sidebar').classList.remove('open');

    if (tab === 'overview') loadOverview();
    if (tab === 'students') loadStudents();
    if (tab === 'receipts') loadReceipts();
    if (tab === 'payments') loadPayments();
    if (tab === 'journal') loadJournal();
    if (tab === 'ledger') loadLedger();
    if (tab === 'trial-balance') loadTrialBalance();
    if (tab === 'income-statement') loadIncomeStatement();
    if (tab === 'accounts') loadAccountsTab();
    if (tab === 'users') loadUsersTab();
  }

  $all('.tab-btn').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // ---------- نظرة عامة ----------
  function loadOverview() {
    const s = AccStore.getStats();
    $('#kpiRevenue').textContent = fmtMoney(s.totalRevenue);
    $('#kpiExpense').textContent = fmtMoney(s.totalExpense);
    $('#kpiCount').textContent = s.monthCount;
    $('#kpiCountSub').textContent = `إجمالي كل السندات: ${s.totalVouchers}`;

    const profitEl = $('#kpiProfit');
    const profitBox = $('#kpiProfitBox');
    profitEl.textContent = fmtMoney(s.netProfit);
    profitEl.classList.toggle('good', s.netProfit >= 0);
    profitEl.classList.toggle('bad', s.netProfit < 0);
    profitBox.classList.toggle('negative', s.netProfit < 0);
    $('#kpiProfitSub').textContent = s.netProfit >= 0 ? 'وضع مالي إيجابي 👍' : 'المصروفات تفوق الإيرادات ⚠️';

    const monthly = AccStore.getMonthlySeries(6);
    Viz.renderGroupedBarChart($('#revExpChart'), {
      categories: monthly.map((m) => ({ key: m.key, label: m.label })),
      series: [
        { key: 'revenue', label: 'الإيرادات', colorVar: '--series-1', values: Object.fromEntries(monthly.map((m) => [m.key, m.revenue])) },
        { key: 'expense', label: 'المصروفات', colorVar: '--series-2', values: Object.fromEntries(monthly.map((m) => [m.key, m.expense])) },
      ],
    });

    const income = AccStore.getIncomeStatement();
    const expenseSlices = income.expenseRows
      .filter((r) => r.amount > 0)
      .map((r, i) => ({ key: r.account.id, label: r.account.name, value: r.amount, colorVar: Viz.SERIES_ORDER[i % Viz.SERIES_ORDER.length] }));
    Viz.renderDonutChart($('#expenseDonut'), {
      slices: expenseSlices,
      centerLabel: 'إجمالي المصروفات',
      centerValue: expenseSlices.length ? fmtMoney(income.totalExpense) : '—',
    });

    const vouchers = AccStore.listVouchers({ page: 1, pageSize: 5 }).rows;
    $('#recentTable tbody').innerHTML = vouchers.map((v) => `
      <tr>
        <td class="mono">${v.serial}</td>
        <td><span class="type-pill ${v.type}">${v.type === 'receipt' ? 'قبض' : 'صرف'}</span></td>
        <td>${escapeHtml(v.party_name)}</td>
        <td>${fmtDate(v.date)}</td>
        <td>${fmtMoney(v.amount)}</td>
      </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">لا توجد سندات بعد</td></tr>';
  }

  // ---------- الطلاب ----------
  const GRADE_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5"/></svg>';

  let studentsDebounce = null;
  $('#studentSearch').addEventListener('input', (e) => {
    clearTimeout(studentsDebounce);
    studentsDebounce = setTimeout(() => { state.studentsSearch = e.target.value.trim(); state.studentsPage = 1; loadStudents(); }, 250);
  });
  $('#exportStudentsBtn').addEventListener('click', () => AccStore.exportStudentsCSV());

  function renderClassGrid() {
    const counts = AccStore.getClassCounts();
    const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
    const allBox = `
      <div class="class-box all-classes ${state.studentsClassId === '' ? 'active' : ''}" data-class="" style="--box-color:#101c33;">
        <div class="cb-icon">${GRADE_ICON_SVG}</div>
        <div class="cb-name">كل الطلاب</div>
        <div class="cb-count">${totalAll}</div>
        <div class="cb-count-label">طالب</div>
      </div>`;
    const boxes = AccStore.GRADES.map((g) => `
      <div class="class-box ${state.studentsClassId === g.id ? 'active' : ''}" data-class="${g.id}" style="--box-color:var(${g.colorVar});">
        <div class="cb-icon">${GRADE_ICON_SVG}</div>
        <div class="cb-name">${escapeHtml(g.name)}</div>
        <div class="cb-range">${String(g.base).padStart(6, '0')}+</div>
        <div class="cb-count">${counts[g.id] || 0}</div>
        <div class="cb-count-label">طالب</div>
      </div>`).join('');
    $('#classGrid').innerHTML = allBox + boxes;
    $('#classGrid').querySelectorAll('.class-box').forEach((box) => {
      box.addEventListener('click', () => goToClass(box.dataset.class));
    });
  }

  // الانتقال إلى صف مُحدَّد: يُخفي شبكة الصناديق ويعرض رأس صفحة الصف بدلًا منها، ثم يُنزّل الصفحة لعرض قائمة الطلاب
  function goToClass(classId) {
    state.studentsClassId = classId;
    state.studentsPage = 1;
    loadStudents();
    $('#studentsListPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#backToClassesBtn').addEventListener('click', () => {
    state.studentsClassId = '';
    state.studentsPage = 1;
    loadStudents();
    $('#classGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function loadStudents() {
    const grade = state.studentsClassId ? AccStore.gradeById(state.studentsClassId) : null;

    if (grade) {
      $('#classGrid').classList.add('hidden');
      $('#classPageHeader').classList.remove('hidden');
      $('#classPageHeader').style.setProperty('--box-color', `var(${grade.colorVar})`);
      $('#cphIcon').innerHTML = GRADE_ICON_SVG;
      $('#cphName').textContent = grade.name;
      const counts = AccStore.getClassCounts();
      $('#cphMeta').textContent = `${String(grade.base).padStart(6, '0')}+  •  ${counts[grade.id] || 0} طالب`;
    } else {
      $('#classGrid').classList.remove('hidden');
      $('#classPageHeader').classList.add('hidden');
      renderClassGrid();
    }

    $('#studentsPanelSub').textContent = grade ? `الصف الحالي: ${grade.name}` : 'كل الصفوف';

    const { rows, total } = AccStore.listStudents({ classId: state.studentsClassId, search: state.studentsSearch, page: state.studentsPage, pageSize: 8 });
    const totals = AccStore.getStudentsTotals({ classId: state.studentsClassId, search: state.studentsSearch });
    $('#studentsCount').textContent = totals.totalStudents;
    $('#studentsCountSub').textContent = grade ? `في ${grade.name}` : 'في جميع الصفوف';
    $('#studentsTotalCollected').textContent = fmtMoney(totals.totalCollected);

    const tbody = $('#studentsTableBody');
    const empty = $('#studentsEmpty');
    if (!rows.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); }
    else {
      empty.classList.add('hidden');
      tbody.innerHTML = rows.map((s) => {
        const g = AccStore.gradeById(s.class_id);
        const qrText = `${AccStore.SCHOOL_CODE}|${s.reg_no}`;
        return `
        <tr>
          <td><canvas class="qr-thumb" data-qr="${escapeHtml(qrText)}" data-student="${s.id}" title="عرض بطاقة الطالب"></canvas></td>
          <td>
            <div class="student-name-cell">
              <div class="student-avatar">${s.photo ? `<img src="${s.photo}" alt="" />` : escapeHtml((s.name || '?').slice(0, 1))}</div>
              <div><div class="sn-name">${escapeHtml(s.name)}</div><div class="sn-reg">${s.reg_no}</div></div>
            </div>
          </td>
          <td>${g ? escapeHtml(g.name) : '—'}</td>
          <td class="mono">${escapeHtml(s.guardian_phone || '—')}</td>
          <td>${s.paymentsCount}</td>
          <td>${fmtMoney(s.totalPaid)}</td>
          <td>
            <div class="row-actions">
              <button class="icon-btn view" data-view="${s.id}" title="عرض"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
              <button class="icon-btn edit" data-edit="${s.id}" title="تعديل"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
              <button class="icon-btn pay" data-pay="${s.id}" title="إضافة دفعة"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></button>
              ${currentRole === 'admin' ? `<button class="icon-btn danger" data-delete="${s.id}" title="حذف"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
            </div>
          </td>
        </tr>`;
      }).join('');

      tbody.querySelectorAll('.qr-thumb').forEach((cv) => {
        try { EduQR.renderToCanvas(cv, cv.dataset.qr, { size: 80, margin: 1 }); } catch (e) { /* تجاهل نص طويل جدًا */ }
        cv.addEventListener('click', () => openViewStudent(cv.dataset.student));
      });
      tbody.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => openViewStudent(b.dataset.view)));
      tbody.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openStudentForm(b.dataset.edit)));
      tbody.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => openPaymentModal(b.dataset.pay)));
      tbody.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', async () => {
        const st = AccStore.getStudent(b.dataset.delete);
        if (!confirm(`حذف الطالب «${st ? st.name : ''}»؟ لن يتم حذف السندات المالية المرتبطة به.`)) return;
        b.disabled = true;
        const result = await AccStore.deleteStudent(b.dataset.delete);
        b.disabled = false;
        if (!result.ok) { toast(result.error || 'ليست لديك صلاحية لحذف الطلاب', 'error'); return; }
        toast('تم حذف الطالب', 'success');
        loadStudents();
      }));
    }
    renderPagination('studentsPagInfo', 'studentsPagPages', total, 8, state.studentsPage, (p) => { state.studentsPage = p; loadStudents(); });
  }

  // ---------- نافذة عامة (Modal) ----------
  function openModal(id) { $(`#${id}`).classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(id) { $(`#${id}`).classList.add('hidden'); document.body.style.overflow = ''; }

  // ---------- ملفات: قراءة وتصغير الصور ----------
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  function resizeImageDataURL(dataUrl, maxDim) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * (maxDim / width)); width = maxDim; }
        else if (height >= width && height > maxDim) { width = Math.round(width * (maxDim / height)); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  // ---------- نموذج إضافة / تعديل طالب ----------
  const studentForm = $('#studentForm');
  const MAX_DOC_BYTES = 300 * 1024;
  let currentPhotoDataURL = '';
  let currentDocs = [null, null];

  $('#studentClassSelect').innerHTML = '<option value="">— اختر الصف —</option>' + AccStore.GRADES.map((g) => `<option value="${g.id}">${g.name}</option>`).join('');
  fillAccountSelect($('#studentFirstPaymentAccountSelect'), AccStore.REVENUE_ACCOUNTS);

  // ---------- شبكة تفصيل الرسوم: رقم منفصل لكل نوع رسوم (رسوم فصلية، قبول، تسجيل، مستلزمات فنية، نقل، كتب، زي، غرامة، أخرى) ----------
  $('#feeBreakdownGrid').innerHTML = AccStore.FEE_TYPES.map((f) => `
    <div class="field"><label>${escapeHtml(f.label)} (ر.س)</label><input type="number" name="fee_${f.id}" min="0" step="0.01" value="0" /></div>
  `).join('');

  function getFeesFromForm() {
    const fees = {};
    let total = 0;
    AccStore.FEE_TYPES.forEach((f) => {
      const val = Math.max(0, Number(studentForm.elements[`fee_${f.id}`].value) || 0);
      fees[f.id] = val;
      total += val;
    });
    return { fees, total: round2(total) };
  }

  function updateFeeBreakdownHint() {
    const hint = $('#feeBreakdownTotalHint');
    if (!hint) return;
    const { total } = getFeesFromForm();
    hint.className = total > 0 ? 'afp-hint total' : 'afp-hint warn';
    hint.textContent = total > 0 ? `إجمالي الرسوم: ${fmtMoney(total)}` : 'أدخل رسمًا واحدًا على الأقل بقيمة أكبر من صفر';
  }

  function updateFirstPaymentHint() {
    const hint = $('#firstPaymentHint');
    if (!hint) return;
    const { total: tuitionFee } = getFeesFromForm();
    const discount = Number(studentForm.discount_percent.value) || 0;
    const firstPayment = Number(studentForm.first_payment_amount.value) || 0;
    if (!tuitionFee) { hint.className = 'afp-hint'; hint.textContent = 'أدخل تفصيل الرسوم أولًا لحساب صافي المبلغ المستحق'; return; }
    const netFee = tuitionFee * (1 - discount / 100);
    const remaining = netFee - firstPayment;
    if (firstPayment > netFee) {
      hint.className = 'afp-hint warn';
      hint.textContent = `الدفعة الأولى (${fmtMoney(firstPayment)}) أكبر من صافي الرسوم المستحقة (${fmtMoney(netFee)})`;
    } else {
      hint.className = 'afp-hint';
      hint.textContent = `صافي الرسوم بعد الخصم: ${fmtMoney(netFee)} — المتبقي بعد الدفعة الأولى: ${fmtMoney(Math.max(0, remaining))}`;
    }
  }
  AccStore.FEE_TYPES.forEach((f) => {
    studentForm.elements[`fee_${f.id}`].addEventListener('input', () => { updateFeeBreakdownHint(); updateFirstPaymentHint(); });
  });
  ['discount_percent', 'first_payment_amount'].forEach((n) => {
    studentForm.elements[n].addEventListener('input', updateFirstPaymentHint);
  });

  $('#studentClassSelect').addEventListener('change', () => {
    const g = AccStore.gradeById($('#studentClassSelect').value);
    const el = $('#regNoPreview');
    const isEdit = !!studentForm.student_id.value;
    if (isEdit) return; // رقم القيد لا يتغيّر عند التعديل
    if (!g) { el.className = 'reg-preview empty'; el.textContent = 'سيُحدَّد تلقائيًا عند الحفظ'; return; }
    el.className = 'reg-preview';
    el.textContent = AccStore.peekNextRegNo(g.id) + ' (تقديري — يُؤكَّد عند الحفظ)';
  });

  $('#studentPhotoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const raw = await readFileAsDataURL(file);
    currentPhotoDataURL = await resizeImageDataURL(raw, 260);
    $('#studentPhotoPreview').innerHTML = `<img src="${currentPhotoDataURL}" alt="" />`;
  });

  function wireDocInput(inputEl, labelEl, slot) {
    inputEl.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > MAX_DOC_BYTES) {
        labelEl.textContent = `الملف كبير جدًا (${Math.round(file.size / 1024)}KB) — الحد الأقصى 300KB`;
        labelEl.style.color = 'var(--status-critical)';
        e.target.value = '';
        return;
      }
      const dataUrl = await readFileAsDataURL(file);
      currentDocs[slot] = { name: file.name, dataUrl };
      labelEl.textContent = `✓ ${file.name} (${Math.round(file.size / 1024)}KB)`;
      labelEl.style.color = 'var(--status-good-text)';
    });
  }
  wireDocInput($('#studentDoc1Input'), $('#studentDoc1Name'), 0);
  wireDocInput($('#studentDoc2Input'), $('#studentDoc2Name'), 1);

  function resetStudentForm() {
    studentForm.reset();
    studentForm.student_id.value = '';
    currentPhotoDataURL = '';
    currentDocs = [null, null];
    $('#studentPhotoPreview').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>';
    $('#studentDoc1Name').textContent = 'لم يتم اختيار ملف — الحد الأقصى 300KB (صورة أو PDF)';
    $('#studentDoc2Name').textContent = 'لم يتم اختيار ملف — الحد الأقصى 300KB (صورة أو PDF)';
    $('#studentDoc1Name').style.color = '';
    $('#studentDoc2Name').style.color = '';
    $('#regNoPreview').className = 'reg-preview empty';
    $('#regNoPreview').textContent = 'سيُحدَّد تلقائيًا عند الحفظ';
    $('#studentFormAlert').className = 'form-alert';
    studentForm.admission_date.value = todayISO();
    studentForm.first_payment_method.value = 'cash';
    AccStore.FEE_TYPES.forEach((f) => { studentForm.elements[`fee_${f.id}`].value = 0; });
    $('#firstPaymentHint').className = 'afp-hint';
    $('#firstPaymentHint').textContent = 'أدخل تفصيل الرسوم أولًا لحساب صافي المبلغ المستحق';
    updateFeeBreakdownHint();
  }

  // ---------- إظهار/إخفاء قسم الدفعة الأولى: إجباري عند إضافة طالب جديد فقط، لا يظهر عند التعديل ----------
  function setFirstPaymentRequired(required) {
    $('#firstPaymentSection').classList.toggle('hidden', !required);
    ['first_payment_account_id', 'first_payment_amount', 'first_payment_method'].forEach((n) => {
      studentForm.elements[n].required = required;
    });
  }

  function openStudentForm(studentId) {
    resetStudentForm();
    setFirstPaymentRequired(!studentId);
    if (studentId) {
      const s = AccStore.getStudent(studentId);
      if (!s) return;
      $('#studentModalTitle').textContent = 'تعديل بيانات الطالب';
      studentForm.student_id.value = s.id;
      studentForm.class_id.value = s.class_id;
      studentForm.name.value = s.name || '';
      studentForm.dob.value = s.dob || '';
      studentForm.gender.value = s.gender || '';
      studentForm.admission_date.value = s.admission_date || todayISO();
      // تفصيل الرسوم: يُعبَّأ من s.fees إن وُجد، أو تُوضع الرسوم القديمة (قبل هذه الميزة) كاملة في «رسوم فصلية»
      const savedFees = s.fees || { termly: s.tuition_fee || 0 };
      AccStore.FEE_TYPES.forEach((f) => { studentForm.elements[`fee_${f.id}`].value = savedFees[f.id] || 0; });
      updateFeeBreakdownHint();
      studentForm.discount_percent.value = s.discount_percent || 0;
      studentForm.guardian_phone.value = s.guardian_phone || '';
      studentForm.blood_group.value = s.blood_group || '';
      studentForm.previous_school.value = s.previous_school || '';
      studentForm.address.value = s.address || '';
      studentForm.notes.value = s.notes || '';
      studentForm.father_name.value = s.father_name || '';
      studentForm.father_id.value = s.father_id || '';
      studentForm.father_job.value = s.father_job || '';
      studentForm.father_phone.value = s.father_phone || '';
      studentForm.mother_name.value = s.mother_name || '';
      studentForm.mother_id.value = s.mother_id || '';
      studentForm.mother_job.value = s.mother_job || '';
      studentForm.mother_phone.value = s.mother_phone || '';
      currentPhotoDataURL = s.photo || '';
      currentDocs = [s.documents && s.documents[0] ? s.documents[0] : null, s.documents && s.documents[1] ? s.documents[1] : null];
      if (currentPhotoDataURL) $('#studentPhotoPreview').innerHTML = `<img src="${currentPhotoDataURL}" alt="" />`;
      if (currentDocs[0]) { $('#studentDoc1Name').textContent = `✓ ${currentDocs[0].name}`; $('#studentDoc1Name').style.color = 'var(--status-good-text)'; }
      if (currentDocs[1]) { $('#studentDoc2Name').textContent = `✓ ${currentDocs[1].name}`; $('#studentDoc2Name').style.color = 'var(--status-good-text)'; }
      $('#regNoPreview').className = 'reg-preview';
      $('#regNoPreview').textContent = s.reg_no + ' (ثابت)';
    } else {
      $('#studentModalTitle').textContent = 'إضافة طالب جديد';
    }
    openModal('studentModal');
  }

  $('#addStudentBtn').addEventListener('click', () => openStudentForm(null));
  $('#studentModalClose').addEventListener('click', () => closeModal('studentModal'));
  $('#studentCancelBtn').addEventListener('click', () => closeModal('studentModal'));

  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = $('#studentFormAlert');
    alertBox.className = 'form-alert';
    const fd = new FormData(studentForm);
    const { fees, total: tuitionFee } = getFeesFromForm();
    const studentId = fd.get('student_id');
    const isNewStudent = !studentId;
    if (!fd.get('class_id') || !fd.get('name')) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = 'يرجى اختيار الصف وإدخال اسم الطالب على الأقل';
      return;
    }
    if (!tuitionFee || tuitionFee <= 0) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = 'يرجى إدخال تفصيل الرسوم (رسم واحد على الأقل بقيمة أكبر من صفر) — هذا الحقل إجباري';
      return;
    }
    let firstPaymentAmount = 0;
    if (isNewStudent) {
      firstPaymentAmount = Number(fd.get('first_payment_amount'));
      if (!fd.get('first_payment_amount') || !firstPaymentAmount || firstPaymentAmount <= 0) {
        alertBox.className = 'form-alert show error';
        alertBox.textContent = 'يرجى إدخال مبلغ الدفعة الأولى (قيمة أكبر من صفر) — هذا الحقل إجباري لأي نوع رسوم';
        return;
      }
      if (!fd.get('first_payment_account_id')) {
        alertBox.className = 'form-alert show error';
        alertBox.textContent = 'يرجى اختيار نوع الرسوم (حساب الإيراد) الخاص بالدفعة الأولى';
        return;
      }
      const discount = Number(fd.get('discount_percent')) || 0;
      const netFee = tuitionFee * (1 - discount / 100);
      if (firstPaymentAmount > netFee + 0.01) {
        alertBox.className = 'form-alert show error';
        alertBox.textContent = `الدفعة الأولى (${fmtMoney(firstPaymentAmount)}) لا يمكن أن تتجاوز صافي الرسوم المستحقة (${fmtMoney(netFee)})`;
        return;
      }
    }
    const payload = {
      class_id: fd.get('class_id'),
      name: fd.get('name'),
      dob: fd.get('dob'),
      gender: fd.get('gender'),
      admission_date: fd.get('admission_date') || todayISO(),
      fees,
      discount_percent: fd.get('discount_percent'),
      guardian_phone: fd.get('guardian_phone'),
      blood_group: fd.get('blood_group'),
      previous_school: fd.get('previous_school'),
      address: fd.get('address'),
      notes: fd.get('notes'),
      photo: currentPhotoDataURL,
      father_name: fd.get('father_name'),
      father_id: fd.get('father_id'),
      father_job: fd.get('father_job'),
      father_phone: fd.get('father_phone'),
      mother_name: fd.get('mother_name'),
      mother_id: fd.get('mother_id'),
      mother_job: fd.get('mother_job'),
      mother_phone: fd.get('mother_phone'),
      documents: currentDocs.filter(Boolean),
    };
    const saveBtn = $('#studentSaveBtn');
    if (saveBtn) saveBtn.disabled = true;
    try {
      let newReceipt = null;
      if (studentId) {
        await AccStore.updateStudent(studentId, payload);
        toast('تم تحديث بيانات الطالب', 'success');
      } else {
        const created = await AccStore.createStudent(payload);
        newReceipt = await AccStore.createReceipt({
          date: payload.admission_date, amount: firstPaymentAmount, party_name: created.name, student_id: created.id,
          method: fd.get('first_payment_method'), account_id: fd.get('first_payment_account_id'),
          description: 'الدفعة الأولى عند القبول',
        });
        toast(`تمت إضافة الطالب (رقم القيد: ${created.reg_no}) وتسجيل الدفعة الأولى بمبلغ ${fmtMoney(firstPaymentAmount)}`, 'success');
      }
      closeModal('studentModal');
      state.studentsPage = 1;
      loadStudents();
      if (newReceipt) printVoucher(newReceipt.id);
    } catch (err) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = 'تعذّر الحفظ — تحقق من الاتصال بالإنترنت وحاول مجددًا';
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });

  // ---------- عرض بطاقة الطالب ----------
  let currentViewStudentId = null;
  const GENDER_LABEL = { male: 'ذكر', female: 'أنثى' };

  function openViewStudent(studentId) {
    const s = AccStore.getStudent(studentId);
    if (!s) return;
    currentViewStudentId = studentId;
    const g = AccStore.gradeById(s.class_id);
    const pay = AccStore.getStudentPayments(s);
    const qrText = `${AccStore.SCHOOL_CODE}|${s.reg_no}`;
    const netFee = (s.tuition_fee || 0) * (1 - (s.discount_percent || 0) / 100);
    const remaining = netFee - pay.totalPaid;

    $('#viewStudentBody').innerHTML = `
      <div class="student-view-head">
        <div class="student-view-photo">${s.photo ? `<img src="${s.photo}" alt="" />` : escapeHtml((s.name || '?').slice(0, 1))}</div>
        <div class="student-view-info">
          <h3>${escapeHtml(s.name)}</h3>
          <div class="sv-meta">
            <span class="sv-chip mono">${s.reg_no}</span>
            <span class="sv-chip">${g ? escapeHtml(g.name) : '—'}</span>
            ${s.gender ? `<span class="sv-chip">${GENDER_LABEL[s.gender] || ''}</span>` : ''}
            <span class="sv-chip">الرسوم: ${fmtMoney(s.tuition_fee || 0)}</span>
            ${s.discount_percent ? `<span class="sv-chip">خصم ${s.discount_percent}%</span>` : ''}
          </div>
        </div>
        <div class="student-view-qr">
          <canvas id="viewStudentQr" data-qr="${escapeHtml(qrText)}"></canvas>
          <span>${escapeHtml(qrText)}</span>
        </div>
      </div>

      <div class="sv-section-title">بيانات التواصل والالتحاق</div>
      <div class="sv-grid">
        <div class="sv-row"><span class="sv-label">جوال ولي الأمر</span><span class="sv-value">${escapeHtml(s.guardian_phone || '—')}</span></div>
        <div class="sv-row"><span class="sv-label">تاريخ الالتحاق</span><span class="sv-value">${s.admission_date ? fmtDate(s.admission_date) : '—'}</span></div>
        <div class="sv-row"><span class="sv-label">تاريخ الميلاد</span><span class="sv-value">${s.dob ? fmtDate(s.dob) : '—'}</span></div>
        <div class="sv-row"><span class="sv-label">فصيلة الدم</span><span class="sv-value">${escapeHtml(s.blood_group || '—')}</span></div>
        <div class="sv-row"><span class="sv-label">المدرسة السابقة</span><span class="sv-value">${escapeHtml(s.previous_school || '—')}</span></div>
        <div class="sv-row"><span class="sv-label">العنوان</span><span class="sv-value">${escapeHtml(s.address || '—')}</span></div>
      </div>

      <div class="sv-section-title">ولي الأمر</div>
      <div class="sv-grid">
        <div class="sv-row"><span class="sv-label">اسم الأب</span><span class="sv-value">${escapeHtml(s.father_name || '—')}</span></div>
        <div class="sv-row"><span class="sv-label">جوال الأب</span><span class="sv-value">${escapeHtml(s.father_phone || '—')}</span></div>
        <div class="sv-row"><span class="sv-label">مهنة الأب</span><span class="sv-value">${escapeHtml(s.father_job || '—')}</span></div>
        <div class="sv-row"><span class="sv-label">اسم الأم</span><span class="sv-value">${escapeHtml(s.mother_name || '—')}</span></div>
        <div class="sv-row"><span class="sv-label">جوال الأم</span><span class="sv-value">${escapeHtml(s.mother_phone || '—')}</span></div>
        <div class="sv-row"><span class="sv-label">مهنة الأم</span><span class="sv-value">${escapeHtml(s.mother_job || '—')}</span></div>
      </div>

      <div class="sv-section-title">تفصيل الرسوم</div>
      <div class="sv-grid">
        ${AccStore.FEE_TYPES.filter((f) => (s.fees || {})[f.id] > 0).map((f) => `
          <div class="sv-row"><span class="sv-label">${escapeHtml(f.label)}</span><span class="sv-value">${fmtMoney(s.fees[f.id])}</span></div>
        `).join('') || '<div class="sv-row"><span class="sv-label">لا توجد رسوم مُفصَّلة</span><span class="sv-value">—</span></div>'}
      </div>

      <div class="sv-section-title">السجل المالي</div>
      <div class="sv-grid">
        <div class="sv-row"><span class="sv-label">إجمالي الرسوم</span><span class="sv-value">${fmtMoney(s.tuition_fee || 0)}</span></div>
        <div class="sv-row"><span class="sv-label">نسبة الخصم</span><span class="sv-value">${s.discount_percent || 0}%</span></div>
        <div class="sv-row"><span class="sv-label">الرسوم بعد الخصم</span><span class="sv-value">${fmtMoney(netFee)}</span></div>
        <div class="sv-row"><span class="sv-label">عدد السندات</span><span class="sv-value">${pay.count}</span></div>
        <div class="sv-row"><span class="sv-label">إجمالي المدفوع</span><span class="sv-value">${fmtMoney(pay.totalPaid)}</span></div>
        <div class="sv-row"><span class="sv-label">المتبقي</span><span class="sv-value" style="color:${remaining > 0 ? 'var(--status-critical)' : 'var(--status-good-text)'}">${fmtMoney(Math.max(0, remaining))}</span></div>
      </div>
      ${s.notes ? `<div class="sv-section-title">ملاحظات</div><p style="font-size:13px;color:var(--ink-secondary);">${escapeHtml(s.notes)}</p>` : ''}
    `;
    try { EduQR.renderToCanvas($('#viewStudentQr'), qrText, { size: 120, margin: 2 }); } catch (e) { /* تجاهل */ }
    openModal('viewStudentModal');
  }

  $('#viewStudentClose').addEventListener('click', () => closeModal('viewStudentModal'));
  $('#viewAddPaymentBtn').addEventListener('click', () => {
    closeModal('viewStudentModal');
    openPaymentModal(currentViewStudentId);
  });
  $('#printStudentCardBtn').addEventListener('click', () => {
    if (currentViewStudentId) printStudentCard(currentViewStudentId);
  });
  $('#printFullStatementBtn').addEventListener('click', () => {
    if (currentViewStudentId) printStudentStatement(currentViewStudentId);
  });

  // ---------- إضافة دفعة لطالب ----------
  const studentPaymentForm = $('#studentPaymentForm');
  fillFeeTypeSelect($('#studentPaymentFeeTypeSelect'), AccStore.FEE_TYPES);

  function openPaymentModal(studentId) {
    const s = AccStore.getStudent(studentId);
    if (!s) return;
    studentPaymentForm.reset();
    studentPaymentForm.student_id.value = s.id;
    studentPaymentForm.date.value = todayISO();
    $('#paymentModalSub').textContent = `تسجيل سند قبض للطالب: ${s.name} (${s.reg_no})`;
    $('#studentPaymentAlert').className = 'form-alert';
    openModal('paymentModal');
  }
  $('#paymentModalClose').addEventListener('click', () => closeModal('paymentModal'));
  $('#studentPaymentCancelBtn').addEventListener('click', () => closeModal('paymentModal'));

  studentPaymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = $('#studentPaymentAlert');
    alertBox.className = 'form-alert';
    const fd = new FormData(studentPaymentForm);
    const amount = Number(fd.get('amount'));
    const studentId = fd.get('student_id');
    const feeTypeId = fd.get('fee_type_id');
    const s = AccStore.getStudent(studentId);
    if (!fd.get('date') || !amount || amount <= 0 || !s || !feeTypeId) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = 'يرجى تعبئة جميع الحقول الإلزامية بمبلغ أكبر من صفر';
      return;
    }
    const submitBtn = document.querySelector('button[form="studentPaymentForm"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const voucher = await AccStore.createReceipt({
        date: fd.get('date'), amount, party_name: s.name, student_id: s.id,
        method: fd.get('method'), fee_type_id: feeTypeId, description: fd.get('description'),
      });
      closeModal('paymentModal');
      toast('تم تسجيل الدفعة وإصدار سند القبض', 'success');
      state.studentsPage = 1;
      loadStudents();
      printVoucher(voucher.id);
    } catch (err) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = 'تعذّر حفظ الدفعة — تحقق من الاتصال بالإنترنت وحاول مجددًا';
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  // ---------- تعبئة قوائم الحسابات في النماذج ----------
  function fillAccountSelect(select, accounts) {
    if (select.dataset.filled) return;
    select.innerHTML = accounts.map((a) => `<option value="${a.id}">${a.code} — ${a.name}</option>`).join('');
    select.dataset.filled = '1';
  }

  // نفس الفكرة لكن لأنواع الرسوم التفصيلية (بدون كود حساب) — تُستخدم في نموذج إضافة دفعة لطالب
  function fillFeeTypeSelect(select, feeTypes) {
    if (select.dataset.filled) return;
    select.innerHTML = feeTypes.map((f) => `<option value="${f.id}">${f.label}</option>`).join('');
    select.dataset.filled = '1';
  }

  // ---------- سندات القبض ----------
  const receiptForm = $('#receiptForm');
  fillAccountSelect($('#receiptAccountSelect'), AccStore.REVENUE_ACCOUNTS);
  receiptForm.date.value = todayISO();

  receiptForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = $('#receiptAlert');
    alertBox.className = 'form-alert';
    const fd = new FormData(receiptForm);
    const amount = Number(fd.get('amount'));
    if (!fd.get('date') || !amount || amount <= 0 || !fd.get('party_name')) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = 'يرجى تعبئة جميع الحقول الإلزامية بمبلغ أكبر من صفر';
      return;
    }
    try {
      await AccStore.createReceipt({
        date: fd.get('date'), amount, party_name: fd.get('party_name'),
        method: fd.get('method'), account_id: fd.get('account_id'), description: fd.get('description'),
      });
      alertBox.className = 'form-alert show success';
      alertBox.textContent = 'تم إضافة سند القبض وتوليد القيد المحاسبي بنجاح';
      receiptForm.reset();
      receiptForm.date.value = todayISO();
      state.receiptsPage = 1;
      loadReceipts();
      toast('تم إضافة سند القبض بنجاح', 'success');
    } catch (err) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = 'تعذّر الحفظ — تحقق من الاتصال بالإنترنت وحاول مجددًا';
    }
  });

  let receiptsDebounce = null;
  $('#receiptSearch').addEventListener('input', (e) => {
    clearTimeout(receiptsDebounce);
    receiptsDebounce = setTimeout(() => { state.receiptsSearch = e.target.value.trim(); state.receiptsPage = 1; loadReceipts(); }, 250);
  });

  function loadReceipts() {
    const { rows, total } = AccStore.listVouchers({ type: 'receipt', search: state.receiptsSearch, page: state.receiptsPage, pageSize: 8 });
    const tbody = $('#receiptsTableBody');
    const empty = $('#receiptsEmpty');
    if (!rows.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); }
    else {
      empty.classList.add('hidden');
      tbody.innerHTML = rows.map((v) => `
        <tr>
          <td class="mono">${v.serial}</td>
          <td>${fmtDate(v.date)}</td>
          <td>${escapeHtml(v.party_name)}</td>
          <td>${AccStore.accountLabel(v.account_id).name}</td>
          <td>${v.method === 'bank' ? 'تحويل بنكي' : 'نقدًا'}</td>
          <td>${fmtMoney(v.amount)}</td>
          <td><div class="row-actions">
            <button class="icon-btn" data-print="${v.id}" title="طباعة / حفظ PDF"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>
            ${currentRole === 'admin' ? `<button class="icon-btn danger" data-delete="${v.id}" title="حذف"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
          </div></td>
        </tr>`).join('');
      tbody.querySelectorAll('[data-print]').forEach((btn) => btn.addEventListener('click', () => printVoucher(btn.dataset.print)));
      tbody.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
        if (!confirm('حذف سند القبض هذا؟ سيُحذف القيد المرتبط به أيضًا.')) return;
        btn.disabled = true;
        const result = await AccStore.deleteVoucher(btn.dataset.delete);
        btn.disabled = false;
        if (!result.ok) { toast(result.error || 'ليست لديك صلاحية لحذف السندات', 'error'); return; }
        toast('تم حذف السند', 'success');
        loadReceipts();
      }));
    }
    renderPagination('receiptsPagInfo', 'receiptsPagPages', total, 8, state.receiptsPage, (p) => { state.receiptsPage = p; loadReceipts(); });
  }

  // ---------- سندات الصرف ----------
  const paymentForm = $('#paymentForm');
  fillAccountSelect($('#paymentAccountSelect'), AccStore.EXPENSE_ACCOUNTS);
  paymentForm.date.value = todayISO();

  paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = $('#paymentAlert');
    alertBox.className = 'form-alert';
    const fd = new FormData(paymentForm);
    const amount = Number(fd.get('amount'));
    if (!fd.get('date') || !amount || amount <= 0 || !fd.get('party_name')) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = 'يرجى تعبئة جميع الحقول الإلزامية بمبلغ أكبر من صفر';
      return;
    }
    try {
      await AccStore.createPayment({
        date: fd.get('date'), amount, party_name: fd.get('party_name'),
        method: fd.get('method'), account_id: fd.get('account_id'), description: fd.get('description'),
      });
      alertBox.className = 'form-alert show success';
      alertBox.textContent = 'تم إضافة سند الصرف وتوليد القيد المحاسبي بنجاح';
      paymentForm.reset();
      paymentForm.date.value = todayISO();
      state.paymentsPage = 1;
      loadPayments();
      toast('تم إضافة سند الصرف بنجاح', 'success');
    } catch (err) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = 'تعذّر الحفظ — تحقق من الاتصال بالإنترنت وحاول مجددًا';
    }
  });

  let paymentsDebounce = null;
  $('#paymentSearch').addEventListener('input', (e) => {
    clearTimeout(paymentsDebounce);
    paymentsDebounce = setTimeout(() => { state.paymentsSearch = e.target.value.trim(); state.paymentsPage = 1; loadPayments(); }, 250);
  });

  function loadPayments() {
    const { rows, total } = AccStore.listVouchers({ type: 'payment', search: state.paymentsSearch, page: state.paymentsPage, pageSize: 8 });
    const tbody = $('#paymentsTableBody');
    const empty = $('#paymentsEmpty');
    if (!rows.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); }
    else {
      empty.classList.add('hidden');
      tbody.innerHTML = rows.map((v) => `
        <tr>
          <td class="mono">${v.serial}</td>
          <td>${fmtDate(v.date)}</td>
          <td>${escapeHtml(v.party_name)}</td>
          <td>${AccStore.accountLabel(v.account_id).name}</td>
          <td>${v.method === 'bank' ? 'تحويل بنكي' : 'نقدًا'}</td>
          <td>${fmtMoney(v.amount)}</td>
          <td><div class="row-actions">
            <button class="icon-btn" data-print="${v.id}" title="طباعة / حفظ PDF"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>
            ${currentRole === 'admin' ? `<button class="icon-btn danger" data-delete="${v.id}" title="حذف"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
          </div></td>
        </tr>`).join('');
      tbody.querySelectorAll('[data-print]').forEach((btn) => btn.addEventListener('click', () => printVoucher(btn.dataset.print)));
      tbody.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
        if (!confirm('حذف سند الصرف هذا؟ سيُحذف القيد المرتبط به أيضًا.')) return;
        btn.disabled = true;
        const result = await AccStore.deleteVoucher(btn.dataset.delete);
        btn.disabled = false;
        if (!result.ok) { toast(result.error || 'ليست لديك صلاحية لحذف السندات', 'error'); return; }
        toast('تم حذف السند', 'success');
        loadPayments();
      }));
    }
    renderPagination('paymentsPagInfo', 'paymentsPagPages', total, 8, state.paymentsPage, (p) => { state.paymentsPage = p; loadPayments(); });
  }

  // ---------- تصفح صفحات مشترك ----------
  function renderPagination(infoId, pagesId, total, pageSize, currentPage, onChange) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    $(`#${infoId}`).textContent = `عرض ${total === 0 ? 0 : (currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} من ${total}`;
    const pagesEl = $(`#${pagesId}`);
    pagesEl.innerHTML = '';
    const prev = document.createElement('button');
    prev.textContent = '›'; prev.disabled = currentPage <= 1;
    prev.addEventListener('click', () => onChange(currentPage - 1));
    pagesEl.appendChild(prev);
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    start = Math.max(1, end - 4);
    for (let p = start; p <= end; p++) {
      const b = document.createElement('button');
      b.textContent = p; b.className = p === currentPage ? 'active' : '';
      b.addEventListener('click', () => onChange(p));
      pagesEl.appendChild(b);
    }
    const next = document.createElement('button');
    next.textContent = '‹'; next.disabled = currentPage >= totalPages;
    next.addEventListener('click', () => onChange(currentPage + 1));
    pagesEl.appendChild(next);
  }

  // ---------- القيود اليومية ----------
  function loadJournal() {
    const entries = AccStore.listJournalEntries();
    const tbody = $('#journalTableBody');
    const empty = $('#journalEmpty');
    if (!entries.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    tbody.innerHTML = entries.map((e) => `
      <tr>
        <td class="mono">${e.serial}</td>
        <td>${fmtDate(e.date)}</td>
        <td>${escapeHtml(e.description)}</td>
        <td><span class="side-chip debit">${AccStore.accountLabel(e.debit_account_id).name}</span></td>
        <td><span class="side-chip credit">${AccStore.accountLabel(e.credit_account_id).name}</span></td>
        <td>${fmtMoney(e.amount)}</td>
      </tr>`).join('');
  }

  $('#exportJournalBtn').addEventListener('click', () => AccStore.exportJournalCSV());
  $('#exportReceiptsBtn').addEventListener('click', () => AccStore.exportJournalCSV());

  // ---------- دفتر الأستاذ ----------
  const ledgerSelect = $('#ledgerAccountSelect');
  if (!ledgerSelect.dataset.filled) {
    ledgerSelect.innerHTML = AccStore.ACCOUNTS.map((a) => `<option value="${a.id}">${a.code} — ${a.name}</option>`).join('');
    ledgerSelect.dataset.filled = '1';
  }
  ledgerSelect.addEventListener('change', loadLedger);

  function loadLedger() {
    const accountId = ledgerSelect.value || AccStore.ACCOUNTS[0].id;
    ledgerSelect.value = accountId;
    const ledger = AccStore.getLedger(accountId);
    const tbody = $('#ledgerTableBody');
    const empty = $('#ledgerEmpty');
    $('#ledgerClosing').innerHTML = `الرصيد الختامي: <b style="color:var(--series-1)">${fmtMoney(ledger.closingBalance)}</b>`;
    if (!ledger.rows.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    tbody.innerHTML = ledger.rows.map((r) => `
      <tr>
        <td class="mono">${r.serial}</td>
        <td>${fmtDate(r.date)}</td>
        <td>${escapeHtml(r.description)}</td>
        <td>${r.debit ? fmtMoney(r.debit) : '—'}</td>
        <td>${r.credit ? fmtMoney(r.credit) : '—'}</td>
        <td><b>${fmtMoney(r.balance)}</b></td>
      </tr>`).join('');
  }

  // ---------- ميزان المراجعة ----------
  function loadTrialBalance() {
    const tb = AccStore.getTrialBalance();
    $('#trialBalanceBody').innerHTML = tb.rows.map((r) => `
      <tr>
        <td class="mono">${r.account.code}</td>
        <td>${r.account.name}</td>
        <td>${r.debit ? fmtMoney(r.debit) : '—'}</td>
        <td>${r.credit ? fmtMoney(r.credit) : '—'}</td>
        <td><b>${fmtMoney(r.balance)}</b></td>
      </tr>`).join('');
    $('#tbTotalDebit').textContent = fmtMoney(tb.totalDebit);
    $('#tbTotalCredit').textContent = fmtMoney(tb.totalCredit);
    const badge = $('#trialBalanceBadge');
    badge.innerHTML = tb.balanced
      ? `<span class="balance-pill ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg> متوازن: مدين = دائن</span>`
      : `<span class="balance-pill bad"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> غير متوازن</span>`;
  }

  // ---------- القوائم المالية ----------
  function loadIncomeStatement() {
    const income = AccStore.getIncomeStatement();
    $('#isRevenue').textContent = fmtMoney(income.totalRevenue);
    $('#isExpense').textContent = fmtMoney(income.totalExpense);
    $('#isNet').textContent = fmtMoney(income.netProfit);
    $('#isNetCard').classList.toggle('negative', income.netProfit < 0);
    $('#isNetCard').querySelector('span').textContent = income.netProfit >= 0 ? 'صافي الربح' : 'صافي الخسارة';

    $('#revenueBreakdownBody').innerHTML = income.revenueRows.map((r) => `
      <tr><td>${r.account.name}</td><td>${fmtMoney(r.amount)}</td></tr>`).join('')
      || '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);">لا توجد بيانات</td></tr>';
    $('#expenseBreakdownBody').innerHTML = income.expenseRows.map((r) => `
      <tr><td>${r.account.name}</td><td>${fmtMoney(r.amount)}</td></tr>`).join('')
      || '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);">لا توجد بيانات</td></tr>';
  }

  // ---------- دليل الحسابات ----------
  const TYPE_LABEL = { asset: 'أصل', revenue: 'إيراد', expense: 'مصروف' };
  const SIDE_LABEL = { debit: 'مدين', credit: 'دائن' };
  function loadAccountsTab() {
    $('#accountsTableBody').innerHTML = AccStore.ACCOUNTS.map((a) => `
      <tr>
        <td class="mono">${a.code}</td>
        <td><span class="coa-dot" style="background:var(${a.colorVar})"></span>${a.name}</td>
        <td><span class="type-chip ${a.type}">${TYPE_LABEL[a.type]}</span></td>
        <td>${SIDE_LABEL[a.normalSide]}</td>
      </tr>`).join('');
  }

  // ---------- المستخدمون (متاح للمسؤول فقط) ----------
  function loadUsersTab() {
    if (currentRole !== 'admin') return;
    const session = AccAuth.getSession();
    const users = AccAuth.listUsers();
    const tbody = $('#usersTableBody');
    tbody.innerHTML = users.map((u) => `
      <tr>
        <td>
          <div class="student-name-cell">
            <div class="student-avatar">${escapeHtml((u.name || u.username).slice(0, 1))}</div>
            <div><div class="sn-name">${escapeHtml(u.username)}</div>${session && session.userId === u.id ? '<div class="sn-reg">هذا حسابك الحالي</div>' : ''}</div>
          </div>
        </td>
        <td>${escapeHtml(u.name || '—')}</td>
        <td><span class="type-chip ${u.role === 'admin' ? 'expense' : 'asset'}">${ROLE_LABEL[u.role] || u.role}</span></td>
        <td><span class="type-chip ${u.active ? 'revenue' : 'expense'}">${u.active ? 'نشط' : 'موقوف'}</span></td>
        <td>${u.createdAt ? fmtDate(new Date(u.createdAt).toISOString()) : '—'}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn edit" data-edit-user="${u.id}" title="تعديل"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
            <button class="icon-btn" data-reset-pwd="${u.id}" title="إعادة تعيين كلمة المرور"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></button>
            <button class="icon-btn" data-toggle-active="${u.id}" title="${u.active ? 'تعطيل الحساب' : 'تفعيل الحساب'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/>${u.active ? '<path d="M9 12h6"/>' : '<path d="M12 9v6M9 12h6"/>'}</svg></button>
            <button class="icon-btn danger" data-delete-user="${u.id}" title="حذف"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </div>
        </td>
      </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">لا يوجد مستخدمون</td></tr>';

    tbody.querySelectorAll('[data-edit-user]').forEach((b) => b.addEventListener('click', () => openEditUserModal(b.dataset.editUser)));
    tbody.querySelectorAll('[data-reset-pwd]').forEach((b) => b.addEventListener('click', () => openResetPwdModal(b.dataset.resetPwd)));
    tbody.querySelectorAll('[data-toggle-active]').forEach((b) => b.addEventListener('click', async () => {
      const u = users.find((x) => x.id === b.dataset.toggleActive);
      if (!u) return;
      b.disabled = true;
      const result = await AccAuth.updateUser(u.id, { name: u.name, role: u.role, active: !u.active });
      b.disabled = false;
      if (!result.ok) { toast(result.error, 'error'); return; }
      toast(u.active ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب', 'success');
      loadUsersTab();
    }));
    tbody.querySelectorAll('[data-delete-user]').forEach((b) => b.addEventListener('click', async () => {
      const u = users.find((x) => x.id === b.dataset.deleteUser);
      if (!confirm(`حذف المستخدم «${u ? u.username : ''}»؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
      b.disabled = true;
      const result = await AccAuth.deleteUser(b.dataset.deleteUser);
      b.disabled = false;
      if (!result.ok) { toast(result.error, 'error'); return; }
      toast('تم حذف المستخدم', 'success');
      loadUsersTab();
    }));
  }

  $('#addUserBtn').addEventListener('click', () => {
    $('#userForm').reset();
    $('#userFormAlert').className = 'form-alert';
    openModal('userModal');
  });
  $('#userModalClose').addEventListener('click', () => closeModal('userModal'));
  $('#userModalCancel').addEventListener('click', () => closeModal('userModal'));
  $('#userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = $('#userFormAlert');
    alertBox.className = 'form-alert';
    const fd = new FormData(e.target);
    const password = fd.get('password');
    const confirmPassword = fd.get('confirm_password');
    if (password !== confirmPassword) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = 'كلمتا المرور غير متطابقتين';
      return;
    }
    const submitBtn = document.querySelector('button[form="userForm"]');
    if (submitBtn) submitBtn.disabled = true;
    const result = await AccAuth.createUser({
      username: fd.get('username'), password, name: fd.get('name'), role: fd.get('role'), email: fd.get('email'),
    });
    if (submitBtn) submitBtn.disabled = false;
    if (!result.ok) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = result.error;
      return;
    }
    closeModal('userModal');
    toast('تم إنشاء المستخدم بنجاح', 'success');
    loadUsersTab();
  });

  function openEditUserModal(userId) {
    const u = AccAuth.listUsers().find((x) => x.id === userId);
    if (!u) return;
    const form = $('#editUserForm');
    form.reset();
    $('#editUserFormAlert').className = 'form-alert';
    form.elements['user_id'].value = u.id;
    form.elements['username'].value = u.username;
    form.elements['name'].value = u.name || '';
    form.elements['role'].value = u.role;
    openModal('editUserModal');
  }
  $('#editUserModalClose').addEventListener('click', () => closeModal('editUserModal'));
  $('#editUserModalCancel').addEventListener('click', () => closeModal('editUserModal'));
  $('#editUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = $('#editUserFormAlert');
    alertBox.className = 'form-alert';
    const fd = new FormData(e.target);
    const userId = fd.get('user_id');
    const existing = AccAuth.listUsers().find((u) => u.id === userId);
    const submitBtn = document.querySelector('button[form="editUserForm"]');
    if (submitBtn) submitBtn.disabled = true;
    const result = await AccAuth.updateUser(userId, {
      name: fd.get('name'), role: fd.get('role'), active: existing ? existing.active : true,
    });
    if (submitBtn) submitBtn.disabled = false;
    if (!result.ok) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = result.error;
      return;
    }
    closeModal('editUserModal');
    toast('تم حفظ التعديلات', 'success');
    const refreshed = AccAuth.refreshSession();
    if (refreshed) applySessionUI(refreshed);
    if (currentRole === 'admin') loadUsersTab(); else switchTab('overview');
  });

  function openResetPwdModal(userId) {
    const u = AccAuth.listUsers().find((x) => x.id === userId);
    if (!u) return;
    $('#resetPwdFormAlert').className = 'form-alert';
    $('#resetPwdUserId').value = u.id;
    $('#resetPwdUserLabel').textContent = `سيُرسَل رابط إعادة التعيين إلى بريد المستخدم: ${u.username}`;
    openModal('resetPwdModal');
  }
  $('#resetPwdModalClose').addEventListener('click', () => closeModal('resetPwdModal'));
  $('#resetPwdModalCancel').addEventListener('click', () => closeModal('resetPwdModal'));
  $('#resetPwdSendBtn').addEventListener('click', async () => {
    const alertBox = $('#resetPwdFormAlert');
    alertBox.className = 'form-alert';
    const userId = $('#resetPwdUserId').value;
    if (!userId) return;
    const btn = $('#resetPwdSendBtn');
    btn.disabled = true;
    const result = await AccAuth.sendPasswordReset(userId);
    btn.disabled = false;
    if (!result.ok) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = result.error;
      return;
    }
    closeModal('resetPwdModal');
    toast('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريد المستخدم', 'success');
  });

  // ---------- الإعدادات ----------
  $('#changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = $('#settingsAlert');
    alertBox.className = 'form-alert';
    const fd = new FormData(e.target);
    const current_password = fd.get('current_password');
    const new_password = fd.get('new_password');
    const confirm_password = fd.get('confirm_password');
    if (new_password !== confirm_password) {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = 'كلمتا المرور الجديدتان غير متطابقتين';
      return;
    }
    const result = await AccAuth.changePassword(current_password, new_password);
    if (result.ok) {
      alertBox.className = 'form-alert show success';
      alertBox.textContent = 'تم تغيير كلمة المرور بنجاح';
      e.target.reset();
    } else {
      alertBox.className = 'form-alert show error';
      alertBox.textContent = result.error;
    }
  });

  // ---------- النسخ الاحتياطي والاستعادة (كل البيانات محلية في هذا المتصفح فقط) ----------
  $('#exportBackupBtn').addEventListener('click', () => {
    AccStore.exportBackupJSON();
    const alertBox = $('#backupAlert');
    alertBox.className = 'form-alert show success';
    alertBox.textContent = 'تم تنزيل ملف النسخة الاحتياطية إلى جهازك';
  });

  let pendingRestoreText = null;
  const importBackupInput = $('#importBackupInput');
  function resetRestorePicker() {
    importBackupInput.value = '';
    pendingRestoreText = null;
  }
  importBackupInput.addEventListener('change', () => {
    const file = importBackupInput.files && importBackupInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingRestoreText = String(reader.result || '');
      $('#confirmRestoreFileName').textContent = file.name;
      openModal('confirmRestoreModal');
    };
    reader.onerror = () => {
      const alertBox = $('#backupAlert');
      alertBox.className = 'form-alert show error';
      alertBox.textContent = 'تعذّرت قراءة الملف المختار';
      resetRestorePicker();
    };
    reader.readAsText(file, 'utf-8');
  });
  $('#confirmRestoreClose').addEventListener('click', () => { closeModal('confirmRestoreModal'); resetRestorePicker(); });
  $('#confirmRestoreCancelBtn').addEventListener('click', () => { closeModal('confirmRestoreModal'); resetRestorePicker(); });
  $('#confirmRestoreOkBtn').addEventListener('click', async () => {
    const alertBox = $('#backupAlert');
    if (!pendingRestoreText) { closeModal('confirmRestoreModal'); return; }
    const okBtn = $('#confirmRestoreOkBtn');
    okBtn.disabled = true;
    okBtn.textContent = 'جارٍ الاستعادة... قد يستغرق ذلك بضع ثوانٍ';
    const result = await AccStore.importBackupJSON(pendingRestoreText);
    okBtn.disabled = false;
    okBtn.textContent = 'نعم، استبدال كل البيانات';
    closeModal('confirmRestoreModal');
    if (!result.ok) {
      resetRestorePicker();
      alertBox.className = 'form-alert show error';
      alertBox.textContent = result.error;
      return;
    }
    resetRestorePicker();
    toast('تمت استعادة النسخة الاحتياطية بنجاح — سيُعاد تحميل الصفحة', 'success');
    setTimeout(() => window.location.reload(), 900);
  });

  // ---------- إغلاق النوافذ المنبثقة بالنقر خارجها أو بمفتاح Esc ----------
  $all('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $all('.modal-overlay:not(.hidden)').forEach((o) => o.classList.add('hidden'));
  });

  // ---------- الطباعة (إيصال سند / بطاقة طالب) — عبر نافذة طباعة المتصفح، يمكن حفظها كـ PDF ----------
  const SCHOOL_PRINT_NAME = 'إديو ستبس - الرياض';
  const SCHOOL_PRINT_COUNTRY = 'المملكة العربية السعودية';

  function printHTML(html) {
    $('#printArea').innerHTML = html;
    setTimeout(() => window.print(), 60);
  }

  function printHeaderHTML(subtitle) {
    return `
      <div class="pr-head">
        <img class="pr-logo" src="../img/logo.jpg" alt="${escapeHtml(SCHOOL_PRINT_NAME)}" />
        <b>${escapeHtml(SCHOOL_PRINT_NAME)}</b>
        <span>${escapeHtml(subtitle || SCHOOL_PRINT_COUNTRY)}</span>
      </div>`;
  }

  function printVoucher(voucherId) {
    const v = AccStore.getVoucher(voucherId);
    if (!v) return;
    const account = AccStore.accountLabel(v.account_id);
    const isReceipt = v.type === 'receipt';
    const qrText = `${AccStore.SCHOOL_CODE}|${v.serial}`;
    const qrId = 'printQr' + Date.now();
    const student = (isReceipt && v.student_id) ? AccStore.getStudent(v.student_id) : null;

    if (student) {
      printHTML(buildFeeReceiptHTML(v, student, account, qrId, qrText));
    } else {
      printHTML(`
        <div class="print-receipt">
          ${printHeaderHTML('النظام المحاسبي المدرسي')}
          <div class="pr-title">${isReceipt ? 'سند قبض' : 'سند صرف'} — ${escapeHtml(v.serial)}</div>
          <div class="pr-row"><span>التاريخ</span><b>${fmtDate(v.date)}</b></div>
          <div class="pr-row"><span>${isReceipt ? 'الاسم (الدافع)' : 'المستفيد'}</span><b>${escapeHtml(v.party_name)}</b></div>
          <div class="pr-row"><span>البند</span><b>${escapeHtml(account ? account.name : '')}</b></div>
          <div class="pr-row"><span>طريقة ${isReceipt ? 'الاستلام' : 'الصرف'}</span><b>${v.method === 'bank' ? 'تحويل بنكي' : 'نقدًا'}</b></div>
          ${v.description ? `<div class="pr-row"><span>ملاحظات</span><b>${escapeHtml(v.description)}</b></div>` : ''}
          <div class="pr-amount">${fmtMoney(v.amount)}</div>
          <div class="pr-qr"><canvas id="${qrId}"></canvas></div>
          <div class="pr-foot">تم الإصدار عبر النظام المحاسبي — ${escapeHtml(SCHOOL_PRINT_NAME)}</div>
        </div>
      `);
    }
    try { EduQR.renderToCanvas(document.getElementById(qrId), qrText, { size: 100, margin: 2 }); } catch (e) { /* تجاهل */ }
  }

  // ---------- إيصال دفع الرسوم التفصيلي (لسندات القبض المرتبطة بطالب) ----------
  function buildFeeReceiptHTML(v, s, account, qrId, qrText) {
    const g = AccStore.gradeById(s.class_id);
    const feeTypeLabel = (v.fee_type_id && AccStore.feeTypeById(v.fee_type_id)) ? AccStore.feeTypeById(v.fee_type_id).label : (account ? account.name : '');
    const pay = AccStore.getStudentPayments(s);
    const netFee = round2((s.tuition_fee || 0) * (1 - (s.discount_percent || 0) / 100));
    const discountAmount = round2((s.tuition_fee || 0) * ((s.discount_percent || 0) / 100));

    // ترتيب سندات الطالب تصاعديًا حسب التاريخ لحساب الرصيد التراكمي عند كل سند
    const ascending = [...pay.rows].sort((a, b) => new Date(a.date) - new Date(b.date) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const cumulativeAt = (index) => round2(ascending.slice(0, index + 1).reduce((sum, r) => sum + r.amount, 0));
    const currentIndex = Math.max(0, ascending.findIndex((r) => r.id === v.id));
    const cumulativeIncluding = cumulativeAt(currentIndex);
    const cumulativeBefore = round2(cumulativeIncluding - v.amount);
    const previousBalance = Math.max(0, round2(netFee - cumulativeBefore));
    const isFirstPayment = cumulativeBefore <= 0;
    const dueBeforeThis = isFirstPayment ? netFee : previousBalance;
    const remainingAfter = Math.max(0, round2(netFee - cumulativeIncluding));

    const feeBreakdownRows = AccStore.FEE_TYPES
      .filter((f) => (s.fees || {})[f.id] > 0)
      .map((f) => ({ label: f.label, amount: s.fees[f.id] }));
    const particularsRows = isFirstPayment
      ? [
          ...(feeBreakdownRows.length ? feeBreakdownRows : [{ label: 'الرسوم الدراسية', amount: s.tuition_fee || 0 }]),
          ...(discountAmount > 0 ? [{ label: 'الخصم على الرسوم', amount: -discountAmount }] : []),
        ]
      : [{ label: 'الرصيد المستحق من دفعات سابقة', amount: previousBalance }];

    return `
      <div class="print-receipt fee-receipt">
        ${printHeaderHTML()}
        <div class="pr-title">إيصال دفع الرسوم — ${escapeHtml(v.serial)}</div>

        <div class="pr-info-grid">
          <div class="pr-info-col">
            <div class="pr-info-item"><span>رقم القيد</span><b class="mono">${escapeHtml(s.reg_no)}</b></div>
            <div class="pr-info-item"><span>اسم الطالب</span><b>${escapeHtml(s.name)}</b></div>
            <div class="pr-info-item"><span>ولي الأمر</span><b>${escapeHtml(s.father_name || v.party_name || '—')}</b></div>
            <div class="pr-info-item"><span>الصف / المرحلة</span><b>${g ? escapeHtml(g.name) : '—'}</b></div>
          </div>
          <div class="pr-info-col">
            <div class="pr-info-item"><span>الرقم التسلسلي</span><b class="mono">${escapeHtml(v.serial)}</b></div>
            <div class="pr-info-item"><span>تاريخ السند</span><b>${fmtDate(v.date)}</b></div>
            <div class="pr-info-item"><span>نوع الرسوم</span><b>${escapeHtml(feeTypeLabel)}</b></div>
            <div class="pr-info-item"><span>طريقة الدفع</span><b>${v.method === 'bank' ? 'تحويل بنكي' : 'نقدًا'}</b></div>
          </div>
          <div class="pr-info-col pr-info-amounts">
            <div class="pr-info-item"><span>إجمالي الرسوم (بعد الخصم)</span><b>${fmtMoney(netFee)}</b></div>
            <div class="pr-info-item"><span>المبلغ المدفوع في هذا السند</span><b class="good">${fmtMoney(v.amount)}</b></div>
            <div class="pr-info-item"><span>المتبقي بعد هذا السند</span><b class="${remainingAfter > 0 ? 'warn' : 'good'}">${fmtMoney(remainingAfter)}</b></div>
          </div>
        </div>

        <table class="pr-table">
          <thead><tr><th>م</th><th>البيان</th><th>المبلغ</th></tr></thead>
          <tbody>
            ${particularsRows.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(r.label)}</td><td>${fmtMoney(r.amount)}</td></tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><td colspan="2">الإجمالي المستحق</td><td>${fmtMoney(dueBeforeThis)}</td></tr>
            <tr><td colspan="2">المدفوع في هذا السند</td><td>${fmtMoney(v.amount)}</td></tr>
            <tr class="pr-table-due"><td colspan="2">المتبقي</td><td>${fmtMoney(remainingAfter)}</td></tr>
          </tfoot>
        </table>

        <div class="pr-qr"><canvas id="${qrId}"></canvas></div>

        <div class="pr-signoff">
          <div><span>إعداد</span><b>${escapeHtml(SCHOOL_PRINT_NAME)}</b></div>
          <div><span>اعتماد</span><b>ــــــــــــــــــ</b></div>
        </div>
        <div class="pr-foot">قسم الحسابات — ${escapeHtml(SCHOOL_PRINT_NAME)}</div>
      </div>
    `;
  }

  function printStudentCard(studentId) {
    const s = AccStore.getStudent(studentId);
    if (!s) return;
    const g = AccStore.gradeById(s.class_id);
    const qrText = `${AccStore.SCHOOL_CODE}|${s.reg_no}`;
    const qrId = 'printQr' + Date.now();
    printHTML(`
      <div class="print-receipt">
        ${printHeaderHTML('بطاقة تعريف الطالب')}
        <div class="pr-title">${escapeHtml(s.name)}</div>
        <div class="pr-row"><span>رقم القيد</span><b class="mono">${s.reg_no}</b></div>
        <div class="pr-row"><span>الصف / المرحلة</span><b>${g ? escapeHtml(g.name) : '—'}</b></div>
        <div class="pr-row"><span>تاريخ الالتحاق</span><b>${s.admission_date ? fmtDate(s.admission_date) : '—'}</b></div>
        <div class="pr-row"><span>جوال ولي الأمر</span><b>${escapeHtml(s.guardian_phone || '—')}</b></div>
        <div class="pr-qr"><canvas id="${qrId}"></canvas></div>
        <div class="pr-foot">${escapeHtml(SCHOOL_PRINT_NAME)} — تعريف سريع عبر مسح رمز QR</div>
      </div>
    `);
    try { EduQR.renderToCanvas(document.getElementById(qrId), qrText, { size: 130, margin: 2 }); } catch (e) { /* تجاهل */ }
  }

  // ---------- كشف كامل بجميع سندات القبض الخاصة بطالب (مستند واحد منفصل، بخلاف إيصال كل سند الذي يُطبع وحده الآن) ----------
  function printStudentStatement(studentId) {
    const s = AccStore.getStudent(studentId);
    if (!s) return;
    const qrText = `${AccStore.SCHOOL_CODE}|${s.reg_no}`;
    const qrId = 'printQr' + Date.now();
    printHTML(buildStudentStatementHTML(s, qrId, qrText));
    try { EduQR.renderToCanvas(document.getElementById(qrId), qrText, { size: 100, margin: 2 }); } catch (e) { /* تجاهل */ }
  }

  function buildStudentStatementHTML(s, qrId, qrText) {
    const g = AccStore.gradeById(s.class_id);
    const pay = AccStore.getStudentPayments(s);
    const netFee = round2((s.tuition_fee || 0) * (1 - (s.discount_percent || 0) / 100));
    const discountAmount = round2((s.tuition_fee || 0) * ((s.discount_percent || 0) / 100));
    const remaining = Math.max(0, round2(netFee - pay.totalPaid));

    // ترتيب السندات تصاعديًا حسب التاريخ لحساب المتبقي التراكمي بعد كل سند
    const ascending = [...pay.rows].sort((a, b) => new Date(a.date) - new Date(b.date) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const cumulativeAt = (index) => round2(ascending.slice(0, index + 1).reduce((sum, r) => sum + r.amount, 0));
    const statementRows = ascending.map((r, i) => ({ ...r, dueAfter: Math.max(0, round2(netFee - cumulativeAt(i))) }));

    const feeBreakdownRows = AccStore.FEE_TYPES
      .filter((f) => (s.fees || {})[f.id] > 0)
      .map((f) => ({ label: f.label, amount: s.fees[f.id] }));

    return `
      <div class="print-receipt fee-receipt">
        ${printHeaderHTML()}
        <div class="pr-title">كشف كامل بسندات القبض — ${escapeHtml(s.name)}</div>

        <div class="pr-info-grid">
          <div class="pr-info-col">
            <div class="pr-info-item"><span>رقم القيد</span><b class="mono">${escapeHtml(s.reg_no)}</b></div>
            <div class="pr-info-item"><span>اسم الطالب</span><b>${escapeHtml(s.name)}</b></div>
            <div class="pr-info-item"><span>ولي الأمر</span><b>${escapeHtml(s.father_name || '—')}</b></div>
            <div class="pr-info-item"><span>الصف / المرحلة</span><b>${g ? escapeHtml(g.name) : '—'}</b></div>
          </div>
          <div class="pr-info-col">
            <div class="pr-info-item"><span>تاريخ الطباعة</span><b>${fmtDate(todayISO())}</b></div>
            <div class="pr-info-item"><span>عدد السندات</span><b>${statementRows.length}</b></div>
            <div class="pr-info-item"><span>نسبة الخصم</span><b>${s.discount_percent || 0}%</b></div>
          </div>
          <div class="pr-info-col pr-info-amounts">
            <div class="pr-info-item"><span>إجمالي الرسوم (بعد الخصم)</span><b>${fmtMoney(netFee)}</b></div>
            <div class="pr-info-item"><span>إجمالي المدفوع</span><b class="good">${fmtMoney(pay.totalPaid)}</b></div>
            <div class="pr-info-item"><span>المتبقي</span><b class="${remaining > 0 ? 'warn' : 'good'}">${fmtMoney(remaining)}</b></div>
          </div>
        </div>

        ${feeBreakdownRows.length ? `
        <table class="pr-table">
          <thead><tr><th>م</th><th>البيان</th><th>المبلغ</th></tr></thead>
          <tbody>
            ${feeBreakdownRows.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(r.label)}</td><td>${fmtMoney(r.amount)}</td></tr>`).join('')}
            ${discountAmount > 0 ? `<tr><td>${feeBreakdownRows.length + 1}</td><td>الخصم على الرسوم</td><td>-${fmtMoney(discountAmount)}</td></tr>` : ''}
          </tbody>
        </table>` : ''}

        <div class="pr-statement-title">كشف سندات القبض (${statementRows.length} سند)</div>
        ${statementRows.length ? `
        <table class="pr-table pr-statement">
          <thead><tr><th>م</th><th>رقم السند</th><th>التاريخ</th><th>نوع الرسوم</th><th>المبلغ</th><th>طريقة الدفع</th><th>المتبقي بعده</th></tr></thead>
          <tbody>
            ${statementRows.map((r, i) => `
              <tr>
                <td>${i + 1}</td><td class="mono">${escapeHtml(r.serial)}</td><td>${fmtDate(r.date)}</td>
                <td>${escapeHtml((r.fee_type_id && AccStore.feeTypeById(r.fee_type_id)) ? AccStore.feeTypeById(r.fee_type_id).label : AccStore.accountLabel(r.account_id).name)}</td>
                <td>${fmtMoney(r.amount)}</td><td>${r.method === 'bank' ? 'بنكي' : 'نقدًا'}</td><td>${fmtMoney(r.dueAfter)}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><td colspan="4">الإجمالي المدفوع</td><td>${fmtMoney(pay.totalPaid)}</td><td colspan="2"></td></tr>
          </tfoot>
        </table>` : `<p style="text-align:center;color:#999;font-size:12.5px;padding:20px 0;">لا توجد سندات قبض بعد لهذا الطالب</p>`}

        <div class="pr-qr"><canvas id="${qrId}"></canvas></div>

        <div class="pr-signoff">
          <div><span>إعداد</span><b>${escapeHtml(SCHOOL_PRINT_NAME)}</b></div>
          <div><span>اعتماد</span><b>ــــــــــــــــــ</b></div>
        </div>
        <div class="pr-foot">قسم الحسابات — ${escapeHtml(SCHOOL_PRINT_NAME)}</div>
      </div>
    `;
  }

  // ---------- التهيئة ----------
  function initApp() {
    if (appInitialized) { loadOverview(); return; }
    appInitialized = true;
    switchTab('overview');
  }

  // ---------- تحديث حي: يُعاد رسم التبويب الحالي تلقائيًا فور وصول أي تغيير من Firestore (من نفس الجهاز أو من جهاز آخر) ----------
  const TAB_LOADERS = {
    overview: loadOverview, students: loadStudents, receipts: loadReceipts, payments: loadPayments,
    journal: loadJournal, ledger: loadLedger, 'trial-balance': loadTrialBalance,
    'income-statement': loadIncomeStatement, accounts: loadAccountsTab, users: loadUsersTab,
  };
  document.addEventListener('acc:data-changed', () => {
    if (!appInitialized) return;
    if ($('#appShell').classList.contains('hidden')) return;
    const loader = state.currentTab && TAB_LOADERS[state.currentTab];
    if (loader) loader();
  });

  // تبديل اللغة (عربي/إنجليزي): يعيد رسم التبويب الحالي فورًا حتى تُنسَّق الأرقام والتواريخ
  // بالصيغة الصحيحة للغة الجديدة (fmtMoney/fmtDate) بدل انتظار طبقة الترجمة النصية وحدها
  document.addEventListener('lang:changed', () => {
    if (!appInitialized) return;
    if ($('#appShell').classList.contains('hidden')) return;
    const loader = state.currentTab && TAB_LOADERS[state.currentTab];
    if (loader) loader();
  });

  checkSession();
})();
