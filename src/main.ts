declare var bootstrap: any;

import { initializeApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  runTransaction,
  setDoc
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBGm7sSnDt0pTKd34PXK3a8oVajmdj5AjU',
  authDomain: 'annamassage-68e80.firebaseapp.com',
  projectId: 'annamassage-68e80',
  storageBucket: 'annamassage-68e80.firebasestorage.app',
  messagingSenderId: '624857790803',
  appId: '1:624857790803:web:5ffd6ed8f12aeb146189a6',
  measurementId: 'G-NCDVS3Z1E9'
};

const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);
const daysCollection = collection(firestore, 'days');
const adminSettingsDocument = doc(firestore, 'settings', 'auth');
let stopDaysListener: (() => void) | null = null;

interface Slot {
  id: string;
  time: string;
  isBooked: boolean;
  clientName: string;
  clientPhone: string;
}

interface Day {
  id: string;
  dayOfWeek: string;
  date: string;
  month: string;
  slots: Slot[];
}
interface GoogleCalendarEvent {
  clientName: string;
  clientPhone: string;
  date: string;
  month: string;
  time: string;
  year: number;
}
const googleCalendarApiUrl = 'https://us-central1-annamassage-68e80.cloudfunctions.net/createCalendarEvent';

async function createGoogleCalendarEvent(event: GoogleCalendarEvent): Promise<void> {
  if (!googleCalendarApiUrl) return;

  const response = await fetch(googleCalendarApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });

  if (!response.ok) throw new Error('Не удалось создать событие в Google Calendar');
}

async function loadDB(): Promise<Day[]> {
  const snapshot = await getDocs(daysCollection);
  const firestoreDays = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Day));

  if (firestoreDays.length > 0) return firestoreDays;

  const legacyData = localStorage.getItem('massageDB');
  if (!legacyData) return [];

  const legacyDays = (JSON.parse(legacyData) as Day[]).map(day => ({
    ...day,
    slots: day.slots.map(slot => ({
      ...slot,
      clientName: slot.clientName ?? '',
      clientPhone: slot.clientPhone ?? ''
    }))
  }));
  await Promise.all(legacyDays.map(day => setDoc(doc(daysCollection, day.id), day)));
  localStorage.removeItem('massageDB');
  return legacyDays;
}

async function loadAdminPassword(): Promise<string> {
  const snapshot = await getDoc(adminSettingsDocument);
  const password = snapshot.data()?.password;

  if (!snapshot.exists() || typeof password !== 'string' || !password) {
    throw new Error('В Firestore не найден пароль администратора');
  }

  return password;
}

async function saveDay(day: Day) {
  await setDoc(doc(daysCollection, day.id), day);
}

function getFirebaseErrorMessage(error: unknown): string {
      year: new Date().getFullYear()
  return error instanceof Error ? error.message : 'Неизвестная ошибка Firebase';
}

function subscribeToDays() {
  stopDaysListener?.();
  stopDaysListener = onSnapshot(daysCollection, snapshot => {
    db = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Day));
    renderApp();
  }, error => {
    console.error('Не удалось синхронизировать расписание с Firestore', error);
    alert('Нет доступа к базе Firebase. Проверьте Firestore Rules и интернет.');
  });
}

let db: Day[] = [];
let adminPassword = '';
let currentSelectedDay: Day | null = null;
let currentSelectedSlot: Slot | null = null;
const adminSessionKey = 'massageAdminSession';
const adminSessionCookie = 'massageAdminSession=true';
let isAdmin = localStorage.getItem(adminSessionKey) === 'true' || document.cookie.includes(adminSessionCookie);

let modalInstance: any = null;
let loginModalInstance: any = null;

// DOM Elements
const clientView = document.getElementById('clientView');
const adminView = document.getElementById('adminView');
const calendarContainer = document.getElementById('calendar-container');
const adminCalendarContainer = document.getElementById('admin-calendar-container');
const homeLogo = document.getElementById('homeLogo');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');

