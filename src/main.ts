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
  clientInstagram?: string;
  clientNote?: string;
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
  clientInstagram?: string;
  clientNote?: string;
}
interface LocalReservation {
  id: string;
  dayId: string;
  date: string;
  month: string;
  year: number;
  time: string;
  durationMinutes: number;
  calendarEventId?: string;
}
type Language = 'es' | 'en' | 'de' | 'ru';
const languageStorageKey = 'annaMassageLanguage';
const translations: Record<string, Record<string, string>> = {
  es: {
    brand: 'Anna Massage', eyebrow: 'Masajes terapéuticos', heroTitle: 'Elija su fecha y hora para relajarse', heroText: 'Disfrute de un momento de calma, bienestar y descanso con un servicio pensado para cuidar cuerpo y mente.', reserveNow: 'Reservar ahora', relaxation: 'Relajación', wellness: 'Bienestar', professional: 'Profesional', calendarTitle: 'Calendario de disponibilidad', calendarText: 'Elija una fecha, la duración y una hora disponible. Dejamos 30 minutos entre citas.', activeReservations: 'Reservas activas', noReservations: 'Aquí aparecerán tus reservas realizadas desde este dispositivo.', cancel: 'Cancelar', cancelling: 'Cancelando...', instagramTitle: 'Instagram', instagramSubtitle: 'anna_massage_torrevieja', openInstagram: 'Abrir Instagram', whatsapp: 'WhatsApp', write: 'Escribir', previousMonth: 'Mes anterior', nextMonth: 'Mes siguiente', durationAndTime: 'Elige la duración y la hora de inicio:', duration: 'Duración del masaje', startTime: 'Hora de inicio', selectTime: 'Selecciona una hora', continue: 'Continuar', noTimes: 'No hay horarios disponibles para esta duración.', confirmTitle: 'Confirmar reserva', name: 'Su nombre', phone: 'Su teléfono', instagramOptional: 'Instagram (opcional)', notes: 'Notas o deseos (opcional)', namePlaceholder: 'Ej: Juan Pérez', notePlaceholder: 'Ej: masaje deportivo o más aceite', confirm: 'Confirmar cita', back: 'Volver a los horarios', processing: 'Procesando reserva...', confirmed: '¡Reserva confirmada!', thanks: 'Gracias', reservationFor: 'Tu reserva ha sido realizada para:', price: 'Precio', screenshot: 'Haz una captura de esta pantalla para recordar tu cita.', close: 'Cerrar', error: 'Error', bookingError: 'Hubo un problema al completar la reserva.', tooSoonTitle: 'Elige una hora más tarde', tooSoon: 'Faltan menos de 3 horas para las {time}.', tooSoonText: 'Por favor, elige una hora más tarde para poder hacer la reserva.', chooseAnotherTime: 'Elegir otra hora', unavailableDate: 'Fecha no disponible', pastDate: 'No se pueden hacer reservas para fechas anteriores a hoy.', chooseAnotherDate: 'Elegir otra fecha', cancelQuestion: '¿Quieres cancelar esta reserva?', cancelError: 'No se pudo cancelar la reserva. Inténtalo de nuevo.', invalidName: 'Por favor, escribe tu nombre.', shortName: 'El nombre debe tener al menos 2 caracteres.', nameChars: 'El nombre solo puede contener letras, espacios y signos básicos.', invalidPhone: 'Por favor, introduce tu teléfono.', phoneFormat: 'Introduce un teléfono válido con código internacional, por ejemplo +34 600 000 000.'
  },
  en: {
    brand: 'Anna Massage', eyebrow: 'Therapeutic massages', heroTitle: 'Choose your date and time to relax', heroText: 'Enjoy a moment of calm, wellbeing and rest with a service designed to care for body and mind.', reserveNow: 'Book now', relaxation: 'Relaxation', wellness: 'Wellbeing', professional: 'Professional', calendarTitle: 'Availability calendar', calendarText: 'Choose a date, duration and available time. We leave 30 minutes between appointments.', activeReservations: 'Active bookings', noReservations: 'Your bookings made from this device will appear here.', cancel: 'Cancel', cancelling: 'Cancelling...', instagramTitle: 'Instagram', instagramSubtitle: 'anna_massage_torrevieja', openInstagram: 'Open Instagram', whatsapp: 'WhatsApp', write: 'Write', previousMonth: 'Previous month', nextMonth: 'Next month', durationAndTime: 'Choose the duration and start time:', duration: 'Massage duration', startTime: 'Start time', selectTime: 'Select a time', continue: 'Continue', noTimes: 'No times are available for this duration.', confirmTitle: 'Confirm booking', name: 'Your name', phone: 'Your phone', instagramOptional: 'Instagram (optional)', notes: 'Notes or requests (optional)', namePlaceholder: 'e.g. Juan Pérez', notePlaceholder: 'e.g. sports massage or more oil', confirm: 'Confirm appointment', back: 'Back to times', processing: 'Processing booking...', confirmed: 'Booking confirmed!', thanks: 'Thank you', reservationFor: 'Your booking is scheduled for:', price: 'Price', screenshot: 'Take a screenshot to remember your appointment.', close: 'Close', error: 'Error', bookingError: 'There was a problem completing the booking.', tooSoonTitle: 'Choose a later time', tooSoon: 'There are less than 3 hours until {time}.', tooSoonText: 'Please choose a later time to make the booking.', chooseAnotherTime: 'Choose another time', unavailableDate: 'Date unavailable', pastDate: 'Bookings cannot be made for dates before today.', chooseAnotherDate: 'Choose another date', cancelQuestion: 'Do you want to cancel this booking?', cancelError: 'The booking could not be cancelled. Please try again.', invalidName: 'Please enter your name.', shortName: 'The name must be at least 2 characters.', nameChars: 'The name may contain only letters, spaces and basic punctuation.', invalidPhone: 'Please enter your phone number.', phoneFormat: 'Enter a valid phone number with country code, for example +34 600 000 000.'
  },
  ruLegacy: {
    brand: 'Анна Массаж', eyebrow: 'Терапевтические массажи', heroTitle: 'Выберите дату и время для отдыха', heroText: 'Насладитесь моментом спокойствия, благополучия и отдыха с услугой, разработанной для заботы о теле и разуме.', reserveNow: 'Забронировать сейчас', relaxation: 'Расслабление', wellness: 'Благополучие', professional: 'Профессионально', calendarTitle: 'Календарь доступности', calendarText: 'Выберите дату, продолжительность и доступное время. Мы оставляем 30 минут между записями.', activeReservations: 'Активные бронирования', noReservations: 'Ваши бронирования, сделанные с этого устройства, появятся здесь.', cancel: 'Отменить', cancelling: 'Отмена...', instagramTitle: 'Instagram', instagramSubtitle: 'anna_massage_torrevieja', openInstagram: 'Открыть Instagram', whatsapp: 'WhatsApp', write: 'Написать', previousMonth: 'Предыдущий месяц', nextMonth: 'Следующий месяц', durationAndTime: 'Выберите продолжительность и время начала:', duration: 'Продолжительность массажа', startTime: 'Время начала', selectTime: 'Выберите время', continue: 'Продолжить', noTimes: 'Нет доступных времён для этой продолжительности.', confirmTitle: 'Подтвердить бронирование', name: 'Ваше имя', phone: 'Ваш телефон', instagramOptional: 'Instagram (необязательно)', notes: 'Заметки или пожелания (необязательно)', namePlaceholder: 'например, Juan Pérez', notePlaceholder: 'например, спортивный массаж или больше масла', confirm: 'Подтвердить запись', back: 'Назад к времени', processing: 'Обработка бронирования...', confirmed: 'Бронирование подтверждено!', thanks: 'Спасибо', reservationFor: 'Ваше бронирование запланировано на:', price: 'Цена', screenshot: 'Сделайте скриншот, чтобы запомнить вашу запись.', close: 'Закрыть', error: 'Ошибка', bookingError: 'Произошла проблема при завершении бронирования.', tooSoonTitle: 'Выберите более позднее время', tooSoon: 'До {time} осталось менее 3 часов.', tooSoonText: 'Пожалуйста, выберите более позднее время для бронирования.', chooseAnotherTime: 'Выбрать другое время', unavailableDate: 'Дата недоступна', pastDate: 'Бронирования не могут быть сделаны на даты до сегодняшнего дня.', chooseAnotherDate: 'Выбрать другую дату', cancelQuestion: 'Вы хотите отменить это бронирование?', cancelError: 'Бронирование не удалось отменить. Пожалуйста, попробуйте снова.', invalidName: 'Пожалуйста, введите ваше имя.', shortName: 'Имя должно содержать не менее 2 символов.', nameChars: 'Имя может содержать только буквы, пробелы и основные знаки.', invalidPhone: 'Пожалуйста, введите номер телефона.', phoneFormat: 'Введите действительный номер телефона с кодом страны, например +34 600 000 000.'
  },
  de: {
    brand: 'Anna Massage', eyebrow: 'Therapeutische Massagen', heroTitle: 'Wählen Sie Datum und Uhrzeit zum Entspannen', heroText: 'Genießen Sie einen Moment der Ruhe und Erholung mit einer Behandlung für Körper und Geist.', reserveNow: 'Jetzt buchen', relaxation: 'Entspannung', wellness: 'Wohlbefinden', professional: 'Professionell', calendarTitle: 'Verfügbarkeitskalender', calendarText: 'Wählen Sie Datum, Dauer und verfügbare Uhrzeit. Zwischen den Terminen liegen 30 Minuten.', activeReservations: 'Aktive Buchungen', noReservations: 'Hier erscheinen Ihre Buchungen von diesem Gerät.', cancel: 'Stornieren', cancelling: 'Wird storniert...', instagramTitle: 'Instagram', instagramSubtitle: 'anna_massage_torrevieja', openInstagram: 'Instagram öffnen', whatsapp: 'WhatsApp', write: 'Schreiben', previousMonth: 'Vorheriger Monat', nextMonth: 'Nächster Monat', durationAndTime: 'Wählen Sie Dauer und Startzeit:', duration: 'Massagedauer', startTime: 'Startzeit', selectTime: 'Uhrzeit auswählen', continue: 'Weiter', noTimes: 'Für diese Dauer sind keine Zeiten verfügbar.', confirmTitle: 'Buchung bestätigen', name: 'Ihr Name', phone: 'Ihre Telefonnummer', instagramOptional: 'Instagram (optional)', notes: 'Notizen oder Wünsche (optional)', namePlaceholder: 'z. B. Juan Pérez', notePlaceholder: 'z. B. Sportmassage oder mehr Öl', confirm: 'Termin bestätigen', back: 'Zurück zu den Zeiten', processing: 'Buchung wird bearbeitet...', confirmed: 'Buchung bestätigt!', thanks: 'Danke', reservationFor: 'Ihre Buchung ist geplant für:', price: 'Preis', screenshot: 'Machen Sie einen Screenshot, damit Sie Ihren Termin nicht vergessen.', close: 'Schließen', error: 'Fehler', bookingError: 'Beim Abschluss der Buchung ist ein Problem aufgetreten.', tooSoonTitle: 'Wählen Sie eine spätere Zeit', tooSoon: 'Bis {time} sind es weniger als 3 Stunden.', tooSoonText: 'Bitte wählen Sie eine spätere Zeit für die Buchung.', chooseAnotherTime: 'Andere Zeit wählen', unavailableDate: 'Datum nicht verfügbar', pastDate: 'Für vergangene Daten sind keine Buchungen möglich.', chooseAnotherDate: 'Anderes Datum wählen', cancelQuestion: 'Möchten Sie diese Buchung stornieren?', cancelError: 'Die Buchung konnte nicht storniert werden. Bitte versuchen Sie es erneut.', invalidName: 'Bitte geben Sie Ihren Namen ein.', shortName: 'Der Name muss mindestens 2 Zeichen enthalten.', nameChars: 'Der Name darf nur Buchstaben, Leerzeichen und einfache Satzzeichen enthalten.', invalidPhone: 'Bitte geben Sie Ihre Telefonnummer ein.', phoneFormat: 'Geben Sie eine gültige Telefonnummer mit Landesvorwahl ein, z. B. +34 600 000 000.'
  },
  ru: {
    brand: 'Anna Massage', eyebrow: 'Лечебный массаж', heroTitle: 'Выберите дату и время для отдыха', heroText: 'Насладитесь спокойствием и восстановлением с процедурой для тела и души.', reserveNow: 'Забронировать', relaxation: 'Расслабление', wellness: 'Самочувствие', professional: 'Профессионально', calendarTitle: 'Календарь доступности', calendarText: 'Выберите дату, длительность и свободное время. Между записями оставляем 30 минут.', activeReservations: 'Активные записи', noReservations: 'Здесь появятся ваши записи с этого устройства.', cancel: 'Отменить', cancelling: 'Отмена...', instagramTitle: 'Instagram', instagramSubtitle: 'anna_massage_torrevieja', openInstagram: 'Открыть Instagram', whatsapp: 'WhatsApp', write: 'Написать', previousMonth: 'Предыдущий месяц', nextMonth: 'Следующий месяц', durationAndTime: 'Выберите длительность и время начала:', duration: 'Длительность массажа', startTime: 'Время начала', selectTime: 'Выберите время', continue: 'Продолжить', noTimes: 'Для этой длительности нет свободного времени.', confirmTitle: 'Подтвердить запись', name: 'Ваше имя', phone: 'Ваш телефон', instagramOptional: 'Instagram (необязательно)', notes: 'Примечания или пожелания (необязательно)', namePlaceholder: 'Например: Juan Pérez', notePlaceholder: 'Например: спортивный массаж или больше масла', confirm: 'Подтвердить запись', back: 'Вернуться ко времени', processing: 'Запись обрабатывается...', confirmed: 'Запись подтверждена!', thanks: 'Спасибо', reservationFor: 'Ваша запись запланирована на:', price: 'Цена', screenshot: 'Сделайте скриншот, чтобы не забыть о записи.', close: 'Закрыть', error: 'Ошибка', bookingError: 'Не удалось завершить запись.', tooSoonTitle: 'Выберите время позже', tooSoon: 'До {time} осталось меньше 3 часов.', tooSoonText: 'Пожалуйста, выберите более позднее время.', chooseAnotherTime: 'Выбрать другое время', unavailableDate: 'Дата недоступна', pastDate: 'Нельзя записаться на даты раньше сегодняшней.', chooseAnotherDate: 'Выбрать другую дату', cancelQuestion: 'Отменить эту запись?', cancelError: 'Не удалось отменить запись. Попробуйте ещё раз.', invalidName: 'Пожалуйста, введите имя.', shortName: 'Имя должно содержать минимум 2 символа.', nameChars: 'Имя может содержать только буквы, пробелы и базовые знаки.', invalidPhone: 'Пожалуйста, введите телефон.', phoneFormat: 'Введите корректный телефон с кодом страны, например +34 600 000 000.'
  }
};
let currentLanguage: Language = (localStorage.getItem(languageStorageKey) as Language) || 'es';
function t(key: string, values: Record<string, string> = {}): string {
  return Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, value), translations[currentLanguage][key] ?? translations.es[key] ?? key);
}
function setLanguage(language: Language) {
  currentLanguage = language;
  localStorage.setItem(languageStorageKey, language);
  document.documentElement.lang = language;
  if (modalTitle) modalTitle.textContent = t('durationAndTime');
  document.querySelectorAll<HTMLButtonElement>('[data-language]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.language === language);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n ?? ''); });
  document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach(element => { element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder ?? '')); });
  renderApp();
}
const googleCalendarApiUrl = 'https://us-central1-annamassage-68e80.cloudfunctions.net/createCalendarEvent';
const deleteGoogleCalendarEventApiUrl = 'https://us-central1-annamassage-68e80.cloudfunctions.net/deleteCalendarEvent';
const syncCalendarApiUrl = 'https://us-central1-annamassage-68e80.cloudfunctions.net/syncCalendarBookings';
const localReservationsKey = 'annaMassageLocalReservations';
const sessionBufferMinutes = 30;
const bookingOpeningMinutes = 10 * 60;
const bookingClosingMinutes = 21 * 60;
const minimumBookingNoticeMs = 3 * 60 * 60 * 1000;
const activeReservationRetentionMs = 60 * 60 * 1000;

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
const reservationsContainer = document.getElementById('reservations-container');
const homeLogo = document.getElementById('homeLogo');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');

