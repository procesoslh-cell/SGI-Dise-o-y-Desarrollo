import net from 'net';
import tls from 'tls';
import { env } from '../config/env.js';
import { now } from '../db/initialData.js';
import { nextNumericId } from '../features/workflow.js';

export function queueEmail(data, payload) {
  data.emailOutbox ||= [];
  const configured = Boolean(env.smtp.host && env.smtp.user && env.smtp.pass && env.smtp.from);
  const job = {
    id: nextNumericId(data, 'emailOutbox'),
    toUserId: payload.toUserId || null,
    to: payload.to || null,
    subject: payload.subject,
    body: payload.body,
    html: payload.html || null,
    projectId: payload.projectId || null,
    marketingTaskId: payload.marketingTaskId || null,
    status: configured ? 'Pendiente' : 'Pendiente configuración SMTP',
    attempts: 0,
    createdAt: now(),
    updatedAt: now()
  };
  data.emailOutbox.push(job);
  return job;
}

export function queueMarketingAssignmentEmail(data, { project, task, recipient, assignedBy }) {
  const taskUrl = env.appUrl ? `${env.appUrl.replace(/\/$/, '')}/` : '';
  return queueEmail(data, {
    toUserId: recipient?.id || null,
    to: recipient?.email || null,
    projectId: project.id,
    marketingTaskId: task.id,
    subject: `Nueva tarea asignada · ${project.code} · ${task.title}`,
    body: [
      `Hola ${recipient?.name || ''},`,
      '',
      `${assignedBy || 'El jefe del proyecto'} te asignó una tarea del Plan de Marketing.`,
      `Proyecto: ${project.code} · ${project.name}`,
      `Tarea: ${task.title}`,
      `Área: ${task.area || task.channel || 'Marketing'}`,
      `Inicio: ${task.startDate}`,
      `Vencimiento: ${task.dueDate}`,
      task.notes ? `Observaciones: ${task.notes}` : '',
      taskUrl ? `Ingresá al SGI para verla y trabajarla: ${taskUrl}` : 'Ingresá al SGI para verla y trabajarla.',
      '',
      'SGI Diseño y Desarrollo'
    ].filter(Boolean).join('\n')
  });
}

export async function dispatchEmailJobs(db, jobIds = []) {
  if (!smtpConfigured() || !jobIds.length) return;

  for (const jobId of jobIds) {
    const snapshot = db.read();
    const job = (snapshot.emailOutbox || []).find((item) => item.id === Number(jobId));
    if (!job || !job.to || ['Enviado', 'Enviando'].includes(job.status)) continue;

    db.transact((data) => {
      const current = data.emailOutbox.find((item) => item.id === Number(jobId));
      if (current) {
        current.status = 'Enviando';
        current.attempts = Number(current.attempts || 0) + 1;
        current.updatedAt = now();
      }
    });

    try {
      const messageId = await sendSmtpMail({
        from: env.smtp.from,
        to: job.to,
        subject: job.subject,
        text: job.body
      });
      db.transact((data) => {
        const current = data.emailOutbox.find((item) => item.id === Number(jobId));
        if (current) {
          current.status = 'Enviado';
          current.messageId = messageId;
          current.sentAt = now();
          current.updatedAt = now();
          current.lastError = null;
        }
      });
    } catch (error) {
      db.transact((data) => {
        const current = data.emailOutbox.find((item) => item.id === Number(jobId));
        if (current) {
          current.status = 'Error';
          current.lastError = error.message;
          current.updatedAt = now();
        }
      });
      console.error(`No se pudo enviar el email ${jobId}:`, error.message);
    }
  }
}

function smtpConfigured() {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass && env.smtp.from);
}

