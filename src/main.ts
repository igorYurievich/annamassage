declare var bootstrap: any;

import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
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
let stopDaysListener: (() => void) | null = null;

interface Slot {
  id: string;
  time: string;
  isBooked: boolean;
  clientName: string;
  clientPhone: string;
  durationMinutes?: number;
  calendarEventId?: string;
}

interface Day {
  id: string;
  dayOfWeek: string;
  date: string;
  month: string;
  year?: number;
  slots: Slot[];
}
interface GoogleCalendarEvent {
  clientName: string;
  clientPhone: string;
  date: string;
  month: string;
  time: string;
  durationMinutes: number;
  year: number;
}
const googleCalendarApiUrl = 'https://us-central1-annamassage-68e80.cloudfunctions.net/createCalendarEvent';
const syncCalendarApiUrl = 'https://us-central1-annamassage-68e80.cloudfunctions.net/syncCalendarBookings';
const sessionBufferMinutes = 30;

async function createGoogleCalendarEvent(event: GoogleCalendarEvent): Promise<string> {
  if (!googleCalendarApiUrl) throw new Error('Google Calendar недоступен');

  const response = await fetch(googleCalendarApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });

  if (!response.ok) throw new Error('Не удалось создать событие в Google Calendar');
  const result = await response.json() as { eventId?: string };
  if (!result.eventId) throw new Error('Google Calendar не вернул ID события');
  return result.eventId;
}

async function syncBookingsWithCalendar(): Promise<void> {
  const response = await fetch(syncCalendarApiUrl);
  if (!response.ok) throw new Error('Не удалось синхронизировать Google Calendar');

  const result = await response.json() as { eventIds?: string[] };
  const activeEventIds = new Set(result.eventIds ?? []);
  const daysToUpdate = db
    .map(day => ({
      ...day,
      slots: day.slots.filter(slot => !slot.calendarEventId || activeEventIds.has(slot.calendarEventId))
    }))
    .filter((day, index) => day.slots.length !== db[index].slots.length);

  if (daysToUpdate.length === 0) return;
  await Promise.all(daysToUpdate.map(day => setDoc(doc(daysCollection, day.id), day)));
  db = db.map(day => daysToUpdate.find(updatedDay => updatedDay.id === day.id) ?? day);
  renderApp();
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
let currentSelectedDay: Day | null = null;
let currentSelectedTime = '';
let currentSelectedDuration = 60;
let visibleCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedCalendarDate = new Date();
selectedCalendarDate.setHours(0, 0, 0, 0);

let modalInstance: any = null;

// DOM Elements
const clientView = document.getElementById('clientView');
const calendarContainer = document.getElementById('calendar-container');
const homeLogo = document.getElementById('homeLogo');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');

document.addEventListener('DOMContentLoaded', async () => {
  modalInstance = new bootstrap.Modal(document.getElementById('mainModal'));

  try {
    db = await loadDB();
    await syncBookingsWithCalendar();
    subscribeToDays();
  } catch (error) {
    console.error('Не удалось загрузить данные из Firestore', error);
    alert('Не удалось загрузить данные для входа. Проверьте подключение к Firebase.');
  }

  renderApp();

  document.getElementById('reserveNowBtn')?.addEventListener('click', () => {
    document.getElementById('calendar-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  homeLogo?.addEventListener('click', event => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  window.setInterval(() => {
    syncBookingsWithCalendar().catch(error => console.error('Не удалось обновить занятость календаря', error));
  }, 60000);
});

function renderApp() {
  clientView?.classList.remove('hidden');
  renderClientCalendar();
}

// --- КЛИЕНТСКАЯ ЧАСТЬ ---
function renderClientCalendar() {
  if (!calendarContainer) return;
  const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(visibleCalendarMonth);
  const firstDay = new Date(visibleCalendarMonth);
  const firstGridDay = new Date(firstDay);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  firstGridDay.setDate(firstDay.getDate() - mondayOffset);
  const todayKey = getDateKey(new Date());
  const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  calendarContainer.className = 'booking-calendar mb-5';
  calendarContainer.innerHTML = `
    <div class="calendar-toolbar">
      <button class="calendar-arrow" id="previousMonth" type="button" aria-label="Mes anterior">‹</button>
      <h3 class="calendar-month-title">${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</h3>
      <button class="calendar-arrow" id="nextMonth" type="button" aria-label="Mes siguiente">›</button>
    </div>
    <div class="calendar-week-strip" id="calendar-week-strip"></div>
    <div class="calendar-week-labels">${dayLabels.map(label => `<span>${label}</span>`).join('')}</div>
    <div class="calendar-grid" id="calendar-grid"></div>
    <div class="calendar-time-panel" id="inline-time-picker"></div>
  `;

  const weekStrip = document.getElementById('calendar-week-strip');
  const grid = document.getElementById('calendar-grid');
  const weekStart = new Date(selectedCalendarDate);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

  for (let index = 0; index < 7; index += 1) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dateKey = getDateKey(date);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `week-day ${dateKey === getDateKey(selectedCalendarDate) ? 'is-selected' : ''}`;
    button.innerHTML = `<span>${dayLabels[index]}</span><strong>${date.getDate()}</strong>`;
    button.addEventListener('click', () => selectCalendarDate(date));
    weekStrip?.appendChild(button);
  }

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(firstGridDay);
    date.setDate(firstGridDay.getDate() + index);
    const dateKey = getDateKey(date);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `calendar-day ${date.getMonth() !== visibleCalendarMonth.getMonth() ? 'is-muted' : ''} ${dateKey === getDateKey(selectedCalendarDate) ? 'is-selected' : ''} ${dateKey === todayKey ? 'is-today' : ''}`;
    button.innerHTML = `<span>${date.getDate()}</span>`;
    button.addEventListener('click', () => selectCalendarDate(date));
    grid?.appendChild(button);
  }

  document.getElementById('previousMonth')?.addEventListener('click', () => {
    visibleCalendarMonth = new Date(visibleCalendarMonth.getFullYear(), visibleCalendarMonth.getMonth() - 1, 1);
    renderClientCalendar();
  });
  document.getElementById('nextMonth')?.addEventListener('click', () => {
    visibleCalendarMonth = new Date(visibleCalendarMonth.getFullYear(), visibleCalendarMonth.getMonth() + 1, 1);
    renderClientCalendar();
  });

  const selectedDay = getDayForDate(selectedCalendarDate);
  currentSelectedDay = selectedDay;
  renderTimePicker(selectedDay, document.getElementById('inline-time-picker'));
}

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function selectCalendarDate(date: Date) {
  selectedCalendarDate = new Date(date);
  selectedCalendarDate.setHours(0, 0, 0, 0);
  visibleCalendarMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  renderClientCalendar();
}

