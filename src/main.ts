import { NestFactory } from '@nestjs/core';
import { RootModule } from './root.module';

async function bootstrap(): Promise<void> {
  const application = await NestFactory.create(RootModule);
  await application.listen(3000);
}

bootstrap();