async function sendSmtpMail({ from, to, subject, text }) {
  let socket = await connectSocket(env.smtp.secure);
  let reader = createResponseReader(socket);
  await expect(reader, [220]);
  await command(socket, reader, `EHLO ${smtpClientName()}`, [250]);

  if (!env.smtp.secure) {
    await command(socket, reader, 'STARTTLS', [220]);
    reader.close();
    socket = await upgradeToTls(socket);
    reader = createResponseReader(socket);
    await command(socket, reader, `EHLO ${smtpClientName()}`, [250]);
  }

  await command(socket, reader, 'AUTH LOGIN', [334]);
  await command(socket, reader, Buffer.from(env.smtp.user).toString('base64'), [334]);
  await command(socket, reader, Buffer.from(env.smtp.pass).toString('base64'), [235]);

  const fromAddress = extractAddress(from);
  await command(socket, reader, `MAIL FROM:<${fromAddress}>`, [250]);
  await command(socket, reader, `RCPT TO:<${extractAddress(to)}>`, [250, 251]);
  await command(socket, reader, 'DATA', [354]);

  const messageId = `<sgi-${Date.now()}-${Math.random().toString(16).slice(2)}@${smtpClientName()}>`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit'
  ].join('\r\n');
  const safeBody = String(text || '').replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
  socket.write(`${headers}\r\n\r\n${safeBody}\r\n.\r\n`);
  await expect(reader, [250]);
  await command(socket, reader, 'QUIT', [221]);
  reader.close();
  socket.end();
  return messageId;
}

function connectSocket(secure) {
  return new Promise((resolve, reject) => {
    const options = {
      host: env.smtp.host,
      port: env.smtp.port,
      servername: env.smtp.host,
      rejectUnauthorized: env.smtp.rejectUnauthorized
    };
    const socket = secure ? tls.connect(options) : net.connect(options);
    socket.setTimeout(20000, () => socket.destroy(new Error('Tiempo de espera SMTP agotado.')));
    socket.once(secure ? 'secureConnect' : 'connect', () => resolve(socket));
    socket.once('error', reject);
  });
}

function upgradeToTls(socket) {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({
      socket,
      servername: env.smtp.host,
      rejectUnauthorized: env.smtp.rejectUnauthorized
    });
    secureSocket.setTimeout(20000, () => secureSocket.destroy(new Error('Tiempo de espera TLS agotado.')));
    secureSocket.once('secureConnect', () => resolve(secureSocket));
    secureSocket.once('error', reject);
  });
}

function createResponseReader(socket) {
  let buffer = '';
  let pending = null;
  let closed = false;

  const onData = (chunk) => {
    buffer += chunk.toString('utf8');
    flush();
  };
  const onError = (error) => {
    if (pending) {
      pending.reject(error);
      pending = null;
    }
  };
  const onClose = () => {
    closed = true;
    if (pending) {
      pending.reject(new Error('La conexión SMTP se cerró inesperadamente.'));
      pending = null;
    }
  };

  socket.on('data', onData);
  socket.on('error', onError);
  socket.on('close', onClose);

  function extractResponse() {
    const lines = buffer.split(/\r?\n/);
    let consumed = 0;
    const responseLines = [];
    for (const line of lines) {
      if (!line && consumed + line.length >= buffer.length) break;
      responseLines.push(line);
      consumed += line.length + (buffer.includes('\r\n') ? 2 : 1);
      if (/^\d{3} /.test(line)) {
        buffer = buffer.slice(consumed);
        return responseLines.join('\n');
      }
    }
    return null;
  }

  function flush() {
    if (!pending) return;
    const response = extractResponse();
    if (response) {
      const current = pending;
      pending = null;
      current.resolve(response);
    }
  }

  return {
    read() {
      if (closed) return Promise.reject(new Error('La conexión SMTP está cerrada.'));
      const response = extractResponse();
      if (response) return Promise.resolve(response);
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
      });
    },
    close() {
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
    }
  };
}

async function command(socket, reader, value, expectedCodes) {
  socket.write(`${value}\r\n`);
  return expect(reader, expectedCodes);
}

async function expect(reader, expectedCodes) {
  const response = await reader.read();
  const code = Number(response.slice(0, 3));
  if (!expectedCodes.includes(code)) throw new Error(`SMTP respondió ${response.replace(/\n/g, ' | ')}`);
  return response;
}

function extractAddress(value) {
  const match = String(value || '').match(/<([^>]+)>/);
  return (match?.[1] || String(value || '')).trim();
}

function encodeHeader(value) {
  const text = String(value || '');
  return /^[\x00-\x7F]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text).toString('base64')}?=`;
}

function smtpClientName() {
  return String(env.smtp.host || 'sgi.local').split(':')[0] || 'sgi.local';
}