document.addEventListener('DOMContentLoaded', async () => {
  modalInstance = new bootstrap.Modal(document.getElementById('mainModal'));
  document.querySelectorAll<HTMLButtonElement>('[data-language]').forEach(button => {
    button.addEventListener('click', () => setLanguage(button.dataset.language as Language));
  });
  setLanguage(currentLanguage);

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
  renderLocalReservations();
}

function getLocalReservations(): LocalReservation[] {
  try {
    const storedReservations = localStorage.getItem(localReservationsKey);
    return storedReservations ? JSON.parse(storedReservations) as LocalReservation[] : [];
  } catch {
    return [];
  }
}

function saveLocalReservations(reservations: LocalReservation[]) {
  localStorage.setItem(localReservationsKey, JSON.stringify(reservations));
}

function renderLocalReservations() {
  if (!reservationsContainer) return;

  const reservations = getLocalReservations()
    .filter(reservation => !isReservationInThePast(reservation))
    .sort((first, second) => getReservationDateTime(first).getTime() - getReservationDateTime(second).getTime());
  saveLocalReservations(reservations);

  reservationsContainer.innerHTML = reservations.length
    ? `
      <h2 class="fw-bold text-purple mb-3">${t('activeReservations')}</h2>
      <div class="active-reservations-list">
        ${reservations.map(reservation => `
          <article class="active-reservation">
            <div>
              <strong>${formatReservationDate(reservation)}</strong>
              <span>${reservation.time} · ${reservation.durationMinutes / 60} h · ${getDurationPrice(reservation.durationMinutes)}</span>
            </div>
            <button class="btn btn-outline-danger cancel-reservation-btn" type="button" data-reservation-id="${reservation.id}">
              ${t('cancel')}
            </button>
          </article>
        `).join('')}
      </div>
    `
    : `
      <h2 class="fw-bold text-purple mb-2">${t('activeReservations')}</h2>
      <p class="text-muted mb-0">${t('noReservations')}</p>
    `;

  reservationsContainer.querySelectorAll<HTMLButtonElement>('.cancel-reservation-btn').forEach(button => {
    button.addEventListener('click', () => {
      const reservation = reservations.find(item => item.id === button.dataset.reservationId);
      if (reservation) cancelLocalReservation(reservation, button);
    });
  });
}

function getReservationDateTime(reservation: LocalReservation): Date {
  const reservationDate = new Date(reservation.year, getMonthNumber(reservation.month) - 1, Number(reservation.date));
  const [hours, minutes] = reservation.time.split(':').map(Number);
  reservationDate.setHours(hours, minutes, 0, 0);
  return reservationDate;
}

function getMonthNumber(month: string): number {
  const monthIndex = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    .indexOf(month.toLowerCase());
  return monthIndex >= 0 ? monthIndex + 1 : 1;
}

function isReservationInThePast(reservation: LocalReservation): boolean {
  return getReservationDateTime(reservation).getTime() + activeReservationRetentionMs <= Date.now();
}

function formatReservationDate(reservation: LocalReservation): string {
  return new Intl.DateTimeFormat(currentLanguage, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(getReservationDateTime(reservation));
}

async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  const response = await fetch(deleteGoogleCalendarEventApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId })
  });

  if (!response.ok) throw new Error('No se pudo cancelar el evento del calendario');
}

