import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class DynamicExecutorService {
  private readonly logger = new Logger(DynamicExecutorService.name);

  constructor(private moduleRef: ModuleRef) {}

  async executeByName(name: string, data: any): Promise<any> {
    const [serviceToken, methodName] = name.split('.');
    if (!serviceToken || !methodName) {
      throw new Error(`Invalid name format: ${name}`);
    }

    const service = this.moduleRef.get(serviceToken, { strict: false });
    if (!service) {
      throw new Error(`Service '${serviceToken}' not found`);
    }

    if (typeof service[methodName] !== 'function') {
      throw new Error(`Method '${methodName}' not found in service '${serviceToken}'`);
    }

    this.logger.log(`Invoking ${serviceToken}.${methodName}`);
    return await service[methodName](data);
  }
}
