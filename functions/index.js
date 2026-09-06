const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { google } = require('googleapis');

const googleServiceAccountKey = defineSecret('GOOGLE_SERVICE_ACCOUNT_KEY');
const calendarId = 'igoryurievich1@gmail.com';
const timeZone = 'Europe/Madrid';
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

function parseEventDate({ date, month, time, year }) {
  const monthNumber = monthNumbers[String(month).toLowerCase()];
  const day = Number(date);
  const eventYear = Number(year);

  if (!monthNumber || !Number.isInteger(day) || !Number.isInteger(eventYear) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error('Некорректная дата или время бронирования');
  }

  const [hours, minutes] = time.split(':').map(Number);
  if (hours > 23 || minutes > 59) throw new Error('Некорректное время бронирования');

  return {
    start: `${eventYear}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}T${time}:00`,
    end: `${eventYear}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  };
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
      const { clientName, clientPhone, date, month, time, year } = request.body ?? {};
      if (!clientName || !clientPhone || !date || !month || !time || !year) {
        response.status(400).json({ error: 'Не хватает данных бронирования' });
        return;
      }

      const credentials = JSON.parse(googleServiceAccountKey.value());
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/calendar']
      });
      const calendar = google.calendar({ version: 'v3', auth });
      const eventDate = parseEventDate({ date, month, time, year });

      const createdEvent = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: `Массаж: ${clientName}`,
          description: `Клиент: ${clientName}\nТелефон: ${clientPhone}`,
          start: { dateTime: eventDate.start, timeZone },
          end: { dateTime: eventDate.end, timeZone }
        }
      });

      response.status(201).json({ eventId: createdEvent.data.id });
    } catch (error) {
      console.error('Не удалось создать событие Google Calendar', error);
      response.status(500).json({ error: 'Не удалось создать событие в Google Calendar' });
    }
  }
);