async function cancelLocalReservation(reservation: LocalReservation, button: HTMLButtonElement) {
  if (!window.confirm(t('cancelQuestion'))) return;

  button.disabled = true;
  button.textContent = t('cancelling');

  try {
    if (reservation.calendarEventId) {
      await deleteGoogleCalendarEvent(reservation.calendarEventId);
    }

    const dayRef = doc(daysCollection, reservation.dayId);
    await runTransaction(firestore, async transaction => {
      const daySnapshot = await transaction.get(dayRef);
      const day = daySnapshot.data() as Day | undefined;
      if (!day) return;

      transaction.set(dayRef, {
        ...day,
        slots: day.slots.filter(slot => slot.id !== reservation.id)
      });
    });

    saveLocalReservations(getLocalReservations().filter(item => item.id !== reservation.id));
    renderApp();
  } catch (error) {
    console.error('Не удалось отменить резервацию', error);
    button.disabled = false;
    button.textContent = t('cancel');
    alert(t('cancelError'));
  }
}

// --- КЛИЕНТСКАЯ ЧАСТЬ ---
function renderClientCalendar() {
  if (!calendarContainer) return;
  const monthLabel = new Intl.DateTimeFormat(currentLanguage, { month: 'long', year: 'numeric' }).format(visibleCalendarMonth);
  const firstDay = new Date(visibleCalendarMonth);
  const firstGridDay = new Date(firstDay);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  firstGridDay.setDate(firstDay.getDate() - mondayOffset);
  const todayKey = getDateKey(new Date());
  const dayLabels = currentLanguage === 'ru' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : currentLanguage === 'de' ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] : currentLanguage === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  calendarContainer.className = 'booking-calendar mb-5';
  calendarContainer.innerHTML = `
    <div class="calendar-toolbar">
      <button class="calendar-arrow" id="previousMonth" type="button" aria-label="${t('previousMonth')}">‹</button>
      <h3 class="calendar-month-title">${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</h3>
      <button class="calendar-arrow" id="nextMonth" type="button" aria-label="${t('nextMonth')}">›</button>
    </div>
    <div class="calendar-week-labels">${dayLabels.map(label => `<span>${label}</span>`).join('')}</div>
    <div class="calendar-grid" id="calendar-grid"></div>
    <div class="calendar-time-panel" id="inline-time-picker"></div>
  `;

  const grid = document.getElementById('calendar-grid');

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(firstGridDay);
    date.setDate(firstGridDay.getDate() + index);
    const dateKey = getDateKey(date);
    const isPastDate = isDateBeforeToday(date);
    const button = document.createElement('button');
    button.type = 'button';
    button.disabled = isPastDate;
    button.className = `calendar-day ${date.getMonth() !== visibleCalendarMonth.getMonth() ? 'is-muted' : ''} ${dateKey === getDateKey(selectedCalendarDate) ? 'is-selected' : ''} ${dateKey === todayKey ? 'is-today' : ''} ${isPastDate ? 'is-past' : ''}`;
    button.innerHTML = `<span>${date.getDate()}</span>`;
    if (!isPastDate) button.addEventListener('click', () => selectCalendarDate(date));
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

