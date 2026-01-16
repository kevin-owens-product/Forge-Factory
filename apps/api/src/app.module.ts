import { Module } from '@nestjs/common';
import { OrganizationModule } from './modules/organizations/organization.module';

@Module({
  imports: [OrganizationModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
