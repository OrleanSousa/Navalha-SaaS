import { Injectable, Logger } from '@nestjs/common';

export type OutboundMessage = {
  channel: string;
  recipient: string;
  template: string;
  payload: Record<string, unknown>;
};

export interface MessageProvider {
  send(message: OutboundMessage): Promise<void>;
}

export const MESSAGE_PROVIDER = 'MESSAGE_PROVIDER';

@Injectable()
export class LocalMessageProvider implements MessageProvider {
  private readonly logger = new Logger(LocalMessageProvider.name);

  async send(message: OutboundMessage) {
    this.logger.log(
      `[local/${message.channel}] ${message.recipient} · ${message.template} · ${JSON.stringify(message.payload)}`,
    );
  }
}