document.addEventListener('DOMContentLoaded', async () => {
  modalInstance = new bootstrap.Modal(document.getElementById('mainModal'));
  loginModalInstance = new bootstrap.Modal(document.getElementById('loginModal'));

  try {
    db = await loadDB();
    adminPassword = await loadAdminPassword();
    subscribeToDays();
  } catch (error) {
    console.error('Не удалось загрузить данные из Firestore', error);
    alert('Не удалось загрузить данные для входа. Проверьте подключение к Firebase.');
  }

  renderApp();

  document.getElementById('reserveNowBtn')?.addEventListener('click', () => {
    document.getElementById('calendar-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const logout = () => {
    isAdmin = false;
    localStorage.removeItem(adminSessionKey);
    document.cookie = 'massageAdminSession=; max-age=0; path=/';
    renderApp();
  };

  loginBtn?.addEventListener('click', () => loginModalInstance.show());
  logoutBtn?.addEventListener('click', logout);
  homeLogo?.addEventListener('click', event => {
    event.preventDefault();
    logout();
  });

  const loginWithPassword = () => {
    const pass = (document.getElementById('adminPassword') as HTMLInputElement).value;
    if (adminPassword && pass === adminPassword) {
      isAdmin = true;
      localStorage.setItem(adminSessionKey, 'true');
      document.cookie = 'massageAdminSession=true; max-age=31536000; path=/';
      (document.getElementById('adminPassword') as HTMLInputElement).value = '';
      loginModalInstance.hide();
      renderApp();
    } else {
      alert('Неверный пароль');
    }
  };

  document.getElementById('authBtn')?.addEventListener('click', loginWithPassword);
  document.getElementById('adminPassword')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      loginWithPassword();
    }
  });

  document.getElementById('addSlotBtn')?.addEventListener('click', addNewSlot);
});

function renderApp() {
  if (isAdmin) {
    clientView?.classList.add('hidden');
    loginBtn?.classList.add('hidden');
    adminView?.classList.remove('hidden');
    logoutBtn?.classList.remove('hidden');
    renderAdminCalendar();
  } else {
    adminView?.classList.add('hidden');
    logoutBtn?.classList.add('hidden');
    clientView?.classList.remove('hidden');
    loginBtn?.classList.remove('hidden');
    renderClientCalendar();
  }
}

// --- КЛИЕНТСКАЯ ЧАСТЬ ---
function renderClientCalendar() {
  if (!calendarContainer) return;
  calendarContainer.innerHTML = '';

  db.forEach(day => {
    const hasFreeSlots = day.slots.some(slot => !slot.isBooked);
    if (!hasFreeSlots) return;

    const col = document.createElement('div');
    col.className = 'col';
    col.innerHTML = `
      <div class="card calendar-card text-center p-3">
        <h5 class="mb-0">${day.dayOfWeek}</h5>
        <h2 class="fw-bold text-purple my-2">${day.date}</h2>
        <small class="text-muted">${day.month}</small>
      </div>
    `;
    col.addEventListener('click', () => openDayModal(day));
    calendarContainer.appendChild(col);
  });
}

function openDayModal(day: Day) {
  currentSelectedDay = day;
  if (!modalTitle || !modalBody) return;

  modalTitle.textContent = `Horarios: ${day.date} ${day.month}`;
  let html = `<p class="text-muted mb-4">Seleccione la hora para su cita:</p><div class="d-grid gap-3">`;
  
  day.slots.forEach(slot => {
    if (!slot.isBooked) {
      html += `<button class="btn btn-slot py-2" data-slot-id="${slot.id}">${slot.time}</button>`;
    }
  });
  html += `</div>`;
  modalBody.innerHTML = html;

  modalBody.querySelectorAll('.btn-slot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const slotId = (e.target as HTMLButtonElement).getAttribute('data-slot-id');
      const selectedSlot = day.slots.find(s => s.id === slotId);
      if (selectedSlot) showBookingForm(selectedSlot);
    });
  });

  modalInstance.show();
}