function isDateBeforeToday(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  return normalizedDate < today;
}

function selectCalendarDate(date: Date) {
  if (isDateBeforeToday(date)) return;
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
  const latestStart = bookingClosingMinutes;
  const availableTimes: string[] = [];

  for (let start = bookingOpeningMinutes; start <= latestStart; start += 30) {
    if (isBookingTooSoon(minutesToTime(start))) continue;
    const end = start + durationMinutes;
    const overlaps = bookedSlots.some(slot => start < slot.end && end + sessionBufferMinutes > slot.start);
    if (!overlaps) availableTimes.push(minutesToTime(start));
  }

  return availableTimes;
}

function renderTimePicker(day: Day, target: HTMLElement | null) {
  if (!target) return;
  const availableTimes = getAvailableTimes(day, currentSelectedDuration);
  const durationOptions = [
    { minutes: 60, label: currentLanguage === 'en' ? '1 hour' : currentLanguage === 'de' ? '1 Stunde' : currentLanguage === 'ru' ? '1 час' : '1 hora', price: '50 €' },
    { minutes: 90, label: currentLanguage === 'en' ? '1.5 hours' : currentLanguage === 'de' ? '1,5 Stunden' : currentLanguage === 'ru' ? '1,5 часа' : '1,5 horas', price: '75 €' },
    { minutes: 120, label: currentLanguage === 'en' ? '2 hours' : currentLanguage === 'de' ? '2 Stunden' : currentLanguage === 'ru' ? '2 часа' : '2 horas', price: '100 €' }
  ].map(option => `
    <button class="btn ${option.minutes === currentSelectedDuration ? 'btn-primary' : 'btn-outline-primary'} duration-btn" data-duration="${option.minutes}">
      <span>${option.label}</span><strong>${option.price}</strong>
    </button>
  `).join('');
  const timeOptions = availableTimes.length
        ? `<label class="time-select-label" for="bookingTime">${t('startTime')}</label>
       <select class="form-select time-select" id="bookingTime">
          <option value="">${t('selectTime')}</option>
         ${availableTimes.map(time => `<option value="${time}">${time}</option>`).join('')}
       </select>
       <button class="btn btn-primary w-100 continue-time-btn" id="continueTimeBtn" disabled>${t('continue')}</button>`
     : `<p class="text-muted mb-0">${t('noTimes')}</p>`;

  target.innerHTML = `
    <p class="text-muted mb-3">${t('durationAndTime')}</p>
    <div class="btn-group w-100 mb-4" role="group" aria-label="${t('duration')}">${durationOptions}</div>
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
    if (!timeSelect?.value) return;
    if (isBookingTooSoon(timeSelect.value)) {
      showTooSoonWarning(timeSelect.value);
      return;
    }
    showBookingForm(timeSelect.value, currentSelectedDuration);
  });
}

function normalizeBookingName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function validateBookingName(value: string): string | null {
  const normalized = normalizeBookingName(value);

  if (!normalized) return t('invalidName');
  if (normalized.length < 2) return t('shortName');
  if (!/^[\p{L}\s'.-]+$/u.test(normalized)) {
    return t('nameChars');
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
  const hasPlus = value.trimStart().startsWith('+');
  const digits = value.replace(/\D/g, '').slice(0, 15);
  return `${hasPlus ? '+' : ''}${digits}`;
}

function validateBookingPhone(value: string): string | null {
  const cleaned = value.replace(/\s+/g, '');

  if (!cleaned) return t('invalidPhone');
  if (!/^\+?[1-9]\d{6,14}$/.test(cleaned)) {
    return t('phoneFormat');
  }

  return null;
}

function showBookingForm(time: string, durationMinutes: number) {
  currentSelectedTime = time;
  currentSelectedDuration = durationMinutes;
  if (!modalTitle || !modalBody) return;

  modalTitle.textContent = `${t('confirmTitle')}: ${time}`;
  modalBody.innerHTML = `
    <div class="text-start">
      <div class="mb-3">
        <label class="form-label fw-bold">${t('name')}</label>
        <input type="text" id="clientName" class="form-control" placeholder="${t('namePlaceholder')}" required minlength="2" autocomplete="name">
        <div class="invalid-feedback d-block" id="clientNameError"></div>
      </div>
      <div class="mb-4">
        <label class="form-label fw-bold">${t('phone')}</label>
        <input type="tel" id="clientPhone" class="form-control" placeholder="+34 600 000 000" required inputmode="tel" autocomplete="tel">
        <div class="invalid-feedback d-block" id="clientPhoneError"></div>
      </div>
      <div class="mb-4">
        <label class="form-label fw-bold">${t('instagramOptional')}</label>
        <input type="text" id="clientInstagram" class="form-control" placeholder="@tu_usuario" autocomplete="off">
      </div>
      <div class="mb-4">
        <label class="form-label fw-bold">${t('notes')}</label>
        <textarea id="clientNote" class="form-control" rows="3" maxlength="500" placeholder="${t('notePlaceholder')}"></textarea>
      </div>
      <button class="btn w-100 py-2 fw-bold" id="confirmBtn" style="background-color: #6f42c1; color: white;">
        ${t('confirm')}
      </button>
      <button class="btn btn-link text-muted w-100 mt-2" id="backBtn">${t('back')}</button>
    </div>
  `;

  const nameInput = document.getElementById('clientName') as HTMLInputElement;
  const phoneInput = document.getElementById('clientPhone') as HTMLInputElement;

  nameInput.addEventListener('input', () => {
    nameInput.value = nameInput.value.replace(/\s+/g, ' ');
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

function getDurationPrice(durationMinutes: number): string {
  const prices: Record<number, string> = {
    60: '50 €',
    90: '75 €',
    120: '100 €'
  };

  return prices[durationMinutes] ?? '';
}

function formatBookingDate(date: Date): string {
  return new Intl.DateTimeFormat(currentLanguage, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function getSelectedBookingDateTime(time: string): Date {
  const bookingDate = new Date(selectedCalendarDate);
  const [hours, minutes] = time.split(':').map(Number);
  bookingDate.setHours(hours, minutes, 0, 0);
  return bookingDate;
}

function isBookingTooSoon(time: string): boolean {
  return getSelectedBookingDateTime(time).getTime() - Date.now() < minimumBookingNoticeMs;
}

function showTooSoonWarning(time: string) {
  if (!modalTitle || !modalBody) return;

  modalTitle.textContent = t('tooSoonTitle');
  modalBody.innerHTML = `
    <div class="text-center">
      <div class="text-warning fs-1 mb-3" aria-hidden="true">!</div>
      <p class="mb-2">${t('tooSoon', { time })}</p>
      <p class="text-muted mb-4">${t('tooSoonText')}</p>
      <button class="btn btn-primary" data-bs-dismiss="modal">${t('chooseAnotherTime')}</button>
    </div>
  `;
  modalInstance.show();
}

async function submitBooking() {
  if (isDateBeforeToday(selectedCalendarDate)) {
    if (modalTitle && modalBody) {
      modalTitle.textContent = t('unavailableDate');
      modalBody.innerHTML = `
        <div class="text-center">
          <p class="text-danger mb-3">${t('pastDate')}</p>
          <button class="btn btn-primary" data-bs-dismiss="modal">${t('chooseAnotherDate')}</button>
        </div>
      `;
    }
    modalInstance.show();
    return;
  }

  if (currentSelectedTime && isBookingTooSoon(currentSelectedTime)) {
    showTooSoonWarning(currentSelectedTime);
    return;
  }

  const nameInputElement = document.getElementById('clientName') as HTMLInputElement | null;
  const phoneInputElement = document.getElementById('clientPhone') as HTMLInputElement | null;
  const instagramInputElement = document.getElementById('clientInstagram') as HTMLInputElement | null;
  const noteInputElement = document.getElementById('clientNote') as HTMLTextAreaElement | null;

  const nameInput = nameInputElement?.value ?? '';
  const phoneInput = phoneInputElement?.value ?? '';
  const instagramInput = instagramInputElement?.value.trim() ?? '';
  const noteInput = noteInputElement?.value.trim().replace(/\s+/g, ' ').slice(0, 500) ?? '';

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
    modalTitle.textContent = t('processing');
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
          clientPhone: sanitizedPhone,
          clientInstagram: instagramInput,
          clientNote: noteInput
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
      year: currentSelectedDay.year ?? new Date().getFullYear(),
      clientInstagram: instagramInput,
      clientNote: noteInput
    });

    const savedDay = await runTransaction(firestore, async transaction => {
      const daySnapshot = await transaction.get(dayRef);
      const dayFromFirestore = daySnapshot.data() as Day | undefined;
      if (!dayFromFirestore) throw new Error('День бронирования не найден');

      const nextDay: Day = {
        ...dayFromFirestore,
        slots: dayFromFirestore.slots.map(slot => slot.id === bookingId
          ? { ...slot, calendarEventId, clientInstagram: instagramInput }
          : slot)
      };
      transaction.set(dayRef, nextDay);
      return nextDay;
    });

    db = db.map(day => day.id === savedDay.id ? savedDay : updatedDay);
    const localReservation: LocalReservation = {
      id: bookingId,
      dayId: savedDay.id,
      date: selectedDay.date,
      month: selectedDay.month,
      year: selectedDay.year ?? new Date().getFullYear(),
      time: currentSelectedTime,
      durationMinutes: currentSelectedDuration,
      calendarEventId
    };
    saveLocalReservations([...getLocalReservations(), localReservation]);

    if (modalTitle && modalBody) {
      modalTitle.textContent = t('confirmed');
      modalBody.innerHTML = `
        <div class="booking-success-mark" aria-hidden="true">✓</div>
        <h5 class="mb-3">${t('thanks')}, ${sanitizedName}.</h5>
        <p class="mb-2">${t('reservationFor')}</p>
        <p class="fw-bold mb-1">${formatBookingDate(selectedCalendarDate)}</p>
        <p class="fw-bold mb-1">${currentSelectedTime} · ${currentSelectedDuration / 60} h</p>
        <p class="text-muted mb-0">${t('price')}: ${getDurationPrice(currentSelectedDuration)}</p>
        <p class="small text-muted mt-3 mb-0">${t('screenshot')}</p>
        <button class="btn btn-outline-success mt-4" data-bs-dismiss="modal">${t('close')}</button>
      `;
    }
    renderClientCalendar();
    renderLocalReservations();
  } catch (error) {
    console.error(error);
    if (modalTitle && modalBody) {
      modalTitle.textContent = t('error');
      modalBody.innerHTML = `<p class="text-danger">${t('bookingError')}</p>`;
    }
  }
}
