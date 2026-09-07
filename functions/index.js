const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { google } = require('googleapis');

const googleServiceAccountKey = defineSecret('GOOGLE_SERVICE_ACCOUNT_KEY');
const calendarId = 'recuerdoigor@gmail.com';
const timeZone = 'Europe/Madrid';
const sessionBufferMinutes = 30;
const monthNumbers = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12
};

function getCorsOrigin(request) {
  const origin = request.headers.origin;
  return origin ?? '*';
}

function parseEventDate({ date, month, time, year, durationMinutes }) {
  const monthNumber = monthNumbers[String(month).toLowerCase()];
  const day = Number(date);
  const eventYear = Number(year);

  if (!monthNumber || !Number.isInteger(day) || !Number.isInteger(eventYear) || ![60, 90, 120].includes(Number(durationMinutes)) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error('Некорректная дата или время бронирования');
  }

  const [hours, minutes] = time.split(':').map(Number);
  if (hours > 23 || minutes > 59) throw new Error('Некорректное время бронирования');

  const start = new Date(eventYear, monthNumber - 1, day, hours, minutes);
  const end = new Date(start.getTime() + Number(durationMinutes) * 60 * 1000);
  const formatDate = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:00`;

  return { start: formatDate(start), end: formatDate(end) };
}

exports.createCalendarEvent = onRequest(
  { region: 'us-central1', invoker: 'public', secrets: [googleServiceAccountKey] },
  async (request, response) => {
    response.set('Access-Control-Allow-Origin', getCorsOrigin(request));
    response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Метод не поддерживается' });
      return;
    }

    try {
      const { clientName, clientPhone, clientInstagram, clientNote, date, month, time, durationMinutes, year } = request.body ?? {};
      if (!clientName || !clientPhone || !date || !month || !time || !durationMinutes || !year) {
        response.status(400).json({ error: 'Не хватает данных бронирования' });
        return;
      }

      const credentials = JSON.parse(googleServiceAccountKey.value());
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/calendar']
      });
      const calendar = google.calendar({ version: 'v3', auth });
      const eventDate = parseEventDate({ date, month, time, durationMinutes, year });

      const createdEvent = await calendar.events.insert({
        calendarId,
        sendUpdates: 'none',
        requestBody: {
          summary: `Массаж: ${clientName}`,
          description: `Клиент: ${clientName}\nТелефон: ${clientPhone}${clientInstagram ? `\nInstagram: ${clientInstagram}` : ''}${clientNote ? `\nПримечание: ${clientNote}` : ''}`,
          start: { dateTime: eventDate.start, timeZone },
          end: { dateTime: eventDate.end, timeZone },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 60 },
              { method: 'popup', minutes: 15 }
            ]
          }
        }
      });

      response.status(201).json({ eventId: createdEvent.data.id });
    } catch (error) {
      console.error('Не удалось создать событие Google Calendar', error);
      response.status(500).json({ error: 'Не удалось создать событие в Google Calendar' });
    }
  }
);

exports.deleteCalendarEvent = onRequest(
  { region: 'us-central1', invoker: 'public', secrets: [googleServiceAccountKey] },
  async (request, response) => {
    response.set('Access-Control-Allow-Origin', getCorsOrigin(request));
    response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Método no soportado' });
      return;
    }

    try {
      const { eventId } = request.body ?? {};
      if (!eventId) {
        response.status(400).json({ error: 'Falta el ID del evento' });
        return;
      }

      const credentials = JSON.parse(googleServiceAccountKey.value());
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/calendar']
      });
      const calendar = google.calendar({ version: 'v3', auth });
      await calendar.events.delete({ calendarId, eventId });
      response.status(204).send('');
    } catch (error) {
      if (error?.code === 404) {
        response.status(204).send('');
        return;
      }
      console.error('Не se pudo eliminar el evento de Google Calendar', error);
      response.status(500).json({ error: 'No se pudo cancelar el evento del calendario' });
    }
  }
);

exports.syncCalendarBookings = onRequest(
  { region: 'us-central1', invoker: 'public', secrets: [googleServiceAccountKey] },
  async (request, response) => {
    response.set('Access-Control-Allow-Origin', getCorsOrigin(request));
    response.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    if (request.method !== 'GET') {
      response.status(405).json({ error: 'Метод не поддерживается' });
      return;
    }

    try {
      const credentials = JSON.parse(googleServiceAccountKey.value());
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/calendar.readonly']
      });
      const calendar = google.calendar({ version: 'v3', auth });
      const end = new Date();
      end.setDate(end.getDate() + 60);
      const events = await calendar.events.list({
        calendarId,
        timeMin: new Date().toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        showDeleted: false,
        maxResults: 2500
      });

      response.status(200).json({ eventIds: (events.data.items ?? []).map(event => event.id).filter(Boolean) });
    } catch (error) {
      console.error('Не удалось синхронизировать бронирования Google Calendar', error);
      response.status(500).json({ error: 'Не удалось синхронизировать Google Calendar' });
    }
  }
);