function normalizeBookingName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function validateBookingName(value: string): string | null {
  const normalized = normalizeBookingName(value);

  if (!normalized) return 'Por favor, escribe tu nombre.';
  if (normalized.length < 2) return 'El nombre debe tener al menos 2 caracteres.';
  if (!/^[A-Za-zА-Яа-яЁё\s'.-]+$/.test(normalized)) {
    return 'El nombre solo puede contener letras, espacios y signos básicos.';
  }

  return null;
}

function setFieldError(input: HTMLInputElement | null, message: string | null) {
  if (!input) return;

  const fieldName = input.id;
  const feedback = document.getElementById(`${fieldName}Error`);

  input.classList.toggle('is-invalid', Boolean(message));
  input.classList.toggle('is-valid', !message && input.value.trim() !== '');

  if (feedback) {
    feedback.textContent = message ?? '';
    feedback.style.display = message ? 'block' : 'none';
  }
}

function formatBookingPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function validateBookingPhone(value: string): string | null {
  const cleaned = value.replace(/\s+/g, '').replace(/[()\-]/g, '');

  if (!cleaned) return 'Por favor, introduce tu teléfono.';
  if (!/^(?:\+34|34)?[679]\d{8}$/.test(cleaned)) {
    return 'Introduce un teléfono válido, por ejemplo 600 000 000.';
  }

  return null;
}

function showBookingForm(slot: Slot) {
  currentSelectedSlot = slot;
  if (!modalTitle || !modalBody) return;

  modalTitle.textContent = `Confirmar reserva: ${slot.time}`;
  modalBody.innerHTML = `
    <div class="text-start">
      <div class="mb-3">
        <label class="form-label fw-bold">Su nombre</label>
        <input type="text" id="clientName" class="form-control" placeholder="Ej: Juan Pérez" required minlength="2" autocomplete="name">
        <div class="invalid-feedback d-block" id="clientNameError"></div>
      </div>
      <div class="mb-4">
        <label class="form-label fw-bold">Su teléfono</label>
        <input type="tel" id="clientPhone" class="form-control" placeholder="600 000 000" required inputmode="tel" autocomplete="tel">
        <div class="invalid-feedback d-block" id="clientPhoneError"></div>
      </div>
      <button class="btn w-100 py-2 fw-bold" id="confirmBtn" style="background-color: #6f42c1; color: white;">
        Confirmar cita
      </button>
      <button class="btn btn-link text-muted w-100 mt-2" id="backBtn">Volver a los horarios</button>
    </div>
  `;

  const nameInput = document.getElementById('clientName') as HTMLInputElement;
  const phoneInput = document.getElementById('clientPhone') as HTMLInputElement;

  nameInput.addEventListener('input', () => {
    nameInput.value = normalizeBookingName(nameInput.value);
    setFieldError(nameInput, null);
  });

  phoneInput.addEventListener('input', () => {
    phoneInput.value = formatBookingPhone(phoneInput.value);
    setFieldError(phoneInput, null);
  });

  document.getElementById('backBtn')?.addEventListener('click', () => openDayModal(currentSelectedDay!));
  document.getElementById('confirmBtn')?.addEventListener('click', submitBooking);
}

async function submitBooking() {
  const nameInputElement = document.getElementById('clientName') as HTMLInputElement | null;
  const phoneInputElement = document.getElementById('clientPhone') as HTMLInputElement | null;

  const nameInput = nameInputElement?.value ?? '';
  const phoneInput = phoneInputElement?.value ?? '';

  const nameError = validateBookingName(nameInput);
  if (nameError) {
    setFieldError(nameInputElement, nameError);
    nameInputElement?.focus();
    return;
  }

  const phoneError = validateBookingPhone(phoneInput);
  if (phoneError) {
    setFieldError(phoneInputElement, phoneError);
    phoneInputElement?.focus();
    return;
  }

  const sanitizedName = normalizeBookingName(nameInput);
  const sanitizedPhone = formatBookingPhone(phoneInput);

  if (modalTitle && modalBody) {
    modalTitle.textContent = 'Procesando reserva...';
    modalBody.innerHTML = `<div class="spinner-border text-purple" role="status"></div>`;
  }

  try {
    if (!currentSelectedDay || !currentSelectedSlot) throw new Error('Слот не выбран');

    const dayRef = doc(daysCollection, currentSelectedDay.id);
    const updatedDay = await runTransaction(firestore, async transaction => {
      const daySnapshot = await transaction.get(dayRef);
      const dayFromFirestore = daySnapshot.data() as Day | undefined;
      const slot = dayFromFirestore?.slots.find(item => item.id === currentSelectedSlot?.id);

      if (!dayFromFirestore || !slot || slot.isBooked) {
        throw new Error('Слот уже забронирован');
      }

      const nextDay: Day = {
        ...dayFromFirestore,
        slots: dayFromFirestore.slots.map(item => item.id === slot.id
          ? { ...item, isBooked: true, clientName: sanitizedName, clientPhone: sanitizedPhone }
          : item)
      };
      transaction.set(dayRef, nextDay);
      return nextDay;
    });

    await createGoogleCalendarEvent({
      clientName: sanitizedName,
      clientPhone: sanitizedPhone,
      date: currentSelectedDay.date,
      month: currentSelectedDay.month,
      time: currentSelectedSlot.time,
      year: new Date().getFullYear()
    });

    db = db.map(day => day.id === updatedDay.id ? updatedDay : day);

    if (modalTitle && modalBody) {
      modalTitle.textContent = '¡Reserva confirmada!';
      modalBody.innerHTML = `
        <h1 class="text-success mb-3">✓</h1>
        <h5>Gracias, ${sanitizedName}.</h5>
        <button class="btn btn-outline-success mt-3" data-bs-dismiss="modal">Cerrar</button>
      `;
    }
    renderClientCalendar();
  } catch (error) {
    console.error(error);
    if (modalTitle && modalBody) {
      modalTitle.textContent = 'Error';
      modalBody.innerHTML = `<p class="text-danger">Hubo un problema al completar la reserva.</p>`;
    }
  }
}

// --- АДМИНСКАЯ ЧАСТЬ ---
function renderAdminCalendar() {
  if (!adminCalendarContainer) return;
  adminCalendarContainer.innerHTML = '';

  if (db.length === 0) {
    adminCalendarContainer.innerHTML = '<p class="text-muted">Пока нет созданных дат.</p>';
    return;
  }

  db.forEach(day => {
    const dayCard = document.createElement('div');
    dayCard.className = 'card p-3 shadow-sm';
    
    let slotsHtml = day.slots.map(s => `
      <div class="d-flex justify-content-between align-items-center border-bottom py-2">
        <span>🕒 ${s.time}</span>
        ${s.isBooked 
          ? `<span class="badge bg-danger">Забронировано: ${s.clientName} (${s.clientPhone})</span>` 
          : `<span class="badge bg-success">Свободно</span>`
        }
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteSlot('${day.id}', '${s.id}')">X</button>
      </div>
    `).join('');

    dayCard.innerHTML = `
      <div class="d-flex justify-content-between">
        <h5 class="text-purple mb-3">${day.dayOfWeek}, ${day.date} ${day.month}</h5>
        <button type="button" class="btn btn-sm btn-danger" onclick="deleteDay('${day.id}')">Удалить день</button>
      </div>
      <div>${slotsHtml || '<small class="text-muted">На этот день пока нет времени.</small>'}</div>
    `;
    adminCalendarContainer.appendChild(dayCard);
  });
}

async function addNewSlot() {
  const dateInput = (document.getElementById('newDate') as HTMLInputElement).value;
  const hour = (document.getElementById('newTime') as HTMLSelectElement).value;
  const minute = (document.getElementById('newMinute') as HTMLSelectElement).value;
  const time = hour && minute ? `${hour}:${minute}` : '';

  if (!dateInput || !time) {
    alert('Выберите дату и время.');
    return;
  }

  const dateObject = new Date(`${dateInput}T12:00:00`);
  const date = String(dateObject.getDate());
  const month = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(dateObject);
  const dayOfWeek = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(dateObject);

  let day = db.find(d => d.date === date && d.month === month);

  if (!day) {
    day = { id: 'd' + Date.now(), dayOfWeek, date, month, slots: [] };
    db.push(day);
  }

  day.slots.push({ id: 's' + Date.now(), time, isBooked: false, clientName: '', clientPhone: '' });

  try {
    await saveDay(day);
  } catch (error) {
    console.error('Не удалось сохранить сеанс', error);
    alert('Сеанс не сохранён. Проверьте подключение к Firebase.');
    return;
  }

  (document.getElementById('newDate') as HTMLInputElement).value = '';
  (document.getElementById('newTime') as HTMLSelectElement).value = '';
  (document.getElementById('newMinute') as HTMLSelectElement).value = '';
  renderAdminCalendar();
}

// Глобальные функции для кнопок удаления (так как они рендерятся через строку)
(window as any).deleteSlot = async (dayId: string, slotId: string) => {
  const day = db.find(d => d.id === dayId);
  if (!day) return;

  const updatedDay = {
    ...day,
    slots: day.slots.filter(slot => slot.id !== slotId)
  };

  try {
    await saveDay(updatedDay);
    db = db.map(item => item.id === dayId ? updatedDay : item);
    renderAdminCalendar();
  } catch (error) {
    console.error('Не удалось удалить сеанс', error);
    alert(`Не удалось удалить сеанс: ${getFirebaseErrorMessage(error)}`);
  }
};

(window as any).deleteDay = async (dayId: string) => {
  try {
    await deleteDoc(doc(daysCollection, dayId));
    db = db.filter(day => day.id !== dayId);
    renderAdminCalendar();
  } catch (error) {
    console.error('Не удалось удалить день', error);
    alert(`Не удалось удалить день: ${getFirebaseErrorMessage(error)}`);
  }
};