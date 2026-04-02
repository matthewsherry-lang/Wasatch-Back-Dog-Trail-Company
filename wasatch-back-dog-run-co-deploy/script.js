const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');
const WAIVER_STORAGE_KEY = 'wbdr_waiver_submission';

if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('open');
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    }
  },
  { threshold: 0.2 }
);

document.querySelectorAll('.section, .highlights article').forEach((node) => {
  node.classList.add('reveal');
  observer.observe(node);
});

const paymentQr = document.querySelector('.payment-qr');
if (paymentQr) {
  paymentQr.addEventListener('error', () => {
    const wrap = paymentQr.closest('.qr-wrap');
    if (wrap) {
      wrap.classList.add('missing');
    }
  });
}

function readWaiverData() {
  try {
    const raw = localStorage.getItem(WAIVER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeWaiverData(payload) {
  localStorage.setItem(WAIVER_STORAGE_KEY, JSON.stringify(payload));
}

const waiverForm = document.querySelector('#waiver-form');
if (waiverForm) {
  const waiverStatus = document.querySelector('#waiver-status');
  const waiverOwnerEmailInput = waiverForm.querySelector('input[name="owner_email"]');
  const waiverCcInput = waiverForm.querySelector('#waiver-cc');
  const waiverReplyToInput = waiverForm.querySelector('#waiver-replyto');
  const existing = readWaiverData();
  if (existing && waiverStatus) {
    waiverStatus.textContent = `Waiver saved on ${existing.completed_at}.`;
  }

  waiverForm.addEventListener('submit', (event) => {
    const formData = new FormData(waiverForm);
    const payload = {};

    for (const [key, value] of formData.entries()) {
      payload[key] = String(value).trim();
    }

    const ownerEmail = waiverOwnerEmailInput?.value?.trim() || '';
    if (waiverCcInput) {
      waiverCcInput.value = ownerEmail;
    }
    if (waiverReplyToInput) {
      waiverReplyToInput.value = ownerEmail;
    }

    const completedAt = new Date().toLocaleString();
    payload.completed_at = completedAt;
    writeWaiverData(payload);

    if (waiverStatus) {
      waiverStatus.textContent = `Waiver saved on ${completedAt}. Submitting...`;
    }
  });
}

const bookingForm = document.querySelector('.booking-form');
if (bookingForm) {
  const waiverCompletedInput = document.querySelector('#waiver-completed-at');
  const waiverSubmissionInput = document.querySelector('#waiver-submission');
  const waiverBookingStatus = document.querySelector('#waiver-booking-status');
  const serviceSelect = document.querySelector('#service-select');
  const addonCheckboxes = bookingForm.querySelectorAll('input[name="add_ons[]"]');
  const costAmount = document.querySelector('#cost-amount');
  const selectedTotalInput = document.querySelector('#selected-total');
  const payNowBtn = document.querySelector('#pay-now-btn');
  const bookingEmailInput = bookingForm.querySelector('input[name="email"]');
  const bookingCcInput = document.querySelector('#book-cc');
  const bookingReplyToInput = document.querySelector('#book-replyto');
  const weekdayCheckboxes = bookingForm.querySelectorAll('input[name="preferred_days[]"]');
  const preferredDaysHelp = document.querySelector('#preferred-days-help');
  const pickupCitySelect = document.querySelector('#pickup-city');
  const optionalTipInput = document.querySelector('#optional-tip');

  const readPrice = (selectNode) => {
    if (!selectNode) return 0;
    const selectedOption = selectNode.options[selectNode.selectedIndex];
    const raw = selectedOption?.dataset?.price || '0';
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const readDays = () => {
    if (!serviceSelect) return 1;
    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    const raw = selectedOption?.dataset?.days || '1';
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 1;
  };

  const readRequiredDays = () => {
    if (!serviceSelect) return 0;
    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    if (!selectedOption?.value) return 0;
    const raw = selectedOption?.dataset?.days || '0';
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const syncPreferredDayLimit = () => {
    const requiredDays = readRequiredDays();
    const checked = Array.from(weekdayCheckboxes).filter((box) => box.checked);

    if (requiredDays === 0) {
      weekdayCheckboxes.forEach((box) => {
        box.checked = false;
        box.disabled = true;
        box.closest('label')?.classList.add('disabled-day');
      });
      if (preferredDaysHelp) {
        preferredDaysHelp.textContent = 'Select a preferred service first.';
      }
      return;
    }

    while (checked.length > requiredDays) {
      const box = checked.pop();
      if (box) {
        box.checked = false;
      }
    }

    const selectedCount = Array.from(weekdayCheckboxes).filter((box) => box.checked).length;
    const atLimit = selectedCount >= requiredDays;

    weekdayCheckboxes.forEach((box) => {
      const disable = atLimit && !box.checked;
      box.disabled = disable;
      box.closest('label')?.classList.toggle('disabled-day', disable);
    });

    if (preferredDaysHelp) {
      preferredDaysHelp.textContent =
        selectedCount === requiredDays
          ? `Great. You selected ${requiredDays} day${requiredDays > 1 ? 's' : ''}.`
          : `Select ${requiredDays} day${requiredDays > 1 ? 's' : ''} for this package.`;
    }
  };

  const syncCost = () => {
    const baseService = readPrice(serviceSelect);
    const packageDays = readDays();
    let addonTotal = 0;
    addonCheckboxes.forEach((box) => {
      if (!box.checked) return;
      const addonPrice = Number.parseInt(box.dataset.price || '0', 10);
      const perDay = box.dataset.perDay === 'true';
      addonTotal += (Number.isFinite(addonPrice) ? addonPrice : 0) * (perDay ? packageDays : 1);
    });
    const cityOption = pickupCitySelect?.options?.[pickupCitySelect.selectedIndex];
    const cityPrice = Number.parseInt(cityOption?.dataset?.price || '0', 10);
    const cityPerDay = cityOption?.dataset?.perDay === 'true';
    const cityTotal = (Number.isFinite(cityPrice) ? cityPrice : 0) * (cityPerDay ? packageDays : 1);
    const tipValue = Number.parseInt(optionalTipInput?.value || '0', 10);
    const tipTotal = Number.isFinite(tipValue) && tipValue > 0 ? tipValue : 0;
    const total = baseService + addonTotal + cityTotal + tipTotal;
    const formatted = `$${total}`;
    if (costAmount) {
      costAmount.textContent = formatted;
    }
    if (selectedTotalInput) {
      selectedTotalInput.value = formatted;
    }
  };

  const syncWaiverStatus = () => {
    const waiverData = readWaiverData();
    if (!waiverData) {
      if (waiverBookingStatus) {
        waiverBookingStatus.innerHTML = '<a href="waiver.html">Complete the waiver before submitting this form.</a>';
      }
      return false;
    }

    if (waiverCompletedInput) {
      waiverCompletedInput.value = waiverData.completed_at || '';
    }
    if (waiverSubmissionInput) {
      waiverSubmissionInput.value = JSON.stringify(waiverData);
    }
    if (waiverBookingStatus) {
      waiverBookingStatus.textContent = `Waiver on file from ${waiverData.completed_at}.`;
    }
    return true;
  };

  syncWaiverStatus();
  syncCost();

  if (serviceSelect) {
    serviceSelect.addEventListener('change', () => {
      syncCost();
      syncPreferredDayLimit();
    });
  }
  addonCheckboxes.forEach((box) => box.addEventListener('change', syncCost));
  weekdayCheckboxes.forEach((box) =>
    box.addEventListener('change', () => {
      syncPreferredDayLimit();
    })
  );
  if (pickupCitySelect) {
    pickupCitySelect.addEventListener('change', syncCost);
  }
  if (optionalTipInput) {
    optionalTipInput.addEventListener('input', syncCost);
    optionalTipInput.addEventListener('change', syncCost);
  }

  syncPreferredDayLimit();

  if (payNowBtn) {
    payNowBtn.addEventListener('click', () => {
      syncCost();
      const hasWaiver = syncWaiverStatus();
      if (!hasWaiver) {
        alert('Please complete and save the waiver before payment.');
        window.location.href = 'waiver.html';
        return;
      }
      window.location.href = 'payment.html';
    });
  }

  bookingForm.addEventListener('submit', (event) => {
    syncCost();
    const bookingEmail = bookingEmailInput?.value?.trim() || '';
    if (bookingCcInput) {
      bookingCcInput.value = bookingEmail;
    }
    if (bookingReplyToInput) {
      bookingReplyToInput.value = bookingEmail;
    }

    const selectedWeekdays = Array.from(weekdayCheckboxes).filter((box) => box.checked).length;
    const requiredDays = readRequiredDays();
    if (selectedWeekdays !== requiredDays) {
      event.preventDefault();
      alert(`Please select exactly ${requiredDays} preferred day${requiredDays > 1 ? 's' : ''}.`);
      return;
    }

    const hasWaiver = syncWaiverStatus();
    if (!hasWaiver) {
      event.preventDefault();
      alert('Please complete and save the waiver first.');
    }
  });
}
