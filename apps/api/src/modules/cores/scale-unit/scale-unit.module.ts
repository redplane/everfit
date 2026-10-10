import { Module } from '@nestjs/common';
import { ScaleUnitConversionServiceModule } from './services/scale-unit-conversion/scale-unit-conversion.service.module';

/**
 * Core module for category-based scale units and their conversion (F4). Re-exports the conversion
 * service module so downstream features can inject `IScaleUnitConversionService` (token
 * `SERVICE__SCALE_UNIT_CONVERSION`, used by logging F5 and the weight-returning reads F6/F7/F8). The
 * token is provided by the per-service module, so this module re-exports that module rather than the
 * token (a module can only export what it provides or a module it imports). Ships no controller /
 * endpoint; it is imported by its consumers, not by `AppModule`.
 */
@Module({
  imports: [ScaleUnitConversionServiceModule],
  exports: [ScaleUnitConversionServiceModule],
})
export class ScaleUnitModule {}