function getDayForDate(date: Date): Day {
  const dayOfWeek = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date);
  const month = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(date);
  const dateNumber = String(date.getDate());
  const storedDay = db.find(item => item.date === dateNumber && item.month === month);

  return storedDay ?? {
    id: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    dayOfWeek,
    date: dateNumber,
    month,
    year: date.getFullYear(),
    slots: []
  };
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function getAvailableTimes(day: Day, durationMinutes: number): string[] {
  const bookedSlots = day.slots
    .filter(slot => slot.isBooked)
    .map(slot => ({
      start: timeToMinutes(slot.time),
      end: timeToMinutes(slot.time) + (slot.durationMinutes ?? 60) + sessionBufferMinutes
    }));
  const latestStart = 22 * 60 - durationMinutes - sessionBufferMinutes;
  const availableTimes: string[] = [];

  for (let start = 8 * 60; start <= latestStart; start += 30) {
    const end = start + durationMinutes;
    const overlaps = bookedSlots.some(slot => start < slot.end && end + sessionBufferMinutes > slot.start);
    if (!overlaps) availableTimes.push(minutesToTime(start));
  }

  return availableTimes;
}

function renderTimePicker(day: Day, target: HTMLElement | null) {
  if (!target) return;
  const availableTimes = getAvailableTimes(day, currentSelectedDuration);
  const durationOptions = [60, 90, 120].map(duration => `
    <button class="btn ${duration === currentSelectedDuration ? 'btn-primary' : 'btn-outline-primary'} duration-btn" data-duration="${duration}">
      ${duration / 60 === 1 ? '1 hora' : duration === 90 ? '1,5 horas' : '2 horas'}
    </button>
  `).join('');
  const timeOptions = availableTimes.length
    ? `<label class="time-select-label" for="bookingTime">Hora de inicio</label>
       <select class="form-select time-select" id="bookingTime">
         <option value="">Selecciona una hora</option>
         ${availableTimes.map(time => `<option value="${time}">${time}</option>`).join('')}
       </select>
       <button class="btn btn-primary w-100 continue-time-btn" id="continueTimeBtn" disabled>Continuar</button>`
    : '<p class="text-muted mb-0">No hay horarios disponibles para esta duración.</p>';

  target.innerHTML = `
    <p class="text-muted mb-3">Elige la duración y la hora de inicio:</p>
    <div class="btn-group w-100 mb-4" role="group" aria-label="Duración del masaje">${durationOptions}</div>
    <div class="time-grid">${timeOptions}</div>
  `;

  target.querySelectorAll<HTMLButtonElement>('.duration-btn').forEach(button => {
    button.addEventListener('click', () => {
      currentSelectedDuration = Number(button.dataset.duration);
      renderTimePicker(day, target);
    });
  });
  const timeSelect = target.querySelector<HTMLSelectElement>('#bookingTime');
  const continueButton = target.querySelector<HTMLButtonElement>('#continueTimeBtn');
  timeSelect?.addEventListener('change', () => {
    if (continueButton) continueButton.disabled = !timeSelect.value;
  });
  continueButton?.addEventListener('click', () => {
    if (timeSelect?.value) showBookingForm(timeSelect.value, currentSelectedDuration);
  });
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

function showBookingForm(time: string, durationMinutes: number) {
  currentSelectedTime = time;
  currentSelectedDuration = durationMinutes;
  if (!modalTitle || !modalBody) return;

  modalTitle.textContent = `Confirmar reserva: ${time}`;
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

  document.getElementById('backBtn')?.addEventListener('click', () => modalInstance.hide());
  document.getElementById('confirmBtn')?.addEventListener('click', submitBooking);
  modalInstance.show();
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
    if (!currentSelectedDay || !currentSelectedTime) throw new Error('Время не выбрано');

    const selectedDay = currentSelectedDay;
    const bookingId = `booking-${Date.now()}`;
    const dayRef = doc(daysCollection, selectedDay.id);
    const updatedDay = await runTransaction(firestore, async transaction => {
      const daySnapshot = await transaction.get(dayRef);
      const dayFromFirestore = daySnapshot.data() as Day | undefined;
      const dayData = dayFromFirestore ?? selectedDay;
      const requestedStart = timeToMinutes(currentSelectedTime);
      const requestedEnd = requestedStart + currentSelectedDuration;
      const overlaps = dayData.slots.some(item => {
        if (!item.isBooked) return false;
        const bookedStart = timeToMinutes(item.time);
        const bookedEnd = bookedStart + (item.durationMinutes ?? 60) + sessionBufferMinutes;
        return requestedStart < bookedEnd && requestedEnd + sessionBufferMinutes > bookedStart;
      });

      if (overlaps) {
        throw new Error('Слот уже забронирован');
      }

      const nextDay: Day = {
        ...dayData,
        slots: [...dayData.slots, {
          id: bookingId,
          time: currentSelectedTime,
          durationMinutes: currentSelectedDuration,
          isBooked: true,
          clientName: sanitizedName,
          clientPhone: sanitizedPhone
        }]
      };
      transaction.set(dayRef, nextDay);
      return nextDay;
    });

    const calendarEventId = await createGoogleCalendarEvent({
      clientName: sanitizedName,
      clientPhone: sanitizedPhone,
      date: currentSelectedDay.date,
      month: currentSelectedDay.month,
      time: currentSelectedTime,
      durationMinutes: currentSelectedDuration,
      year: currentSelectedDay.year ?? new Date().getFullYear()
    });

    const savedDay = await runTransaction(firestore, async transaction => {
      const daySnapshot = await transaction.get(dayRef);
      const dayFromFirestore = daySnapshot.data() as Day | undefined;
      if (!dayFromFirestore) throw new Error('День бронирования не найден');

      const nextDay: Day = {
        ...dayFromFirestore,
        slots: dayFromFirestore.slots.map(slot => slot.id === bookingId
          ? { ...slot, calendarEventId }
          : slot)
      };
      transaction.set(dayRef, nextDay);
      return nextDay;
    });

    db = db.map(day => day.id === savedDay.id ? savedDay : updatedDay);

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
