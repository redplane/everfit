import { Module } from '@nestjs/common';
import { ScaleUnitConversionService } from './scale-unit-conversion.service';
import { ScaleUnitConversionServiceInjectionTokens } from './scale-unit-conversion-injection-tokens';

/**
 * Provides `IScaleUnitConversionService` under the `SERVICE__SCALE_UNIT_CONVERSION` token (bound to
 * the production registry via `useClass` — the service's registry constructor params default to the
 * production constants) and exports the token for downstream consumers (F5–F8).
 */
@Module({
  providers: [
    {
      provide: ScaleUnitConversionServiceInjectionTokens.SERVICE__SCALE_UNIT_CONVERSION,
      useClass: ScaleUnitConversionService,
    },
  ],
  exports: [ScaleUnitConversionServiceInjectionTokens.SERVICE__SCALE_UNIT_CONVERSION],
})
export class ScaleUnitConversionServiceModule {}
