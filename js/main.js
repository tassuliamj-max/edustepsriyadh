(function () {
  'use strict';

  document.getElementById('year').textContent = new Date().getFullYear();

  // ---------- قائمة الجوال ----------
  const navToggle = document.getElementById('navToggle');
  const navMobile = document.getElementById('navMobile');
  navToggle.addEventListener('click', () => navMobile.classList.toggle('open'));
  navMobile.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => navMobile.classList.remove('open')));

  // ---------- تأثير الظهور عند التمرير ----------
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  // ---------- جدول دليل الحسابات ----------
  const TYPE_LABEL = { asset: 'أصل', revenue: 'إيراد', expense: 'مصروف' };
  const SIDE_LABEL = { debit: 'مدين', credit: 'دائن' };
  const tbody = document.querySelector('#coaTable tbody');
  if (tbody && window.AccStore) {
    tbody.innerHTML = AccStore.ACCOUNTS.map((a) => `
      <tr>
        <td><span class="coa-dot" style="background:var(${a.colorVar})"></span>${a.code}</td>
        <td>${a.name}</td>
        <td><span class="type-chip ${a.type}">${TYPE_LABEL[a.type]}</span></td>
        <td>${SIDE_LABEL[a.normalSide]}</td>
      </tr>
    `).join('');
  }
})();
