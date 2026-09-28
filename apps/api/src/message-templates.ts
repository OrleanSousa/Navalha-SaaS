export const messageTemplates = {
  appointment_created: {
    channel: 'WHATSAPP',
    body: 'Olá, {{customerName}}! Seu horário em {{barbershopName}} foi reservado para {{startAt}} com {{employeeName}}.',
    variables: ['customerName', 'barbershopName', 'startAt', 'employeeName'],
  },
  appointment_cancelled: {
    channel: 'WHATSAPP',
    body: 'Olá, {{customerName}}. Seu horário de {{startAt}} em {{barbershopName}} foi cancelado.',
    variables: ['customerName', 'barbershopName', 'startAt'],
  },
} as const;
